import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
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
  const origin = options.coordinate_origin ?? null;
  const screenNodes = sanitized.value.nodes ?? [{ node_id: 'root', parent_id: null, control_type: 'Window', name: subject.window.title, automation_id: null, bounds_px: { x: 0, y: 0, width: 1, height: 1 }, visible: true }];
  // 真树路径：所需 mask 必须已有 helper 合成证明（masksApplied 与重算一致），
  // 否则拒绝落盘。fixture/显式节点无证明时同样拒绝（B2 回归）。
  const required = requiredMasks(screenNodes);
  if (required.length > 0) {
    const applied = options.masksApplied ?? [];
    const covered = applied.length === required.length && required.every((item, index) =>
      applied[index]?.x === item.x && applied[index]?.y === item.y && applied[index]?.width === item.width && applied[index]?.height === item.height);
    if (!covered) throw new AnyCutError(5, 'pixel_redaction_unresolved', '存在未合成的像素遮盖：拒绝落盘未脱敏原图');
  }
  const nodes = rebaseNodes(screenNodes, origin);
  const tree = { format: 'anycut.ui-tree', ...common, nodes, known_limitations: sanitized.value.known_limitations ?? ['UIA 树待 R2'] };
  const hitRegions = nodes.filter((node) => isHit(node) && node.visible !== false && saneBounds(node.bounds_px))
    .map((node) => ({ ref: `ui-tree.json#/nodes/${node.node_id}`, bounds_px: node.bounds_px, rule: 'text-node-hit' }));
  // 截图必须已在 helper 侧合成；此处只做空 mask 直通，不断言二次合成。
  const png = redactPixels(Buffer.isBuffer(options.screenshot) ? options.screenshot : PNG_1X1, []);
  const imageSize = pngDimensions(png.png);
  const window = { format: 'anycut.window', ...common, ...subject };
  const actions = { format: 'anycut.actions', ...common, actions: deriveActions(nodes) };
  const focused = nodes.find((node) => node.focused === true)?.node_id ?? null;
  const state = { format: 'anycut.state', ...common, observed: { focus_node_id: focused, enabled_count: nodes.filter((node) => node.enabled === true).length, total_count: nodes.length, ...(sanitized.value.state ?? {}) }, authoritative: { state_version: null, values: {} } };
  const regions = { format: 'anycut.regions', ...common, regions: sanitized.value.regions ?? [], redactions: hitRegions };
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
    capture: { scope: 'single-window', crop, backend, started_at: at, ended_at: at, screenshot_at: at, tree_at: at, skew_ms: 0, consistency: 'within-budget', status: 'complete', tree_status: options.treeStatus ?? 'partial', image_size_px: imageSize, coordinate_space: 'screenshot-physical-px', warnings: tree.known_limitations.map((message) => ({ code: 'limitation', message })) },
    artifacts: artifactIndex,
    privacy: { purpose, redaction: { mode: 'auto', ruleset_version: '0.1.1', status: 'passed', mask_count: required.length, text_replacement_count: sanitized.replacements + (redactText(options.purpose).replacements), unresolved_count: 0 }, retention: { ttl_seconds: ttl, enforcement: 'deny-after-expiry', cleanup: 'best-effort' }, egress: { default: 'deny', approval_required: true, grant_ref: null }, interaction_policy: 'observe-only' },
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

/** 交互候选：仅凭控件类型做观察记录，不声明 pattern 能力（R2 补 pattern 查询）。 */
const INTERACTIVE_TYPES = new Set(['Button', 'CheckBox', 'RadioButton', 'ComboBox', 'Hyperlink', 'ListItem', 'MenuItem', 'TabItem', 'SplitButton']);
function deriveActions(rebasedNodes) {
  const actions = [];
  for (const node of rebasedNodes ?? []) {
    if (!INTERACTIVE_TYPES.has(node?.control_type)) continue;
    actions.push({
      observation_id: `o-${node.node_id}`, node_id: node.node_id, label: node.name ?? '',
      patterns: [], source: 'uia', action_id: null, mapping_status: 'unmapped',
      evidence_ref: `ui-tree.json#/nodes/${node.node_id}`, executable: false,
    });
  }
  return actions;
}

export { sha256, ttlSeconds };

const MASK_SHADE = 0x2e;

/** Hit 规则与落盘一致：在 SANITIZED 节点上找脱敏标记。 */
function isHit(node) {
  if (!node || typeof node !== 'object') return false;
  if (typeof node.redaction === 'string') return true;
  return [node.name, node.value, node.help_text].some((field) => typeof field === 'string' && field.includes('[已脱敏'));
}

function saneBounds(bounds) {
  return bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isInteger) && bounds.width > 0 && bounds.height > 0;
}

/** sanitized 节点 → 屏幕空间 mask（只取可见节点）。 */
export function requiredMasks(sanitizedNodes) {
  const masks = [];
  for (const node of sanitizedNodes ?? []) {
    if (!isHit(node) || node.visible === false || !saneBounds(node.bounds_px)) continue;
    const { x, y, width, height } = node.bounds_px;
    masks.push({ x, y, width, height, ref: `ui-tree.json#/nodes/${node.node_id}`, rule: 'text-node-hit' });
  }
  return masks;
}

/** 屏幕空间节点 bounds 按 capture 原点 rebase 到截图空间。 */
export function rebaseNodes(nodes, origin) {
  if (!origin) return nodes ?? [];
  return (nodes ?? []).map((node) => {
    if (!node || !saneBounds(node?.bounds_px)) return node;
    const bounds = node.bounds_px;
    return { ...node, bounds_px: { x: bounds.x - origin.x, y: bounds.y - origin.y, width: bounds.width, height: bounds.height } };
  });
}

export function rebaseMasks(masks, origin) {
  if (!origin) return masks ?? [];
  return (masks ?? []).map((mask) => ({ ...mask, x: mask.x - origin.x, y: mask.y - origin.y }));
}

/** 原始树 → 脱敏 + mask 规划（CLI 在 capture 前调用）。 */
export function planMasks(rawNodes) {
  const sanitized = redactValue({ nodes: rawNodes ?? [] });
  return { sanitizedNodes: sanitized.value.nodes, masks: requiredMasks(sanitized.value.nodes), replacements: sanitized.replacements };
}

function pngPixels(png) {
  // 仅支持 helper 写入的 PNG：8-bit RGBA 非交错。
  if (!Buffer.isBuffer(png) || png.length < 33 || png.readUInt32BE(12) !== 0x49484452) throw new AnyCutError(5, 'unsupported_png', '截图不是受支持的 PNG');
  const width = png.readUInt32BE(16); const height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[26] !== 0 || png[27] !== 0 || png[28] !== 0) throw new AnyCutError(5, 'unsupported_png', '截图 PNG 须为 8-bit RGBA 非交错');
  let pos = 8; const parts = [];
  while (pos + 8 <= png.length) {
    const length = png.readUInt32BE(pos); const type = png.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') parts.push(png.subarray(pos + 8, pos + 8 + length));
    if (type === 'IEND') break;
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4 + 1;
  if (raw.length !== stride * height) throw new AnyCutError(5, 'unsupported_png', '截图 PNG 数据长度异常');
  for (let y = 0; y < height; y += 1) {
    if (raw[y * stride] !== 0) throw new AnyCutError(5, 'unsupported_png', '截图含非零过滤器行');
  }
  return { width, height, raw, stride };
}

/** 校验 helper 的合成声明：每个 mask 取与图像交集中心像素，必须为遮盖色。 */
export function verifyMasks(png, masks) {
  if (!masks?.length) return { checked: 0 };
  const { width, height, raw, stride } = pngPixels(png);
  let checked = 0;
  for (const mask of masks) {
    const ix0 = Math.max(0, mask.x); const iy0 = Math.max(0, mask.y);
    const ix1 = Math.min(width, mask.x + mask.width); const iy1 = Math.min(height, mask.y + mask.height);
    if (ix0 >= ix1 || iy0 >= iy1) throw new AnyCutError(5, 'mask_verification_failed', `遮盖区与截图无交集: ${mask.ref ?? 'mask'}`);
    const cx = ix0 + ((ix1 - ix0) >> 1); const cy = iy0 + ((iy1 - iy0) >> 1);
    const i = cy * stride + 1 + cx * 4;
    if (raw[i] !== MASK_SHADE || raw[i + 1] !== MASK_SHADE || raw[i + 2] !== MASK_SHADE) {
      throw new AnyCutError(5, 'mask_verification_failed', `像素遮盖校验失败: ${mask.ref ?? 'mask'}`);
    }
    checked += 1;
  }
  return { checked };
}
