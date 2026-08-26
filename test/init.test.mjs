import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, symlinkSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { initializeProject } from "../src/init.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdkDirectory = path.join(repositoryRoot, "sdk", "node");

async function makeProject() {
  return mkdtemp(path.join(os.tmpdir(), "ap-init-"));
}

test("init writes an Electron starter with one registry and two forwarding shadows", async () => {
  const root = await makeProject();
  try {
    const command = await spawnNode(
      [path.join(repositoryRoot, "bin", "action-parity.mjs"), "init", root, "--name", "Notes", "--json"],
      root
    );
    assert.equal(command.code, 0, command.stderr);
    const result = JSON.parse(command.stdout).data;
    assert.equal(result.ok, true);
    assert.deepEqual(result.files.map((file) => file.status), ["written", "written", "written"]);
    assert.match(await readFile(path.join(root, "app", "actions.mjs"), "utf8"), /defineAction/);
    assert.match(await readFile(path.join(root, "app", "cli.mjs"), "utf8"), /createCliRunner/);
    assert.match(await readFile(path.join(root, "app", "electron-main.mjs"), "utf8"), /attachElectronIpc/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("init preserves existing starter files without --force", async () => {
  const root = await makeProject();
  try {
    await initializeProject({ targetDirectory: root });
    const actionsPath = path.join(root, "app", "actions.mjs");
    const original = await readFile(actionsPath, "utf8");
    const changed = `${original}// preserved by test\n`;
    await writeFile(actionsPath, changed, "utf8");

    const result = await initializeProject({ targetDirectory: root });
    assert.deepEqual(result.files.map((file) => file.status), ["skipped", "skipped", "skipped"]);
    assert.equal(await readFile(actionsPath, "utf8"), changed);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("init overwrites starter files with --force", async () => {
  const root = await makeProject();
  try {
    await initializeProject({ targetDirectory: root });
    await writeFile(path.join(root, "app", "actions.mjs"), "// changed\n", "utf8");
    const result = await initializeProject({ targetDirectory: root, force: true });
    assert.deepEqual(result.files.map((file) => file.status), ["written", "written", "written"]);
    assert.match(await readFile(path.join(root, "app", "actions.mjs"), "utf8"), /defineAction/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the generated CLI executes note.list and exposes all three Actions as JSON", async () => {
  const root = await makeProject();
  try {
    await initializeProject({ targetDirectory: root });
    linkSdk(root);
    const noteResult = await spawnNode([path.join(root, "app", "cli.mjs"), "note.list", "--json"], root);
    assert.equal(noteResult.code, 0, noteResult.stderr);
    assert.equal(JSON.parse(noteResult.stdout).ok, true);

    const catalogResult = await spawnNode([path.join(root, "app", "cli.mjs"), "list", "--json"], root);
    assert.equal(catalogResult.code, 0, catalogResult.stderr);
    const output = JSON.parse(catalogResult.stdout);
    assert.equal(output.ok, true);
    assert.deepEqual(output.actions.map((action) => action.id), ["note.create", "note.delete", "note.list"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function linkSdk(root) {
  const nodeModules = path.join(root, "node_modules");
  const destination = path.join(nodeModules, "action-parity-sdk");
  mkdirSync(nodeModules);
  try {
    symlinkSync(sdkDirectory, destination, process.platform === "win32" ? "junction" : "dir");
  } catch {
    cpSync(sdkDirectory, destination, { recursive: true });
  }
}

function spawnNode(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
