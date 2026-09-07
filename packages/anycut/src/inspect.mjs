import { createHash } from 'node:crypto';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { AnyCutError } from './core.mjs';

const ARTIFACTS = ['screenshot.png', 'ui-tree.json', 'window.json', 'actions.json', 'state.json', 'regions.json', 'context.md'];
const SCHEMA_URL = new URL('../../../schema/shadow.schema.json', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonicalUtc = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value));

let validate;
async function validator() {
  if (validate) return validate;
  const schema = JSON.parse(await readFile(SCHEMA_URL, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
  // Root package deliberately does not enable ajv-formats; Shadow must still
  // enforce its two security-relevant formats without adding a runtime package.
  ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  ajv.addFormat('date-time', { type: 'string', validate: canonicalUtc });
  validate = ajv.compile(schema);
  return validate;
}

/**
 * B3 fix: the run directory is realpath'd ONCE and every artifact is read
 * through that resolved path, so a junction/symlink run dir cannot swap its
 * children for files outside the bundle mid-inspection. Artifacts must be
 * plain files (no symlink leaves) inside the resolved root.
 */
async function resolveRunDir(run) {
  const candidate = resolve(run);
  const stat = await lstat(candidate).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new AnyCutError(6, 'run_not_found', 'Shadow run 不存在');
  return realpath(candidate);
}

async function safeFile(runDir, name) {
  if (basename(name) !== name) throw new AnyCutError(6, 'invalid_artifact_path', 'artifact 路径不允许目录穿越');
  const file = join(runDir, name);
  const stat = await lstat(file).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) throw new AnyCutError(6, 'missing_artifact', `缺失或不安全的 artifact: ${name}`);
  return readFile(file);
}

function semantic(shadow) {
  if (!canonicalUtc(shadow.created_at) || !canonicalUtc(shadow.expires_at) || Date.parse(shadow.expires_at) <= Date.parse(shadow.created_at)) throw new AnyCutError(6, 'invalid_timestamp', '时间必须为有效 UTC RFC 3339，且 expires_at 晚于 created_at');
  if (shadow.privacy.egress.default !== 'deny' || shadow.privacy.egress.approval_required !== true || shadow.privacy.interaction_policy !== 'observe-only') throw new AnyCutError(6, 'unsafe_policy', 'Shadow 安全策略不符合 v0.1');
  // B3 fix: bind the claimed expiry to the declared retention TTL so a
  // hand-edited far-future expires_at cannot extend the shadow's life.
  const lifetimeSeconds = (Date.parse(shadow.expires_at) - Date.parse(shadow.created_at)) / 1000;
  if (lifetimeSeconds !== shadow.privacy.retention.ttl_seconds) throw new AnyCutError(6, 'ttl_binding_mismatch', 'expires_at 与 retention.ttl_seconds 不一致，Shadow 存续期被篡改');
}

export async function validateShadow(run, { now = new Date(), checkExpiry = true } = {}) {
  const runDir = await resolveRunDir(run);
  const shadowBytes = await safeFile(runDir, 'shadow.json');
  let shadow;
  try { shadow = JSON.parse(shadowBytes); } catch { throw new AnyCutError(6, 'invalid_shadow_json', 'shadow.json 不是合法 JSON'); }
  const check = await validator();
  if (!check(shadow)) throw new AnyCutError(6, 'schema_invalid', `Shadow schema 校验失败: ${check.errors.map((item) => item.instancePath || item.message).join('; ')}`);
  semantic(shadow);
  const summaries = {};
  for (const name of ARTIFACTS) {
    const bytes = await safeFile(runDir, name);
    const indexed = shadow.artifacts[name];
    if (!indexed || indexed.path !== name || indexed.bytes !== bytes.length || indexed.sha256 !== hash(bytes)) throw new AnyCutError(6, 'artifact_digest_mismatch', `artifact 摘要不一致: ${name}`);
    summaries[name] = indexed.sha256;
  }
  for (const name of ['ui-tree.json', 'window.json', 'actions.json', 'state.json', 'regions.json']) {
    let side;
    try { side = JSON.parse(await readFile(join(runDir, name), 'utf8')); } catch { throw new AnyCutError(6, 'invalid_sidecar_json', `${name} 不是合法 JSON`); }
    if (side.shadow_id !== shadow.shadow_id || side.spec_version !== '0.1.0' || !String(side.format).startsWith('anycut.')) throw new AnyCutError(6, 'sidecar_identity_mismatch', `${name} 的 Shadow 身份不一致`);
  }
  const context = await readFile(join(runDir, 'context.md'), 'utf8');
  if (!context.includes(`shadow_id: ${shadow.shadow_id}`)) throw new AnyCutError(6, 'context_identity_mismatch', 'context.md 缺少 Shadow 身份');
  if (checkExpiry && Date.parse(shadow.expires_at) <= now.getTime()) throw new AnyCutError(4, 'shadow_expired', 'Shadow 已到期，拒绝使用');
  return { runDir, shadow, summaries };
}

export async function inspectRun(run, options = {}) {
  const validated = await validateShadow(run, options);
  const { shadow, runDir } = validated;
  const section = options.section;
  if (!section) return { shadow_id: shadow.shadow_id, run_id: shadow.run_id, subject: shadow.subject, capture: shadow.capture, privacy: shadow.privacy, artifact_summaries: validated.summaries };
  if (!['tree', 'window', 'actions', 'state', 'regions'].includes(section)) throw new AnyCutError(2, 'invalid_section', '未知 inspect section');
  const file = section === 'tree' ? 'ui-tree.json' : `${section}.json`;
  const content = JSON.parse(await readFile(join(runDir, file), 'utf8'));
  if (options.node) {
    const node = content.nodes?.find((item) => item.node_id === options.node);
    if (!node) throw new AnyCutError(2, 'node_not_found', '指定节点不存在');
    return node;
  }
  return content;
}
