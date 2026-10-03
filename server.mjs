import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.ico', 'image/x-icon'],
]);
const portArg = process.argv[2];
const port = portArg === undefined ? 4173 : Number(portArg);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('端口必须是 1 到 65535 之间的整数。');
  process.exit(1);
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed');
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad Request'); return; }
  if (pathname.includes('\0') || pathname.includes('\\')) {
    response.writeHead(400).end('Bad Request');
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (relative.split('/').some((segment) => segment.startsWith('.'))) {
    response.writeHead(404).end('Not Found');
    return;
  }
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) { response.writeHead(404).end('Not Found'); return; }
    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(path.extname(target).toLowerCase()) ?? 'application/octet-stream',
      'Content-Length': body.byteLength,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') response.writeHead(404).end('Not Found');
    else { console.error(error); response.writeHead(500).end('Internal Server Error'); }
  }
});

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`风笺预览已启动：http://localhost:${address.port}`);
});
