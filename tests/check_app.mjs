import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (!scripts.length) throw new Error('No inline application script found.');

for (const [, source] of scripts) {
  if (source.trim()) new Function(source);
}

const forbidden = [
  /SemaSNN/i,
  /hippocamp/i,
  /Figure\s+[2b]/i,
  /(?:fetch|src|href)\s*[=(]\s*['"]https?:\/\/(?!127\.0\.0\.1|localhost)/i,
];
for (const pattern of forbidden) {
  if (pattern.test(html)) throw new Error(`Forbidden private or remote reference: ${pattern}`);
}

for (const required of ['Sketchou-PPT', 'magnetic-trace', 'merge-selected', 'copy-ppt']) {
  if (!html.includes(required)) throw new Error(`Missing core feature marker: ${required}`);
}

console.log(`Sketchou-PPT app syntax OK (${html.length} characters).`);
