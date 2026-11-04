import assert from 'node:assert/strict';

const base = process.env.CHECK_URL || 'http://localhost:3100';
for (const lang of ['th', 'en']) {
  const response = await fetch(`${base}/${lang}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /JUDY/);
  assert.match(html, /property="og:image" content="[^"]*\/og-judy-v1\.jpg"/);
  assert.match(html, /name="twitter:image" content="[^"]*\/og-judy-v1\.jpg"/);
  assert.doesNotMatch(html, /brand-logo-(?:nav|hero|footer)/);
  assert.match(html, /class="line1">JUDY/);
  assert.match(html, /<body class="dark">/);
  assert.match(html, /class="steps-cards"/);
  assert.match(html, /steps-live\.jpg/);
  assert.doesNotMatch(html, /id="preview"|href="[^"]*\/download|Tikkies Tools/);
  assert.doesNotMatch(html, /AJENT ENTERTAINMENT|AJent Entertainment/);
  const download = await fetch(`${base}/${lang}/download`);
  // Streamed Next.js not-found responses can have status 200; both must be noindex.
  assert.match(await download.text(), /name="robots" content="noindex"/);
}
assert.equal((await fetch(`${base}/app-demo/index.html`)).status, 404);
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
assert.doesNotMatch(sitemap, /\/download/);
console.log('Branding, preserved steps, hidden app routes and sitemap checks passed.');
