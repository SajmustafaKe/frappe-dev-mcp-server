# Conversation Commerce — Frappe App Design

A custom Frappe app (`conversation_commerce`) that lets a business sell, support, and re-engage customers entirely inside chat channels (WhatsApp, Messenger, Instagram DM, SMS, web chat), backed by ERPNext-native records (Item, Customer, Sales Order, Payment Entry).

---

## 1. Goals & Non-Goals

### Goals
- Single inbox across providers, with a unified message + conversation model.
- Bot-first flows for catalog browsing, cart, checkout, order status, and FAQs.
- Seamless handoff from bot to human agent without losing context.
- Convert chat carts into ERPNext `Sales Order` + `Payment Entry` cleanly — no parallel commerce engine.
- Compliance with provider rules (WhatsApp 24-hour session window, template messages, opt-in).
- Auditable: every inbound/outbound message and every state transition is traceable.

### Non-Goals (v1)
- Building a payment processor (we generate hosted payment links, we don't card-process).
- Replacing ERPNext's pricing/inventory engine.
- Voice / IVR channels.
- Native mobile agent app (web SPA only).

---

## 2. High-Level Architecture

```
Provider (WhatsApp / Meta / Twilio)
        │  webhook
        ▼
┌──────────────────────────┐
│  Inbound API (Frappe)    │  signature verify → normalize → enqueue
└──────────┬───────────────┘
           │ RQ job
           ▼
┌──────────────────────────┐
│  Conversation Engine     │  state machine, intent routing, tool dispatch
└──────────┬───────────────┘
           │
   ┌───────┴────────┬─────────────┬──────────────┐
   ▼                ▼             ▼              ▼
Bot Handler   Catalog/Cart    ERPNext Ops    Human Handoff
(rules+LLM)   (Item, Cart)    (SO, PE)       (Notification)
           │
           ▼
┌──────────────────────────┐
│  Outbound Dispatcher     │  template gating, rate limit, retry
└──────────┬───────────────┘
           ▼
       Provider API
```

Webhooks return `200` within ~1s; all real work happens in background queues so providers don't retry on slow turns.

---

## 3. Data Model (DocTypes)

### Configuration
- **Channel** — one per provider connection.
  - `channel_type` (Select: WhatsApp Cloud, Messenger, Instagram, SMS Twilio, Web Chat)
  - `name`, `enabled`, `phone_or_page_id`, `access_token` (Password), `webhook_secret` (Password)
  - `default_bot_flow` (Link → Bot Flow), `business_hours` (JSON), `fallback_agent` (Link → User)
- **Bot Flow** — declarative flow definition.
  - `name`, `trigger_intents` (Table), `steps` (Table of Bot Step), `llm_fallback_enabled`
- **Bot Step** — child table.
  - `step_id`, `kind` (Select: send_template, send_text, ask, branch, tool_call, handoff), `payload` (Code/JSON), `next_step` (Data)
- **Bot Tool** — registered callable mapped to a Frappe whitelisted method.
  - `tool_name`, `method_path`, `parameters_schema` (JSON), `requires_auth`
- **Catalog Mapping** — links `Item` to provider-side catalog SKU.
  - `item`, `channel`, `external_id`, `last_synced`

### Conversation State
- **Conversation** — the central thread.
  - `channel` (Link), `external_user_id`, `customer` (Link → Customer, nullable), `lead` (Link → Lead, nullable)
  - `state` (Select: new, browsing, cart, checkout, paid, support, closed)
  - `assigned_user` (Link → User, nullable), `bot_active` (Check), `last_message_at`, `session_expires_at`
  - `language`, `tags` (Table), `context` (JSON — small key/value bag for flow state)
- **Conversation Message** — every inbound and outbound payload.
  - `conversation`, `direction` (in/out), `provider_message_id`, `message_type` (text/image/template/interactive/location/document)
  - `body`, `media_url`, `template_name`, `template_variables` (JSON)
  - `status` (queued/sent/delivered/read/failed), `error_code`, `cost` (for paid templates)
- **Conversation Cart** — pre-order staging.
  - `conversation`, `items` (Table of Cart Item: item, qty, rate, uom), `currency`, `total`, `notes`
  - On promotion, creates `Quotation` then `Sales Order`.
- **Payment Link**
  - `sales_order`, `provider` (Stripe/Razorpay/etc.), `url`, `status`, `expires_at`, `paid_payment_entry`

### Operational
- **Conversation Event** — append-only audit log (state changes, handoffs, tool calls).
- **Catalog Sync Log** — per-channel push results.
- **Inbound Webhook Log** — raw payload + verification result, for debugging and replay.

### Why standalone `Conversation Message`, not Frappe `Communication`?
`Communication` is overloaded (email, comment, chat) and its schema doesn't carry template / interactive payloads or per-message delivery state cleanly. We can mirror summaries to `Communication` for timeline integration but keep the source of truth in `Conversation Message`.

---

## 4. Conversation State Machine

```
new ──first inbound──▶ browsing
browsing ──add to cart──▶ cart
cart ──checkout intent──▶ checkout
checkout ──payment link sent──▶ checkout
checkout ──Payment Entry submitted──▶ paid
any ──"agent" / unhandled──▶ support
any ──inactivity 7d / explicit close──▶ closed
```

State transitions are emitted as `Conversation Event` rows so analytics and audit are deterministic.

---

## 5. Inbound Path

1. Provider POSTs to `/api/method/conversation_commerce.api.webhook.whatsapp` (one endpoint per provider).
2. Verify signature using `Channel.webhook_secret`. Reject with 401 on mismatch.
3. Persist raw payload to `Inbound Webhook Log` (TTL via scheduled cleanup).
4. Normalize to an internal envelope: `{channel, external_user_id, message_type, body, media, provider_message_id, timestamp}`.
5. `frappe.enqueue("conversation_commerce.engine.handle_inbound", envelope, queue="short")`.
6. Return `200` immediately.

The job:
- Upserts `Conversation` (creates `Lead` if no `Customer` match by phone/email).
- Persists `Conversation Message` (direction=`in`).
- Refreshes `session_expires_at` (WhatsApp: now + 24h).
- Hands off to the **Conversation Engine**.

---

## 6. Conversation Engine (Bot)

A small, deterministic dispatcher with three layers tried in order:

1. **Active flow continuation** — if `Conversation.context.current_flow` is set, advance it.
2. **Intent routing** — match the inbound text against `Bot Flow.trigger_intents` (keywords, regex, quick-reply payload IDs).
3. **LLM fallback** (optional) — if enabled on the flow, send `{system_prompt, recent_messages, available_tools}` to Claude. The model returns either a text reply or a tool call.

### Tool calls
Tools are Frappe whitelisted methods listed in `Bot Tool`. The engine validates arguments against the tool's JSON schema, executes, and feeds results back. Suggested initial set:
- `search_items(query, limit)` → list of `Item` with price + image
- `get_item(item_code)` → details + stock availability
- `add_to_cart(conversation, item_code, qty)`
- `view_cart(conversation)`
- `create_quotation(conversation)` and `confirm_order(conversation)` → `Sales Order`
- `create_payment_link(sales_order)` → hosted URL
- `get_order_status(order_name)`
- `request_human(conversation, reason)` → handoff

### Guardrails
- Per-conversation token budget and per-day spend cap on LLM calls (config on `Channel`).
- Tool calls run with the assigned customer's permissions, not as `Administrator` — prevents a prompt-injected message from listing other customers' orders.
- All tool calls and LLM turns logged to `Conversation Event`.

---

## 7. Outbound Dispatcher

Single function `send(conversation, payload)`:
- Looks up `Channel` config and provider client.
- Enforces provider rules:
  - WhatsApp: if `now > session_expires_at`, only approved **template** messages allowed. Reject free-text sends with a clear error.
  - Rate limit per phone number (token-bucket in Redis).
- Writes `Conversation Message` (direction=`out`, status=`queued`) before send to keep ordering.
- On success, stores `provider_message_id`; on failure, retries with backoff (3 attempts), then marks `failed` and emits a `Conversation Event`.
- Provider delivery webhooks update `status` (sent → delivered → read).

---

## 8. Commerce Integration

Reuse ERPNext where possible:
- **Customer / Lead** matched by phone first, email second; auto-create `Lead` for new contacts and convert to `Customer` at first order.
- **Quotation → Sales Order** via standard `make_sales_order`. Conversation Cart stores only the staging line items + selected price list.
- **Payment Entry** is created by the payment provider's webhook, not by us; we only correlate it back via `Payment Link.sales_order`.
- **Hooks**:
  - `doc_events.Sales Order.on_submit` → send order confirmation message in the originating channel.
  - `doc_events.Payment Entry.on_submit` → send receipt + PDF.
  - `doc_events.Sales Order.on_cancel` → cancellation notice.

---

## 9. Agent Frontend (frappe-ui SPA)

Routes:
- `/inbox` — list of open conversations, filters by channel/state/assignee, unread badges.
- `/inbox/:conversation` — message thread, side panel showing customer + cart + recent orders.
- `/inbox/:conversation/cart` — edit cart, push to Quotation/Sales Order.
- `/templates` — browse approved WhatsApp templates and send with variables.
- `/flows` — list and edit `Bot Flow` (advanced users).

Realtime: Frappe's socketio for new messages and state changes (`conversation:<name>` room).

Key UX rules:
- Big "Take over from bot" toggle that flips `bot_active`.
- Visible session-window countdown for WhatsApp; auto-disable free-text input when expired and offer template picker instead.
- Quick reply slash-commands: `/cart`, `/order`, `/template <name>`.

---

## 10. Permissions

- **Conversation Agent** role — read/write `Conversation`, `Conversation Message`, `Conversation Cart`; submit `Quotation`; no access to `Channel` secrets.
- **Conversation Manager** role — additionally manages `Channel`, `Bot Flow`, `Bot Tool`, `Catalog Mapping`.
- **Customer** — never reads anything directly; all access goes through the bot which runs server-side with explicit allowed methods.
- Field-level: token/secret fields restricted to `Conversation Manager` and `System Manager`.

---

## 11. Background Jobs & Scheduler

| Job | Trigger | Purpose |
|---|---|---|
| `handle_inbound` | webhook | process one inbound envelope |
| `dispatch_outbound` | engine | send a single outbound message |
| `sync_catalog` | hourly | push Item changes to provider catalog |
| `expire_sessions` | every 15 min | flip `bot_active` off for stale WhatsApp sessions; close after 7d idle |
| `retry_failed_messages` | every 5 min | bounded retry of `failed` outbound |
| `cleanup_webhook_logs` | daily | trim `Inbound Webhook Log` older than 30 days |
| `payment_link_expiry_check` | every 30 min | mark expired payment links and notify |

---

## 12. Observability

- Structured logs per conversation with `conversation_name` correlation ID.
- Metrics: messages in/out per channel, bot containment rate (% turns without handoff), median bot response time, LLM tokens + cost per day, payment-link conversion rate.
- A `Conversation Health` dashboard (Frappe Dashboard) plus a script report for unanswered conversations > N minutes.

---

## 13. Security

- Webhook signature verification mandatory; reject + alert on repeated mismatches (possible token leak).
- Provider tokens stored as Frappe `Password` fields, never logged.
- LLM payloads scrubbed of PII fields not needed for the turn (e.g., never send full address history when the user asked about a product).
- Prompt-injection mitigation: tool calls run with bounded scope (whitelisted methods, customer-scoped queries), the LLM cannot execute arbitrary SQL or read other conversations.
- Rate limit per `external_user_id` to prevent inbound flooding from one number.
- Opt-in/opt-out tracking per `Channel` + `external_user_id`; `STOP` keyword universally honored.

---

## 14. Phased Roadmap

**Phase 1 — Foundation (2–3 weeks)**
- DocTypes: Channel, Conversation, Conversation Message, Inbound Webhook Log.
- WhatsApp Cloud API inbound + outbound (text only).
- Minimal agent inbox SPA (list + thread, manual reply).
- No bot yet.

**Phase 2 — Bot & Catalog (3–4 weeks)**
- Bot Flow / Bot Step / Bot Tool DocTypes and engine.
- Rule-based intents + LLM fallback (Claude).
- Catalog Mapping + sync job.
- Conversation Cart + Quotation creation.

**Phase 3 — Checkout & Payments (2–3 weeks)**
- Payment Link DocType + provider integrations (Stripe + Razorpay).
- Sales Order / Payment Entry hooks for confirmations.
- Receipt PDF via Frappe Print Format.

**Phase 4 — Multi-channel + Polish (2–3 weeks)**
- Messenger + Instagram DM + Twilio SMS adapters.
- Templates manager UI.
- Analytics dashboard.
- Opt-in/out, GDPR data export per `external_user_id`.

**Phase 5 — Advanced**
- Agent assignment rules, SLA timers, business-hours auto-replies.
- Voice channel via Twilio Voice + transcription.
- A/B testing of bot flows.

---

## 15. Open Questions

1. **Bot engine ownership** — build the rule engine in-house, or wrap an OSS engine (Rasa, Botpress) and only persist results in Frappe?
2. **LLM provider lock-in** — abstract behind a `BotLLM` interface so Claude / OpenAI / local models are swappable?
3. **Multi-tenant** — one app instance serves many businesses (rows per `Channel`) or one bench per business? Affects credential blast radius and scheduler isolation.
4. **Catalog source of truth** — does ERPNext `Item` master always win, or do we allow provider-side edits to flow back?
5. **Session-window UX** — when a WhatsApp session expires mid-conversation, do we auto-send a re-engagement template (uses paid quota) or wait for the customer to message first?
6. **Compliance scope** — which markets at launch? GDPR + India DPDP + Brazil LGPD all have different consent rules; the opt-in model needs to reflect the launch geography.

---

## 16. Build with the Frappe Dev MCP Server

Most of this app can be scaffolded using tools already exposed by this repo:
- `create_app` → boot the `conversation_commerce` app
- `create_doctype` → all DocTypes in §3
- `create_workflow` → `Conversation` state machine in §4 (optional; the engine can manage state directly)
- `create_api_endpoint` → webhook endpoints in §5
- `create_server_script` / `create_scheduler_event` → jobs in §11
- `create_dashboard_chart` / `create_workspace` → §12 dashboard
- `scaffold_spa_app` + page/component generators → agent inbox in §9
- `create_print_format` → receipt PDF
- `create_role` + `set_permissions` → §10
