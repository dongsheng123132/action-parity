/** v0.1 deterministic, UTF-8-safe redaction. Raw values must never be written. */
const RULES = [
  ['private-key-block', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ['bearer', /\bBearer\s+[A-Za-z0-9._~-]{8,}\b/gi],
  ['api-key', /\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g],
  ['labelled-secret', /(?:api[ _-]?key|access[ _-]?token|refresh[ _-]?token|password|passwd|secret|验证码|口令|密码|密钥|令牌|私钥)\s*[:=：]\s*[^\s,，;；"']+/gi],
  ['label-bare-value', /(?:API[ _-]?Key|Access[ _-]?Token|Password|Secret|验证码|口令|密码|密钥|令牌|私钥)[：:]\s*[^\s,，;；"']+/g],
  ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
  ['cn-mobile', /\b1[3-9]\d{9}\b/g],
  ['cn-id', /\b\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g],
  ['conn-string', /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqps?|mssql):\/\/[^\s"']+/gi],
  ['test-secret', /测试(?:API)?(?:密钥|key)[A-Za-z0-9_-]*/gi]
];

const ORDER = ['private-key-block', 'jwt', 'bearer', 'api-key', 'test-secret', 'conn-string', 'cn-id', 'labelled-secret', 'label-bare-value', 'email', 'cn-mobile'];

export function redactText(value) {
  let text = String(value ?? '');
  let replacements = 0;
  for (const id of ORDER) {
    const rule = RULES.find(([ruleId]) => ruleId === id);
    text = text.replace(rule[1], () => { replacements += 1; return `[已脱敏:${rule[0]}]`; });
  }
  return { text, replacements, ruleset_version: '0.1.1' };
}

export function redactValue(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) {
    let replacements = 0;
    const sanitized = value.map((item) => { const result = redactValue(item); replacements += result.replacements; return result.value !== undefined ? result.value : result.text; });
    return { value: sanitized, replacements };
  }
  if (value && typeof value === 'object') {
    let replacements = 0;
    const sanitized = {};
    for (const [key, item] of Object.entries(value)) {
      const result = /(?:password|secret|token|api.?key|密码|密钥|令牌)/i.test(key)
        ? { value: '[已脱敏:secret-field]', replacements: 1 }
        : redactValue(item);
      sanitized[key] = result.value !== undefined ? result.value : result.text;
      replacements += result.replacements;
    }
    return { value: sanitized, replacements };
  }
  return { value, replacements: 0 };
}

/**
 * Pixel redaction boundary. Masks are opaque solid rectangles composited into the
 * PNG by the Rust helper before the frame ever leaves the helper process; the raw
 * unredacted image is deliberately never retained anywhere. Until the helper-side
 * compositor lands (R2), an unresolved mask is a hard failure — never a silent
 * passthrough of the raw image.
 */
export function redactPixels(png, masks = []) {
  if (!Buffer.isBuffer(png)) throw new TypeError('png must be a Buffer');
  if (masks.length > 0) throw Object.assign(new Error('存在待遮盖像素区域，但 helper 像素合成器尚未落地（R2）；拒绝落盘未脱敏原图'), { code: 'pixel_redaction_unresolved' });
  return { png, masks: [], unresolved_count: masks.length };
}
