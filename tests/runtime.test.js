import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, requestUrl } from '../scripts/dev.mjs';

test('Azure requests use the canonical HTTPS origin, not forwarded client headers', () => {
  const req = { url: '/api', headers: { host: 'localhost:8080', 'x-forwarded-proto': 'http', 'x-forwarded-host': 'other.test' } };
  assert.equal(requestUrl(req, { WEBSITE_HOSTNAME: 'rfx.azurewebsites.net' }).href, 'https://rfx.azurewebsites.net/api');
  assert.equal(requestUrl(req, {}).href, 'http://localhost:8080/api');
  assert.equal(requestUrl(req, { PUBLIC_ORIGIN: 'https://rfx.example.com' }).href, 'https://rfx.example.com/api');
});

test('Node runtime serves the worker and accepts same-origin Azure API requests', async t => {
  const server = createServer({ WEBSITE_HOSTNAME: 'rfx.azurewebsites.net' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  await page.arrayBuffer();
  const response = await fetch(base + '/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://rfx.azurewebsites.net' },
    body: JSON.stringify({ action: 'ping', config: { allowLive: false } }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Live AI is disabled/);
  const crossOrigin = await fetch(base + '/api', {
    method: 'POST',
    headers: { origin: 'https://other.test' },
    body: '{}',
  });
  assert.equal(crossOrigin.status, 403);
});
