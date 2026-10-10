import { access, chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = '/var/lib/qingyu-waline';
const runtime = path.join(root, 'runtime');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== 22 || minor < 12) throw new Error('Waline SQLite 生产服务需要 Node.js 22.12 或更高的 22.x 版本。');
try { await access(path.join(runtime, 'node_modules', '@waline', 'vercel', 'index.js')); }
catch { throw new Error('请先在 runtime 目录安装本项目使用的 @waline/vercel@1.43.4。'); }

function publicUrl(value, name) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} 必须是无凭据、查询参数或片段的 HTTP(S) 地址。`);
  }
  return url.href.replace(/\/+$/u, '');
}
const siteUrl = publicUrl(process.env.SITE_URL || 'http://linyouwei.top', 'SITE_URL');
// Nginx strips /waline/ before proxying. SERVER_URL retains the public prefix
// so the official dashboard produces /waline/api/ and account links correctly.
const serverUrl = publicUrl(process.env.SERVER_URL || `${siteUrl}/waline`, 'SERVER_URL');

process.umask(0o077);
await mkdir(data, { recursive: true, mode: 0o700 });
await chmod(data, 0o700);
const databasePath = path.join(data, 'waline.sqlite');
try { await copyFile(path.join(root, 'scripts', 'waline', 'empty.sqlite'), databasePath, constants.COPYFILE_EXCL); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
await chmod(databasePath, 0o600);
const secretPath = path.join(data, '.jwt-secret');
try { await writeFile(secretPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
await chmod(secretPath, 0o600);
const secret = (await readFile(secretPath, 'utf8')).trim();
if (!/^[a-f0-9]{64}$/u.test(secret)) throw new Error('持久 JWT 密钥文件格式无效，请检查数据目录中的 .jwt-secret。');

const systemKeys = new Set(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ']);
const systemEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => systemKeys.has(name)),
);
const child = spawn(process.execPath, [path.join(root, 'scripts', 'waline', 'production-server.cjs')], {
  cwd: root, windowsHide: true, stdio: 'inherit',
  env: {
    ...systemEnvironment, NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=128',
    SQLITE_PATH: data, SQLITE_DB: 'waline', JWT_TOKEN: secret,
    SITE_NAME: '晴屿', SITE_URL: siteUrl, SERVER_URL: serverUrl,
    LOGIN: 'enable', AKISMET_KEY: 'false', COMMENT_AUDIT: 'false', IPQPS: '30',
    DISABLE_USERAGENT: 'true', DISABLE_REGION: 'true', DISABLE_AUTHOR_NOTIFY: 'true',
    MARKDOWN_TEX: 'false', AVATAR_PROXY: 'false',
  },
});
child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.once('close', (code, signal) => {
  process.exitCode = code ?? (['SIGINT', 'SIGTERM'].includes(signal) ? 0 : 1);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
process.once('exit', () => { if (child.exitCode === null) child.kill(); });
