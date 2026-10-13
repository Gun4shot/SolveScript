import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateSeo, siteOrigin } from './seo.mjs';

test('canonical URLs cannot contain credentials, HTTP or a path', () => {
  for (const value of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/studio']) {
    assert.throws(() => siteOrigin(value));
  }
  assert.equal(siteOrigin('https://example.com/'), 'https://example.com');
});

test('builds homepage sitemap and crawlable robots for the actual deployment origin', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'solvescript-seo-'));
  try {
    await fs.writeFile(path.join(directory, 'index.html'), '<html><head></head></html>');
    await generateSeo(directory, 'https://example.com');
    const html = await fs.readFile(path.join(directory, 'index.html'), 'utf8');
    assert.match(html, /rel="canonical" href="https:\/\/example.com\/"/);
    assert.match(html, /"name":"SolveScript"/);
    assert.match(html, /"alternateName":\["Solve Script","example.com"\]/);
    assert.match(html, /"sameAs":\["https:\/\/github.com\/Gun4shot\/SolveScript"\]/);
    assert.match(await fs.readFile(path.join(directory, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/example.com\/<\/loc>/);
    assert.match(await fs.readFile(path.join(directory, 'robots.txt'), 'utf8'), /Disallow: \/api\//);
  } finally {
    for (const name of await fs.readdir(directory)) await fs.unlink(path.join(directory, name));
    await fs.rmdir(directory);
  }
});
