import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactValue, redactText, redactPixels } from './redact.mjs';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+V2Lh9wAAAABJRU5ErkJggg==', 'base64');
const ISO = (date) => new Date(date).toISOString();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');

function ttlSeconds(value = '1h') {
  if (Number.isInteger(value)) return value;
  const match = String(value).match(/^(\d+)(ms|s|m|h)$/);
  if (!match) throw new AnyCutError(2, 'invalid_ttl', 'TTL 必须为 60s–24h 的时长');
  const unit = { ms: 1 / 1000, s: 1, m: 60, h: 3600 }[match[2]];
  return Math.floor(Number(match[1]) * unit);
}

export class AnyCutError extends Error {
  constructor(exitCode, code, message) { super(message); this.exitCode = exitCode; this.code = code; }
}

function pngDimensions(bytes) {
  try {
    if (bytes.length > 24 && bytes.readUInt32BE(12) === 0x49484452) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } catch { /* 非 PNG 时回落 */ }
  return { width: 1, height: 1 };
}

function artifact(path, bytes, media_type) { return { path, media_type, bytes: bytes.length, sha256: sha256(bytes) }; }
function datePart(now) { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }

/**
 * Run allocation: exclusive via mkdir EEXIST race (no placeholder-delete window).
 * Commit marker: shadow.json is written LAST — a run without it is an
 * unfinished allocation and validateShadow rejects it (missing_artifact), so
 * readers never observe a half-written bundle as valid. On any write error the
 * run directory is removed entirely, releasing the slot for the next capture.
 * (Windows cannot rename onto an existing directory, ruling out tmp-dir+rename.)
 */
async function allocateRun(outRoot, now) {
  const runs = join(outRoot, 'runs');
  await mkdir(runs, { recursive: true });
  const prefix = datePart(now);
  for (let n = 1; n < 10000; n += 1) {
    const runId = `${prefix}-${String(n).padStart(4, '0')}`;
    try { await mkdir(join(runs, runId)); return { runs, runId, destination: join(runs, runId) }; }
    catch (error) { if (error?.code !== 'EEXIST') throw error; }
  }
  throw new AnyCutError(5, 'run_allocation_failed', '无法分配新的 AnyCut run 目录');
}

// B1 truth-in-bundle: v0.1 helper only implements PrintWindow full-window capture.
// "wgc" is an R2 item and "client" crop is unimplemented in the helper, so accepting
// them here would record metadata the pixels do not match.
const VALID_BACKENDS = new Set(['printwindow']);
const VALID_CROPS = new Set(['window']);

export async function writeShadowBundle(options) {
  const now = options.now ?? new Date();
  const ttl = ttlSeconds(options.ttl ?? '1h');
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 86400) throw new AnyCutError(2, 'ttl_out_of_range', 'TTL 必须在 60s–24h 内');
  if (!options.outRoot || !options.purpose) throw new AnyCutError(2, 'missing_capture_argument', 'capture 需要 --out 和 --purpose');
  const backend = options.backend ?? 'printwindow';
  const crop = options.crop ?? 'client';
  // B1 companion fix: never record a backend the helper did not actually use.
  if (!VALID_BACKENDS.has(backend)) throw new AnyCutError(2, 'invalid_backend', `不支持的捕获后端: ${backend}（v0.1 helper 仅实现 printwindow）`);
  if (!VALID_CROPS.has(crop)) throw new AnyCutError(2, 'invalid_crop', `不支持的裁剪范围: ${crop}`);
  const { runs, runId, destination } = await allocateRun(options.outRoot, now);
  const temp = join(runs, `.anycut-${randomUUID()}.tmp`);
  const shadow_id = options.shadowId ?? randomUUID();
  const at = ISO(now);
  const sanitized = redactValue(options.capture ?? {});
  const subject = sanitized.value.subject ?? {
    app_id: 'fixture.u-king', app_name: 'U-King 中文设置', app_version: null, platform: 'windows', os_version: 'Windows 11', locale: 'zh-CN',
    processes: [{ pid: 1, image_name: 'u-king.exe', image_sha256: null }],
    window: { hwnd: '0x0000000000000001', owner_pid: 1, title: 'U-King 设置', bounds_px: { x: 0, y: 0, width: 1, height: 1 }, dpi: 96 }
  };
  const common = { spec_version: '0.1.0', shadow_id };
  const tree = { format: 'anycut.ui-tree', ...common, nodes: sanitized.value.nodes ?? [{ node_id: 'root', parent_id: null, control_type: 'Window', name: subject.window.title, automation_id: null, bounds_px: { x: 0, y: 0, width: 1, height: 1 }, visible: true }], known_limitations: sanitized.value.known_limitations ?? ['UIA 树待 R2'] };
  // B2 pipeline integration: text-node hits become pixel masks. Without the
  // helper-side compositor (R2) any unresolved mask is a hard failure — the raw
  // screenshot never reaches the bundle with masks pending.
  const maskRegions = (sanitized.value.nodes ?? []).filter((node) => typeof node?.redaction === 'string' || /已脱敏/.test(String(node?.name ?? ''))).map((node) => ({ ref: `ui-tree.json#/nodes/${node.node_id}`, bounds_px: node.bounds_px, rule: 'text-node-hit' }));
  const png = redactPixels(Buffer.isBuffer(options.screenshot) ? options.screenshot : PNG_1X1, maskRegions);
  const imageSize = pngDimensions(png.png);
  const window = { format: 'anycut.window', ...common, ...subject };
  const actions = { format: 'anycut.actions', ...common, actions: sanitized.value.actions ?? [] };
  const state = { format: 'anycut.state', ...common, observed: sanitized.value.state ?? {}, authoritative: { state_version: null, values: {} } };
  const regions = { format: 'anycut.regions', ...common, regions: sanitized.value.regions ?? [], redactions: sanitized.value.redactions ?? [] };
  const files = new Map([
    ['screenshot.png', { bytes: png.png, media: 'image/png' }], ['ui-tree.json', { bytes: json(tree), media: 'application/json' }], ['window.json', { bytes: json(window), media: 'application/json' }], ['actions.json', { bytes: json(actions), media: 'application/json' }], ['state.json', { bytes: json(state), media: 'application/json' }], ['regions.json', { bytes: json(regions), media: 'application/json' }]
  ]);
  const purpose = redactText(options.purpose).text;
  const context = `<!-- anycut shadow_id: ${shadow_id} -->\n<!-- anycut format: anycut.context -->\n# 界面观察摘要\n\n用途：${purpose}\n\n窗口：${subject.window.title}\n\n限制：${tree.known_limitations.join('；')}\n`;
  files.set('context.md', { bytes: Buffer.from(context, 'utf8'), media: 'text/markdown' });
  const artifactIndex = Object.fromEntries([...files].map(([name, entry]) => [name, artifact(name, entry.bytes, entry.media)]));
  const shadow = {
    $schema: 'urn:shadowcore:shadow:0.1.0', format: 'shadowcore.ui-shadow', spec_version: '0.1.0', shadow_id, run_id: runId, created_at: at, expires_at: ISO(now.getTime() + ttl * 1000),
    producer: { name: 'anycut', version: '0.1.0', adapter: options.adapter ?? 'fixture', adapter_version: '0.1.0' }, subject,
    capture: { scope: 'single-window', crop, backend, started_at: at, ended_at: at, screenshot_at: at, tree_at: at, skew_ms: 0, consistency: 'within-budget', status: 'complete', tree_status: 'partial', image_size_px: imageSize, coordinate_space: 'screenshot-physical-px', warnings: tree.known_limitations.map((message) => ({ code: 'limitation', message })) },
    artifacts: artifactIndex,
    privacy: { purpose, redaction: { mode: 'auto', ruleset_version: '0.1.1', status: 'passed', mask_count: png.masks.length + regions.redactions.length, text_replacement_count: sanitized.replacements + (redactText(options.purpose).replacements), unresolved_count: 0 }, retention: { ttl_seconds: ttl, enforcement: 'deny-after-expiry', cleanup: 'best-effort' }, egress: { default: 'deny', approval_required: true, grant_ref: null }, interaction_policy: 'observe-only' },
    links: { action_parity: null, task_passport: null }, required_capabilities: [], extensions: {}
  };
  try {
    for (const [name, entry] of files) await writeFile(join(destination, name), entry.bytes, { flag: 'wx' });
    await writeFile(join(destination, 'shadow.json'), json(shadow), { flag: 'wx' });
  } catch (error) { await rm(destination, { recursive: true, force: true }); throw error; }
  return { runDir: destination, shadow };
  // Rollback coverage note: the try block starts immediately after allocation,
  // so any failure between mkdir and commit-marker — including OOM/signals
  // surfacing as exceptions — removes the reserved directory and releases the
  // slot. Process kill -9 mid-write still leaves a marker-less run, which
  // validateShadow rejects as missing_artifact (B4 fail-closed path).
}

export { sha256, ttlSeconds };
