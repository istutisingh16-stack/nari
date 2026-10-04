// Dependency-free local preview, with the same routes as production.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const pages = require('../routes.js');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('Invalid URL'); return; }
    let page = pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, '');
    if (!page) page = 'index';
    if (page === 'doctor' || page === 'admin') page += '/index';
    let file;
    if (pages.includes(page)) {
      // Remove a trailing slash before serving HTML, keeping relative assets correct.
      if (pathname.endsWith('/') && pathname !== '/' && pathname !== '/doctor/' && pathname !== '/admin/') {
        res.writeHead(302, { Location: pathname.slice(0, -1) + new URL(req.url, 'http://localhost').search }); res.end(); return;
      }
      if ((page === 'doctor/index' || page === 'admin/index') && pathname === '/' + page.split('/')[0]) {
        res.writeHead(302, { Location: pathname + '/' + new URL(req.url, 'http://localhost').search }); res.end(); return;
      }
      file = path.join(root, page + '.html');
    } else {
      // Serve public assets only; never expose configuration backups or repository internals.
      const relative = pathname.slice(1);
      if (/^(?:assets\/[\w./-]+|[\w-]+\.(?:js|css|ico|txt|xml))$/.test(relative) && !relative.split('/').includes('..')) file = path.join(root, relative);
    }
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(path.join(root, '404.html'))); return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || 5500);
  const server = createServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop Live Server, or run PORT=5501 npm start.` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`NARI preview: http://localhost:${port}/member-login`));
}
module.exports = { createServer };
