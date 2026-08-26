import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SUPPORTED_FLAVORS = new Set(["electron"]);

export async function initializeProject(options = {}) {
  const target = path.resolve(options.targetDirectory ?? process.cwd());
  const flavor = options.flavor ?? "electron";
  if (!SUPPORTED_FLAVORS.has(flavor)) {
    throw new Error(`Unsupported flavor ${flavor}. Supported flavors: electron.`);
  }

  const name = options.name ?? path.basename(target);
  const force = options.force === true;
  const files = electronFiles(name);
  await mkdir(path.join(target, "app"), { recursive: true });

  const results = [];
  for (const file of files) {
    const destination = path.join(target, file.path);
    if (!force && (await exists(destination))) {
      results.push({ path: file.path, status: "skipped" });
      continue;
    }
    await writeFile(destination, file.content, "utf8");
    results.push({ path: file.path, status: "written" });
  }

  return {
    ok: true,
    target,
    flavor,
    files: results,
    next_steps: [
      "npm i action-parity-sdk",
      "node app/cli.mjs note.list --json",
      "node app/cli.mjs note.create --title x --json"
    ]
  };
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function electronFiles(name) {
  const applicationName = JSON.stringify(name);
  return [
    {
      path: "app/actions.mjs",
      content: `import { createRegistry, defineAction, defineSurface, s } from "action-parity-sdk";

const notes = new Map();
let nextNoteId = 1;

const note = s.object({
  id: s.string(),
  title: s.string()
});

export const registry = createRegistry({
  application: {
    id: "action-parity-starter",
    name: ${applicationName},
    version: "0.1.0"
  },
  surfaces: [
    defineSurface({ id: "cli", kind: "cli", bindingTarget: "app/cli.mjs {action_id} --json" }),
    defineSurface({ id: "gui", kind: "gui", bindingTarget: "data-action-id={action_id}" })
  ]
});

registry.registerAll([
  defineAction({
    id: "note.list",
    title: "List notes",
    description: "List notes stored by this starter application.",
    effects: "read",
    input: s.object({}),
    output: s.object({ notes: s.array(note) }),
    handler: () => ({ notes: [...notes.values()] })
  }),
  defineAction({
    id: "note.create",
    title: "Create note",
    description: "Create one in-memory note.",
    effects: { class: "write", risk: "low" },
    input: s.object({ title: s.string({ minLength: 1 }) }),
    output: note,
    handler: ({ title }) => {
      const created = { id: String(nextNoteId++), title };
      notes.set(created.id, created);
      return created;
    }
  }),
  defineAction({
    id: "note.delete",
    title: "Delete note",
    description: "Delete one in-memory note after explicit confirmation.",
    effects: { class: "write", risk: "high", confirmation: "always" },
    input: s.object({ id: s.string({ minLength: 1 }) }),
    output: s.object({ id: s.string(), deleted: s.boolean() }),
    handler: ({ id }) => ({ id, deleted: notes.delete(id) })
  })
]);
`
    },
    {
      path: "app/cli.mjs",
      content: `import { createCliRunner } from "action-parity-sdk/cli";
import { registry } from "./actions.mjs";
await createCliRunner(registry, { name: ${applicationName} }).main();
`
    },
    {
      path: "app/electron-main.mjs",
      content: `import { app, BrowserWindow, ipcMain } from "electron";
import { attachElectronIpc } from "action-parity-sdk/electron";
import { registry } from "./actions.mjs";

app.whenReady().then(() => {
  attachElectronIpc(ipcMain, registry);
  const window = new BrowserWindow({ width: 900, height: 640 });
  window.loadFile("index.html");
  // In index.html, expose a preload client then call window.actions.call("note.list", {}).
});
`
    }
  ];
}
