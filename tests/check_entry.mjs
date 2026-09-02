import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const readme=read('README.md'),asset='assets/brand/open-web-cta.svg',svg=read(asset);
const primary=readme.match(/<a href="([^"]+)"><img src="assets\/brand\/open-web-cta.svg"[^>]+><\/a>/);
assert.ok(primary,'A large linked Open Web card is the primary entry');
assert.equal(primary[1],'https://evan6007.github.io/skechu-ppt/');
assert.ok(readme.indexOf(asset)<readme.indexOf('releases/latest/download/'),'Web precedes the installer');
assert.ok(!readme.includes('badge/Download_for_Windows'),'Installer must not compete with the primary card');
assert.match(readme,/Get the Windows installer/);
assert.match(svg,/<title[^>]*>Open Web/);
assert.match(svg,/No installation/);
assert.ok(!/<script|foreignObject|(?:href|src)=/i.test(svg),'The entry card is a self-contained static SVG');
assert.ok(readme.includes('Copy to PPT is Windows-only'),'Platform limitations remain explicit');
console.log('Web-first entry OK: primary launch card, correct link, static asset and secondary Windows installer.');
