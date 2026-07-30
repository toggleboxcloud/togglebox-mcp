import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "./client.js";

import { register as registerAccount } from "./tools/account.js";
import { register as registerServices } from "./tools/services.js";
import { register as registerBilling } from "./tools/billing.js";
import { register as registerSupport } from "./tools/support.js";
import { register as registerVms } from "./tools/vms.js";
import { register as registerPower } from "./tools/power.js";
import { register as registerDisks } from "./tools/disks.js";
import { register as registerBackups } from "./tools/backups.js";
import { register as registerVolumes } from "./tools/volumes.js";
import { register as registerNetworking } from "./tools/networking.js";
import { register as registerSecurity } from "./tools/security.js";
import { register as registerSshKeys } from "./tools/ssh-keys.js";
import { register as registerTemplates } from "./tools/templates.js";
import { register as registerConsole } from "./tools/console.js";
import { register as registerStatus } from "./tools/status.js";
import { register as registerBackup } from "./tools/backup.js";
import { register as registerIso } from "./tools/iso.js";
import { register as registerPrivateNetworks } from "./tools/private-networks.js";
import { register as registerRgw } from "./tools/rgw.js";
import { register as registerAuthManagement } from "./tools/auth-management.js";
import { register as registerContacts } from "./tools/contacts.js";
import { register as registerServiceLifecycle } from "./tools/service-lifecycle.js";
import { register as registerContent } from "./tools/content.js";
import { register as registerAccountResources } from "./resources/account.js";
import { register as registerVmResources } from "./resources/vms.js";

export function createServer(client: ToggleboxClient): McpServer {
  const server = new McpServer({
    name: "@toggleboxcloud/togglebox-mcp",
    version: "1.0.0",
  });

  registerAccount(server, client);
  registerServices(server, client);
  registerBilling(server, client);
  registerSupport(server, client);
  registerVms(server, client);
  registerPower(server, client);
  registerDisks(server, client);
  registerBackups(server, client);
  registerVolumes(server, client);
  registerNetworking(server, client);
  registerSecurity(server, client);
  registerSshKeys(server, client);
  registerTemplates(server, client);
  registerConsole(server, client);
  registerStatus(server, client);
  registerBackup(server, client);
  registerIso(server, client);
  registerPrivateNetworks(server, client);
  registerRgw(server, client);
  registerAuthManagement(server, client);
  registerContacts(server, client);
  registerServiceLifecycle(server, client);
  registerContent(server, client);

  registerAccountResources(server, client);
  registerVmResources(server, client);

  return server;
}
