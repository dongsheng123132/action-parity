import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const forbiddenText = [
  { pattern: /src-tauri[\\/]/i, reason: "internal source path" },
  { pattern: /(?:^|[^a-z])actions\.rs(?:$|[^a-z])/i, reason: "internal source filename" },
  { pattern: /action_cli\.rs/i, reason: "internal source filename" },
  { pattern: /device\.json/i, reason: "internal state filename" },
  { pattern: /UKING_TEST_KEY/i, reason: "test-secret identifier" },
  { pattern: /(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?(?:sk-|eyJ|AKIA|[A-Za-z0-9_-]{24,})/i, reason: "credential-like value" }
];
const forbiddenPropertyNames = new Set(["api_key", "apikey", "access_token", "refresh_token", "password", "secret", "private_key"]);

function findForbiddenProperty(value, pointer = "") {
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenProperty(item, `${pointer}/${index}`));
  if (!value || typeof value !== "object") return [];
  const findings = [];
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${key}`;
    if (forbiddenPropertyNames.has(key.toLowerCase())) findings.push(`${childPointer} contains forbidden credential property '${key}'`);
    findings.push(...findForbiddenProperty(child, childPointer));
  }
  return findings;
}

export function auditPublicPilot(manifest, publicDocuments) {
  const failures = [];
  for (const { name, text } of publicDocuments) {
    for (const { pattern, reason } of forbiddenText) {
      if (pattern.test(text)) failures.push(`${name} exposes ${reason}`);
    }
  }
  for (const finding of findForbiddenProperty(manifest)) {
    failures.push(`examples/u-king/action-parity.json ${finding}`);
  }
  return failures;
}

async function main() {
  const root = process.cwd();
  const manifestPath = path.join(root, "examples", "u-king", "action-parity.json");
  const documentPaths = [
    manifestPath,
    path.join(root, "docs", "U-KING-PILOT.md"),
    path.join(root, "docs", "PILOT-RESULTS.md")
  ];
  const publicDocuments = await Promise.all(documentPaths.map(async (file) => ({
    name: path.relative(root, file),
    text: await readFile(file, "utf8")
  })));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const failures = auditPublicPilot(manifest, publicDocuments);

  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`${failure}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("U-King public pilot disclosure check passed.\n");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
