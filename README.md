# @toggleboxcloud/togglebox-mcp

This MCP server lets AI agents manage your Togglebox account and cloud infrastructure. It works with Claude Code, Cursor, Windsurf, Codex CLI, Gemini CLI, and similar clients.

## What you can do

- View account details, balances, invoices, and service billing usage.
- List and inspect your services.
- Manage contacts, personal access tokens, service labels, renewals, upgrades, cancellations, and billing cycles.
- View, create, and reply to support tickets.
- View notifications, account logs, news, and knowledgebase content.
- Create, clone, reinstall, resize, and destroy VMs. Manage hostnames and tags.
- Power on, power off, reboot, shut down gracefully, or force power off.
- Manage disks, backups, volumes, and ISOs.
- Manage RGW/S3-compatible object storage buckets, objects, CORS, lifecycle, and usage.
- Manage interfaces, IP aliases, reverse DNS, private networks, and security groups.
- Register, list, delete, and install SSH keys.
- Browse, create, rename, and manage OS templates.
- View and configure automatic backup schedules.
- Check operation status, VM usage metrics, and activity logs.
- Get VNC console access URLs.

## Setup

### 1. Get a Personal Access Token (PAT)

1. Log in to the [Togglebox Management Portal](https://manage.togglebox.com).
2. Go to **Account → API Tokens** (direct link: `https://manage.togglebox.com/?cmd=userapi&action=tokens`).
3. Click **Create Token**, give it a name, and set an optional expiry.
4. Copy the `tbpat_...` value immediately — it is shown only once.
5. Use this value as `TOGGLEBOX_API_TOKEN` in your MCP config.

### 2. Configure your AI agent

#### Claude Code

Run this command in your project directory:

```bash
claude mcp add --scope project --env TOGGLEBOX_API_TOKEN=your-api-token togglebox -- npx @toggleboxcloud/togglebox-mcp
```

Or add this to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "togglebox": {
      "command": "npx",
      "args": ["@toggleboxcloud/togglebox-mcp"],
      "env": {
        "TOGGLEBOX_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

#### Claude Desktop

Add this entry to `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "togglebox": {
      "command": "npx",
      "args": ["@toggleboxcloud/togglebox-mcp"],
      "env": {
        "TOGGLEBOX_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

#### Cursor

Add this entry to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "togglebox": {
      "command": "npx",
      "args": ["@toggleboxcloud/togglebox-mcp"],
      "env": {
        "TOGGLEBOX_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

#### Windsurf

Add this entry to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "togglebox": {
      "command": "npx",
      "args": ["@toggleboxcloud/togglebox-mcp"],
      "env": {
        "TOGGLEBOX_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

#### Codex CLI

Add this entry to `~/.codex/config.toml` for global use or `.codex/config.toml` for project-only use:

```toml
[mcp_servers.togglebox]
command = "npx"
args = ["-y", "@toggleboxcloud/togglebox-mcp"]

[mcp_servers.togglebox.env]
TOGGLEBOX_API_TOKEN = "your-api-token"
```

#### Gemini CLI

Add this entry to `~/.gemini/settings.json` for global use or `.gemini/settings.json` for project-only use:

```json
{
  "mcpServers": {
    "togglebox": {
      "command": "npx",
      "args": ["@toggleboxcloud/togglebox-mcp"],
      "env": {
        "TOGGLEBOX_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

> **Security:** Do not commit your token. Config files like `.mcp.json` and `.cursor/mcp.json` can end up in version control. Prefer injecting `TOGGLEBOX_API_TOKEN` via an environment variable in your shell profile or a secrets manager, and add these config files to `.gitignore` if they contain a token value.
> For lower-risk browsing and reporting workflows, set `TOGGLEBOX_MCP_READ_ONLY=1` so the server rejects mutating API requests even if a write-capable tool is invoked.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TOGGLEBOX_URL` | No | Management portal URL. Defaults to `https://manage.togglebox.com`. Must be an absolute `https://` URL, except localhost HTTP for development. |
| `TOGGLEBOX_API_TOKEN` | No* | Personal Access Token (PAT, format: `tbpat_...`). Generate one at Account → API Tokens in the portal. Preferred over username/password. |
| `TOGGLEBOX_USERNAME` | No* | Login email. Fallback only — use a PAT instead for long-lived integrations. |
| `TOGGLEBOX_PASSWORD` | No* | Login password. Fallback only — use a PAT instead for long-lived integrations. |
| `TOGGLEBOX_ALLOW_INSECURE_HTTP` | No | Set to `1` only for trusted non-production HTTP endpoints that are not localhost. |
| `TOGGLEBOX_MCP_READ_ONLY` | No | Set to `1` or `true` to reject all mutating API requests at runtime. |

\* Set `TOGGLEBOX_API_TOKEN` (preferred) or both `TOGGLEBOX_USERNAME` and `TOGGLEBOX_PASSWORD`.

## Available tools

### Account and billing
- `get_account_details` — Client profile information
- `get_balance` — Account balance and credit
- `list_invoices` / `get_invoice` — Invoice history and details
- `get_billing_summary` / `get_billing_usage` — Service billing summary and usage by period
- `list_services` / `get_service_details` — Service overview

### Authentication and contacts
- `list_personal_access_tokens` / `create_personal_access_token` / `revoke_personal_access_token`
- `logout_current_session` / `revoke_current_auth_token`
- `list_contacts` / `get_contact` / `get_contact_privileges`
- `create_contact` / `update_contact`

### Service lifecycle
- `get_service_methods`
- `get_service_upgrade_options` / `request_service_upgrade`
- `cancel_service` / `renew_service`
- `get_service_label` / `set_service_label`
- `get_service_billing_cycles` / `set_service_billing_cycle`

### Support
- `list_support_tickets` / `get_support_ticket` — View tickets
- `create_support_ticket` / `reply_support_ticket` — Create and reply

### Content and notifications
- `list_notifications` / `list_new_notifications` / `acknowledge_notification`
- `list_user_logs`
- `list_news` / `get_news_item`
- `list_knowledgebase_categories` / `get_knowledgebase_category` / `get_knowledgebase_article`

### Virtual machines
- `list_vms` / `get_vm` / `get_vm_status` — VM information
- `get_vm_tags` / `update_vm_tags` — VM tag management
- `create_vm` / `resize_vm` / `destroy_vm` — VM lifecycle
- `change_vm_hostname` — Rename a VM
- `clone_vm` — Clone a VM to a new copy
- `reset_vm_password` — Reset root password
- `reinstall_vm` — Reinstall from a template

### Power operations
- `poweron_vm` / `shutdown_vm` / `reboot_vm` — Standard power operations
- `poweroff_vm` — Hard power off (immediate, ungraceful)

### Disks
- `list_disks` / `add_disk` / `resize_disk` — Basic disk management
- `detach_disk` / `delete_disk` — Remove disks from a VM
- `set_boot_disk` — Change the boot disk
- `save_disk_as_volume` — Save a disk as a standalone volume

### Backups
- `list_backups` / `create_backup` / `restore_backup` / `delete_backup`
- `create_all_disks_backup` — Back up all disks at once
- `save_backup_as_volume` — Save a backup as a volume
- `draas_storage_backup_save_as_volume` / `draas_storage_backup_restore_disk` — DRaaS Storage operations

### Volumes
- `list_volumes` / `get_volume` / `create_volume` / `delete_volume` / `attach_volume`
- `rename_volume` / `clone_volume` / `toggle_volume_persistent` / `change_volume_type`

### RGW object storage
- `get_rgw_summary` / `get_rgw_credentials` / `rotate_rgw_credentials`
- `get_rgw_sts` / `issue_rgw_sts`
- `list_rgw_buckets` / `create_rgw_bucket` / `delete_rgw_bucket`
- `get_rgw_bucket_cors` / `set_rgw_bucket_cors`
- `set_rgw_bucket_public` / `set_rgw_bucket_encryption` / `set_rgw_bucket_lifecycle`
- `list_rgw_objects` / `delete_rgw_objects` / `create_rgw_folder` / `presign_rgw_object`
- `get_rgw_usage` / `get_rgw_usage_history`

### Networking
- `list_interfaces` / `attach_interface` / `detach_interface` / `swap_interfaces`
- `get_reverse_dns` / `set_reverse_dns` / `clear_reverse_dns`
- `add_ip_alias` / `move_ip_alias` / `delete_ip_alias`

### Security groups
- `list_security_groups` / `get_security_group` — Pool management
- `get_vm_security_groups` / `attach_security_group` / `detach_security_group` — VM-level

### Private networks
- `list_private_networks` / `get_private_network` / `create_private_network` / `delete_private_network`
- `add_network_address_range` / `update_network_address_range` / `delete_network_address_range`
- `update_network_dns` / `update_network_method`

### SSH keys
- `list_ssh_keys` / `add_ssh_key` / `delete_ssh_key` — Key management
- `install_ssh_key` — Install a key on a VM

### Templates
- `list_templates` / `get_template` / `list_template_selector`
- `get_template_tags` / `get_template_vms`
- `rename_template` / `update_template_tags` / `delete_template`
- `save_vm_as_template` — Save a VM as a reusable template

### ISO
- `attach_iso` / `detach_iso` — Virtual CD-ROM management

### Backups
- `get_backup_summary` / `get_backup_schedule`
- `enable_backup_schedule` / `disable_backup_schedule` / `update_backup_schedule`

### Activity and status
- `check_task_status` — Poll queued task status for VM-scoped or service-scoped operations
- `get_vm_operation_status` / `get_service_operation_status` — Poll queued operation status
- `get_vm_usage` — CPU/memory/network usage metrics
- `get_vm_activity` / `get_service_activity` — Activity logs

### Console
- `get_console` — VNC console access URL

## Pagination

Paginated list tools accept `page` to retrieve one page or `all_pages: true` to retrieve and combine every page. Automatic retrieval is limited to 100 pages; for larger result sets, request pages individually.

## Development

```bash
npm test
```

The test suite builds the TypeScript project, exercises API client and pagination behavior, and verifies tool and resource registration through an in-memory MCP connection.

## Safety

Destructive operations are marked with `destructiveHint: true`, so most AI clients will ask for confirmation before running them. That includes VM destruction, disk deletion, backup actions, private network changes, and other irreversible changes.

## License

MIT
