/**
 * The Electron GUI Shadow: the whole main-process wiring.
 *
 * This file is illustrative — the example's tests drive the same registry
 * in-process — but it is the complete production shape. One channel, no
 * per-Action IPC allowlist, and confirmation re-asked in the main process so a
 * compromised renderer cannot approve a destructive Action on the human's
 * behalf.
 */

import { attachElectronIpc } from "action-parity-sdk/electron";
import { buildRegistry } from "./core.mjs";

export function wireMainProcess({ ipcMain, dialog, browserWindow }) {
  const registry = buildRegistry();

  const detach = attachElectronIpc(ipcMain, registry, {
    surface: "gui",
    async confirm({ action }) {
      const answer = await dialog.showMessageBox(browserWindow, {
        type: "warning",
        buttons: ["Cancel", action.title],
        defaultId: 0,
        cancelId: 0,
        message: action.title,
        detail: `${action.description}\n\nThis ${action.effects.risk}-risk ${action.effects.class} Action cannot be undone.`
      });
      return answer.response === 1;
    }
  });

  // Audit lives with the core, not with any one Surface.
  registry.on((event) => {
    if (event.type === "action.failed" || event.type === "action.succeeded") {
      process.stderr.write(`${JSON.stringify(event)}\n`);
    }
  });

  return { registry, detach };
}
