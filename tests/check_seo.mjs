import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = 'https://evan6007.github.io/skechu-ppt/';
const html = read('app/index.html'), about = read('app/about.html');
const pageSources = [html, about];
const urls = [base, base + 'about.html'];
for (const [index, page] of pageSources.entries()) {
  assert.match(page, /<html lang="zh-Hant"/);
  assert.match(page, /<title>Skechu[^<]+(?:描圖|描圖工具)/);
  assert.equal((page.match(/<link rel="canonical"/g) || []).length, 1);
  assert.ok(page.includes(`<link rel="canonical" href="${urls[index]}">`));
  const description = page.match(/<meta name="description" content="([^"\n]+)">/)?.[1];
  assert.ok(description?.includes('Skechu') && description.length >= 50 && description.length <= 250);
  assert.equal((page.match(/<h1\b/g) || []).length, 1);
  assert.ok(!/<meta[^>]+(?:noindex|name="keywords")/i.test(page));
  assert.ok(!/<meta[^>]+http-equiv="refresh"/i.test(page));
}
const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.equal(schema['@type'], 'SoftwareApplication');
assert.equal(schema.name, 'Skechu-PPT');
assert.equal(schema.alternateName, 'Skechu');
assert.equal(schema.url, base);
assert.equal(schema.isAccessibleForFree, true);
assert.equal(schema.sameAs, 'https://github.com/evan6007/skechu-ppt');
assert.ok(!schema.aggregateRating && !schema.review, 'Do not invent reviews to qualify for rich results');
assert.ok(html.includes('class="about-link" href="about.html" target="_blank" rel="noopener"'), 'A crawlable help link preserves the working project');
assert.ok(about.includes('href="./"'), 'Guide links back to the existing editor');
assert.ok(!about.includes('<script'), 'Guide content is present without JavaScript');
for (const feature of ['磁吸', '自動描圖', 'T 字', 'Windows', 'PowerPoint', 'MIT', '本機 MCP']) assert.ok(about.includes(feature));
for (const page of ['web-ppt.html', 'github-callback.html']) assert.match(read('app/' + page), /<meta name="robots" content="noindex">/);
const sitemap = read('app/sitemap.xml');
assert.match(sitemap, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), urls);
for (const url of urls) {const parsed = new URL(url); assert.equal(parsed.search, ''); assert.equal(parsed.hash, '');}
assert.ok(read('app/service-worker.js').includes("'./about.html'"));
assert.ok(read('.github/workflows/windows-release.yml').includes('app/about.html;.'));
assert.ok(read('README.md').includes(base + 'about.html'));
console.log('Search discovery OK: canonical pages, crawlable help, real application metadata, noindex helpers, offline/package parity.');
