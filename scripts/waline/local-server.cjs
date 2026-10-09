const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const runtimeRequire = createRequire(path.join(root, 'outputs/waline-trial/runtime/package.json'));
const Waline = runtimeRequire('@waline/vercel');
const handler = Waline({
  secureDomains: ['localhost', '127.0.0.1'],
  avatarUrl: () => 'http://127.0.0.1:4173/assets/section-wash.svg',
  model(name, controller) {
    if (name !== 'Comment') return;
    const storage = controller.service(`storage/${controller.config('storage')}`, name);
    const model = Object.create(storage);
    model.update = (data, where) => {
      // Core 0.1.0 adds comment: undefined to anonymous like updates. The SQL
      // write omits it, but the returned record loses the text and fails Markdown rendering.
      if (data && typeof data === 'object' && data.comment === undefined && typeof data.like === 'number') {
        const { comment, ...likeData } = data;
        return storage.update(likeData, where);
      }
      return storage.update(data, where);
    };
    return model;
  },
});
const server = http.createServer((request, response) => {
  Promise.resolve(handler(request, response)).catch(() => {
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' });
    if (!response.writableEnded) response.end(JSON.stringify({ errno: 500, errmsg: '本机留言服务暂时不可用' }));
  });
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? '8360 端口已占用，请先确认正在运行的留言服务。' : error.message);
  process.exitCode = 1;
});
server.listen(8360, '127.0.0.1', () => console.log('Waline 本机试用：http://127.0.0.1:8360 · 数据保存在 outputs/waline-trial/.data'));
