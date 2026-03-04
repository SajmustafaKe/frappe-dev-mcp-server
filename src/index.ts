import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import express from "express";

import { ToolContext, ToolResult } from "./types.js";
import { runBenchCommand as runBench } from "./utils/bench.js";
import { getAppPath, getModulePath, getDoctypePath } from "./utils/paths.js";
import { createToolRegistry } from "./tools/index.js";

class FrappeMCPServer {
  private frappePath: string;
  private defaultSite: string;
  private servers: Server[] = [];
  private registry = createToolRegistry();

  constructor() {
    this.frappePath = process.env.FRAPPE_PATH || "/Users/mac/ERPNext/mkahawa";
    this.defaultSite = process.env.FRAPPE_DEFAULT_SITE || "mkahawa.localhost";
  }

  private createToolContext(): ToolContext {
    const frappePath = this.frappePath;
    return {
      frappePath,
      defaultSite: this.defaultSite,
      runBenchCommand: async (args) => runBench(frappePath, args),
      getAppPath: (appName) => getAppPath(frappePath, appName),
      getModulePath: (appName, moduleName) => getModulePath(frappePath, appName, moduleName),
      getDoctypePath: (appName, moduleName, doctypeName) => getDoctypePath(frappePath, appName, moduleName, doctypeName),
    };
  }

  private createServer(): Server {
    const server = new Server({
      name: "frappe-mcp-server",
      version: "2.0.0",
    });

    this.setupToolHandlers(server);
    return server;
  }

  private setupToolHandlers(server: Server) {
    const allTools = this.registry.getAllDefinitions();
    const ctx = this.createToolContext();

    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: allTools };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.registry.dispatch(name, args, ctx);
        return result as any;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  async runStdio() {
    const serverInstance = this.createServer();
    const transport = new StdioServerTransport();

    serverInstance.onclose = () => {
      process.exit(0);
    };

    await serverInstance.connect(transport);

    const allTools = this.registry.getAllDefinitions();
    console.error(`Frappe MCP Server v2.0.0 running on stdio`);
    console.error(`Total tools available: ${allTools.length}`);
    console.error(`Frappe path: ${this.frappePath}`);
    console.error(`Default site: ${this.defaultSite}`);
  }

  async runSSE() {
    const port = process.env.PORT || 3000;
    const app = express();

    // CORS middleware
    app.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
      }
      next();
    });

    // SSE endpoint
    app.get("/sse", async (req, res) => {
      console.error("Got new SSE connection");
      try {
        const serverInstance = this.createServer();
        const transport = new SSEServerTransport("/message", res);

        serverInstance.onclose = () => {
          console.error("MCP Server connection closed");
          this.servers = this.servers.filter((s) => s !== serverInstance);
        };

        this.servers.push(serverInstance);
        await serverInstance.connect(transport);

        console.error(
          "SSE connection established with sessionId:",
          (transport as any).sessionId
        );
      } catch (error) {
        console.error("SSE connection failed:", error);
        if (!res.headersSent) {
          res.status(500).send("Internal Server Error");
        }
      }
    });

    // Message endpoint
    app.post("/message", async (req, res) => {
      try {
        console.error("Received message");
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
          console.error("Missing sessionId in POST request");
          res.status(400).send("Missing sessionId");
          return;
        }

        const transport = this.servers
          .map((s) => s.transport)
          .find(
            (t) => (t as SSEServerTransport).sessionId === sessionId
          );

        if (!transport) {
          console.error("Session not found:", sessionId);
          console.error(
            "Available sessions:",
            this.servers.map(
              (s) => (s.transport as SSEServerTransport).sessionId
            )
          );
          res.status(404).send("Session not found");
          return;
        }

        await (transport as SSEServerTransport).handlePostMessage(req, res);
        console.error("Message handled successfully");
      } catch (error) {
        console.error("Message handling failed:", error);
        if (!res.headersSent) {
          res.status(500).send("Internal Server Error");
        }
      }
    });

    // Health check
    app.get("/health", (req, res) => {
      const allTools = this.registry.getAllDefinitions();
      res.json({
        status: "ok",
        version: "2.0.0",
        tools_count: allTools.length,
        active_sessions: this.servers.length,
        frappe_path: this.frappePath,
        default_site: this.defaultSite,
      });
    });

    app.listen(port, () => {
      const allTools = this.registry.getAllDefinitions();
      console.error(
        `Frappe MCP Server v2.0.0 running on SSE at http://localhost:${port}/sse`
      );
      console.error(`Total tools available: ${allTools.length}`);
      console.error(`Frappe path: ${this.frappePath}`);
      console.error(`Default site: ${this.defaultSite}`);
    });
  }
}

// Start the server
const mcpServer = new FrappeMCPServer();
const transportMode = process.argv.includes("--stdio") ? "stdio" : "sse";

if (transportMode === "stdio") {
  mcpServer.runStdio().catch(console.error);
} else {
  mcpServer.runSSE().catch(console.error);
}
