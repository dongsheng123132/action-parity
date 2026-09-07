import { randomUUID } from 'node:crypto';
import { validateShadow } from './inspect.mjs';
import { AnyCutError } from './core.mjs';

const severityRank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
const registry = new Map();

export const builtinAuditor = Object.freeze({
  describe() { return { adapter_api_version: '0.1.0', id: 'builtin', version: '0.1.0', mode: 'local-rules', shadow_versions: ['0.1.0'], modalities: ['text'], network: false, endpoint: null, package_sha256: null }; },
  prepare(input) { return { content_type: 'application/json', bytes: Buffer.from(JSON.stringify({ shadow_id: input.shadow.shadow_id, ruleset: input.ruleset }), 'utf8'), endpoint: null, payload_sha256: null }; },
  normalize(_response, input) { return { status: 'completed', findings: [], shadow_id: input.shadow.shadow_id }; }
});
registry.set('builtin', builtinAuditor);

export function registerAuditor(id, adapter) {
  if (!id || typeof adapter?.describe !== 'function' || typeof adapter?.prepare !== 'function' || typeof adapter?.normalize !== 'function') throw new AnyCutError(2, 'invalid_auditor', 'auditor 必须实现 describe/prepare/normalize');
  registry.set(id, adapter);
}
export function listAuditors() { return [...registry.entries()].map(([id, adapter]) => ({ id, ...adapter.describe() })); }

function builtinFindings(shadow) {
  const findings = [];
  if (shadow.capture.status === 'partial' || shadow.capture.tree_status !== 'complete') findings.push({ id: 'tree-partial', severity: 'medium', category: 'capture-quality', description: '控件树不完整或不可用', evidence_refs: ['shadow.json#/capture'] });
  if (shadow.privacy.redaction.unresolved_count > 0 || shadow.privacy.redaction.status !== 'passed') findings.push({ id: 'redaction-unresolved', severity: 'high', category: 'privacy', description: '存在未决脱敏项', evidence_refs: ['shadow.json#/privacy/redaction'] });
  if (shadow.privacy.egress.grant_ref !== null) findings.push({ id: 'egress-grant-in-bundle', severity: 'high', category: 'policy', description: 'run 中不得携带外传批准', evidence_refs: ['shadow.json#/privacy/egress'] });
  return findings;
}

export async function runAudit({ run, auditor = 'builtin', ruleset = 'builtin-v0.1', failOn = 'high', now }) {
  const adapter = registry.get(auditor);
  if (!adapter) throw new AnyCutError(8, 'auditor_unavailable', '未注册 auditor');
  const validated = await validateShadow(run, { now });
  const input = Object.freeze({ shadow: validated.shadow, artifact_summaries: validated.summaries, ruleset, evidence_index: Object.keys(validated.summaries) });
  const findings = auditor === 'builtin' ? builtinFindings(validated.shadow) : [];
  const report = { report_id: randomUUID(), shadow_id: validated.shadow.shadow_id, input_sha256: Object.values(validated.summaries).join(':'), adapter: adapter.describe(), ruleset, status: 'completed', findings, confidence: null, limitations: [], created_at: new Date().toISOString(), token_usage: null, cost: null };
  const threshold = severityRank[failOn];
  if (threshold === undefined) throw new AnyCutError(2, 'invalid_fail_on', '未知 fail-on severity');
  return { report, exitCode: findings.some((item) => severityRank[item.severity] >= threshold) ? 7 : 0 };
}
