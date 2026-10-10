const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const runtimeRequire = createRequire(path.join(root, 'runtime/package.json'));
const Waline = runtimeRequire('@waline/vercel');

// Waline 1.43.4 fetches remote OAuth providers before every request. Override
// only that entry through ThinkJS's middleware factory configuration, before
// Waline loads the chain. Email/password, JWT and administrator checks stay intact.
const middlewares = runtimeRequire('@waline/vercel/src/config/middleware.js');
const oauthIndex = middlewares.findIndex((entry) => entry.handle === 'fetch-oauth-service');
if (oauthIndex === -1) throw new Error('当前 Waline 版本的 OAuth 中间件配置与生产启动器不匹配。');
middlewares[oauthIndex] = {
  ...middlewares[oauthIndex],
  handle: () => async (ctx, next) => {
    ctx.state.oauthServices = [];
    await next();
  },
};

// Check the resolved REST action, including ThinkJS aliases and method overrides,
// before logic/controllers can register the first user as administrator.
const logicIndex = middlewares.findIndex((entry) => entry === 'logic' || entry.handle === 'logic');
if (logicIndex < 1 || middlewares[logicIndex - 1].handle !== runtimeRequire('think-router-rest')) {
  throw new Error('当前 Waline 版本的 REST/logic 中间件顺序与注册保护不匹配。');
}
middlewares.splice(logicIndex, 0, {
  handle: () => async (ctx, next) => {
    if (ctx.controller === 'oauth') {
      ctx.status = 404;
      ctx.body = { errno: 404, errmsg: 'OAuth 登录未启用' };
      return;
    }
    if (ctx.controller === 'user' && ctx.action === 'post') {
      // Nginx must overwrite X-Real-IP with $remote_addr. Direct access to this
      // loopback-only listener falls back to the socket's peer address.
      const sourceIp = ctx.get('x-real-ip') || ctx.req.socket.remoteAddress;
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(sourceIp)) {
        ctx.status = 403;
        ctx.body = { errno: 403, errmsg: '仅允许在服务器本机注册账号' };
        return;
      }
    }
    await next();
  },
});

const handler = Waline({
  secureDomains: /^(?:www\.)?linyouwei\.top$/u,
  avatarUrl: () => `${process.env.SITE_URL}/assets/section-wash.svg`,
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
    if (!response.writableEnded) response.end(JSON.stringify({ errno: 500, errmsg: '留言服务暂时不可用' }));
  });
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? '8360 端口已占用，请先确认正在运行的留言服务。' : error.message);
  process.exitCode = 1;
});
server.listen(8360, '127.0.0.1', () => console.log('Waline 生产服务已监听 127.0.0.1:8360'));
