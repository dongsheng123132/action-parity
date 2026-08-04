import { ACTION, createActionClient, type ActionId } from "../generated/action-client";

/**
 * The only editable transport bridge in the renderer. Feature code imports
 * ACTION and this client; it never repeats a raw Action ID string.
 *
 * `window.actions.call` is what the preload script exposes:
 *
 *   import { createRendererClient } from "action-parity-sdk/electron";
 *   contextBridge.exposeInMainWorld("actions", {
 *     call: createRendererClient(ipcRenderer),
 *     catalog: () => ipcRenderer.invoke("action-parity:catalog")
 *   });
 */
declare global {
  interface Window {
    actions: {
      call(request: unknown): Promise<unknown>;
      catalog(): Promise<{ actions: Array<{ id: string; title: string }> }>;
    };
  }
}

export const call = createActionClient(
  (request) => window.actions.call(request),
  { surface: "gui" }
);

/**
 * Render one control per Action, labelled with the stable automation ID the
 * Manifest binds to. A parity check can then answer "which Action is this
 * button wired to" by reading the DOM, without comparing screenshots.
 */
export async function renderActionBar(root: HTMLElement): Promise<void> {
  const catalog = await window.actions.catalog();
  for (const action of catalog.actions) {
    const button = document.createElement("button");
    button.dataset.actionId = action.id; // data-action-id={action_id}
    button.textContent = action.title;
    root.append(button);
  }
}

export async function createTask(title: string) {
  const envelope = await call(ACTION.TASK_CREATE, { title });
  if (!envelope.ok) throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  return envelope.result.task;
}

export const PURGE: ActionId = ACTION.TASK_PURGE;
