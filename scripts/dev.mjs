import http from 'node:http';
import { pathToFileURL } from 'node:url';
import worker from '../worker/index.js';

export function requestUrl(req, env = process.env) {
  const origin = env.PUBLIC_ORIGIN || (env.WEBSITE_HOSTNAME
    ? 'https://' + env.WEBSITE_HOSTNAME
    : 'http://' + req.headers.host);
  return new URL(req.url, origin);
}

export function createServer(env = process.env) {
  return http.createServer(async (req, res) => {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 18000000) {
          res.writeHead(413, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request exceeds 18 MB' }));
          return;
        }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const response = await worker.fetch(new Request(requestUrl(req, env), {
        method: req.method,
        headers: req.headers,
        ...(body.length ? { body, duplex: 'half' } : {}),
      }), env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('Request failed:', error.message);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'The server could not complete this request.' }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf('--port');
  const port = at >= 0 ? Number(process.argv[at + 1]) : Number(process.env.PORT || 3000);
  const host = process.env.PUBLIC_ORIGIN || process.env.WEBSITE_HOSTNAME ? '0.0.0.0' : '127.0.0.1';
  createServer().listen(port, host, () => console.log(`RFx worker preview on http://${host}:${port}`));
}
