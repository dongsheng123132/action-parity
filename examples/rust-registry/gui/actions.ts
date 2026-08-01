import {
  createTauriActionClient,
  type TauriInvoke
} from "../generated/action-client";

/**
 * The only editable Tauri transport bridge in the GUI.
 * Feature code imports ACTION and this client; it never repeats raw Action IDs.
 */
export function createGuiActionClient(invoke: TauriInvoke) {
  return createTauriActionClient(invoke, {
    command: "action_parity_call",
    surface: "gui"
  });
}
