# Usage Examples

This document provides practical examples of how to use the Frappe Dev MCP Server for common Frappe/ERPNext development tasks.

## 🏗️ Creating DocTypes

### Basic Customer DocType

```json
{
  "tool": "frappe_create_doctype",
  "parameters": {
    "app_name": "my_hotel_app",
    "doctype_name": "Hotel Guest",
    "module": "Hospitality",
    "fields": [
      {
        "fieldname": "guest_name",
        "label": "Guest Name",
        "fieldtype": "Data",
        "reqd": true
      },
      {
        "fieldname": "email",
        "label": "Email",
        "fieldtype": "Data",
        "options": "Email"
      },
      {
        "fieldname": "phone",
        "label": "Phone Number",
        "fieldtype": "Data"
      },
      {
        "fieldname": "check_in_date",
        "label": "Check-in Date",
        "fieldtype": "Date",
        "reqd": true
      },
      {
        "fieldname": "check_out_date",
        "label": "Check-out Date",
        "fieldtype": "Date"
      },
      {
        "fieldname": "room_number",
        "label": "Room Number",
        "fieldtype": "Link",
        "options": "Room"
      },
      {
        "fieldname": "total_amount",
        "label": "Total Amount",
        "fieldtype": "Currency"
      }
    ]
  }
}
```

### Submittable DocType (Invoice)

```json
{
  "tool": "frappe_create_doctype",
  "parameters": {
    "app_name": "my_hotel_app",
    "doctype_name": "Hotel Invoice",
    "module": "Accounts",
    "is_submittable": true,
    "fields": [
      {
        "fieldname": "guest",
        "label": "Guest",
        "fieldtype": "Link",
        "options": "Hotel Guest",
        "reqd": true
      },
      {
        "fieldname": "invoice_date",
        "label": "Invoice Date",
        "fieldtype": "Date",
        "default": "Today",
        "reqd": true
      },
      {
        "fieldname": "items",
        "label": "Items",
        "fieldtype": "Table",
        "options": "Hotel Invoice Item"
      },
      {
        "fieldname": "total_amount",
        "label": "Total Amount",
        "fieldtype": "Currency",
        "read_only": true
      }
    ]
  }
}
```

### Child Table DocType

```json
{
  "tool": "frappe_create_doctype",
  "parameters": {
    "app_name": "my_hotel_app",
    "doctype_name": "Hotel Invoice Item",
    "module": "Accounts",
    "is_child": true,
    "fields": [
      {
        "fieldname": "item_name",
        "label": "Item Name",
        "fieldtype": "Data",
        "reqd": true
      },
      {
        "fieldname": "quantity",
        "label": "Quantity",
        "fieldtype": "Float",
        "default": "1",
        "reqd": true
      },
      {
        "fieldname": "rate",
        "label": "Rate",
        "fieldtype": "Currency",
        "reqd": true
      },
      {
        "fieldname": "amount",
        "label": "Amount",
        "fieldtype": "Currency",
        "read_only": true
      }
    ]
  }
}
```

## 🛠️ Bench Commands

### Site Management

```json
{
  "tool": "frappe_run_bench_command",
  "parameters": {
    "command": "new-site my-hotel-site.local --admin-password admin123"
  }
}
```

```json
{
  "tool": "frappe_run_bench_command", 
  "parameters": {
    "command": "migrate",
    "site": "my-hotel-site.local"
  }
}
```

### App Management

```json
{
  "tool": "frappe_run_bench_command",
  "parameters": {
    "command": "get-app https://github.com/frappe/erpnext"
  }
}
```

```json
{
  "tool": "frappe_install_app",
  "parameters": {
    "app_name": "erpnext",
    "site": "my-hotel-site.local"
  }
}
```

### Development Commands

```json
{
  "tool": "frappe_run_bench_command",
  "parameters": {
    "command": "build --app my_hotel_app"
  }
}
```

```json
{
  "tool": "frappe_run_bench_command",
  "parameters": {
    "command": "restart"
  }
}
```

## 🚀 Creating New Apps

### Hotel Management App

```json
{
  "tool": "frappe_create_app",
  "parameters": {
    "app_name": "hotel_management",
    "title": "Hotel Management System",
    "publisher": "Your Company",
    "description": "Complete hotel management solution with room booking, guest management, and billing"
  }
}
```

### POS System App

```json
{
  "tool": "frappe_create_app", 
  "parameters": {
    "app_name": "restaurant_pos",
    "title": "Restaurant POS",
    "publisher": "Restaurant Solutions",
    "description": "Point of sale system for restaurants with kitchen display and order management"
  }
}
```

## 🔌 API Endpoints

### Guest API Endpoint

```json
{
  "tool": "frappe_create_api_endpoint",
  "parameters": {
    "app_name": "hotel_management",
    "endpoint_name": "guest_checkin",
    "method": "post",
    "code": "import frappe\nfrom frappe import _\n\n@frappe.whitelist()\ndef guest_checkin(guest_name, room_number, check_in_date):\n    # Create new hotel guest record\n    guest = frappe.get_doc({\n        'doctype': 'Hotel Guest',\n        'guest_name': guest_name,\n        'room_number': room_number,\n        'check_in_date': check_in_date\n    })\n    guest.insert()\n    frappe.db.commit()\n    \n    return {\n        'success': True,\n        'guest_id': guest.name,\n        'message': _('Guest checked in successfully')\n    }"
  }
}
```

### Room Availability API

```json
{
  "tool": "frappe_create_api_endpoint",
  "parameters": {
    "app_name": "hotel_management", 
    "endpoint_name": "available_rooms",
    "method": "get",
    "code": "import frappe\nfrom frappe.utils import today, getdate\n\n@frappe.whitelist()\ndef available_rooms(check_in_date=None, check_out_date=None):\n    if not check_in_date:\n        check_in_date = today()\n    \n    # Get all rooms\n    all_rooms = frappe.get_all('Room', fields=['name', 'room_type', 'status'])\n    \n    # Get occupied rooms for the date range\n    occupied_rooms = frappe.get_all(\n        'Hotel Guest',\n        filters={\n            'check_in_date': ['<=', check_out_date or check_in_date],\n            'check_out_date': ['>=', check_in_date],\n            'docstatus': ['!=', 2]\n        },\n        fields=['room_number']\n    )\n    \n    occupied_room_numbers = [room.room_number for room in occupied_rooms]\n    available_rooms = [\n        room for room in all_rooms \n        if room.name not in occupied_room_numbers and room.status == 'Available'\n    ]\n    \n    return available_rooms"
  }
}
```

## 📊 Database Operations

### Migration

```json
{
  "tool": "frappe_migrate_database",
  "parameters": {
    "site": "my-hotel-site.local"
  }
}
```

### Backup and Restore

```json
{
  "tool": "frappe_run_bench_command",
  "parameters": {
    "command": "backup",
    "site": "my-hotel-site.local"
  }
}
```

```json
{
  "tool": "frappe_run_bench_command",
  "parameters": {
    "command": "restore /path/to/backup.sql.gz",
    "site": "my-hotel-site.local"
  }
}
```

## 🏗️ App Structure Analysis

### Get App Directory Structure

```json
{
  "tool": "frappe_get_app_structure", 
  "parameters": {
    "app_name": "hotel_management"
  }
}
```

This will return detailed information about:
- DocType definitions
- Module structure  
- Custom scripts
- API endpoints
- Templates and static files

## 💡 Pro Tips

### 1. Batch Operations
You can chain multiple operations together by using the tools sequentially:

1. Create app → Create DocTypes → Create API endpoints → Migrate

### 2. Field Types Reference
Common field types you can use:
- `Data`: Text input
- `Text`: Multiline text
- `Int`: Integer numbers
- `Float`: Decimal numbers  
- `Currency`: Money amounts
- `Date`: Date picker
- `Datetime`: Date and time
- `Link`: Reference to another DocType
- `Select`: Dropdown options
- `Check`: Checkbox (0/1)
- `Table`: Child table
- `Attach`: File upload

### 3. Permissions
Remember to set up proper permissions for your DocTypes after creation using the Frappe UI.

### 4. Validation
Add custom validation logic in the DocType's Python controller file after creation.

## 🐛 Troubleshooting

### Common Issues

1. **Permission Denied**: Make sure the FRAPPE_PATH is correct and accessible
2. **DocType Already Exists**: Check if the DocType name is unique in your app
3. **Invalid Field Type**: Refer to Frappe documentation for valid field types
4. **Site Not Found**: Ensure the site exists and is accessible

### Debug Commands

```json
{
  "tool": "frappe_run_bench_command",
  "parameters": {
    "command": "console",
    "site": "my-hotel-site.local"
  }
}
```

```json
{
  "tool": "frappe_run_bench_command",
  "parameters": {
    "command": "doctor"
  }
}
```

For more examples and advanced usage, check the [main documentation](README.md).