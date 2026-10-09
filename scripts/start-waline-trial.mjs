import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const trial = path.join(root, 'outputs', 'waline-trial');
const data = path.join(trial, '.data');
const runtime = path.join(trial, 'runtime');
const cachedNode = path.join(trial, 'tools', 'node-v22.23.3-win-x64', 'node.exe');
let node = process.env.WALINE_NODE_PATH || process.execPath;
if (!process.env.WALINE_NODE_PATH && Number(process.versions.node.split('.')[0]) !== 22) {
  try { await access(cachedNode); node = cachedNode; }
  catch { throw new Error('SQLite 本机试用请使用 Node.js 22，或设置 WALINE_NODE_PATH 指向 Node.js 22。'); }
}
try { await access(path.join(runtime, 'node_modules', '@waline', 'vercel', 'index.js')); }
catch {
  throw new Error('请先在 Node.js 22 环境运行：npm install --prefix outputs/waline-trial/runtime --no-save --package-lock=false --no-audit --no-fund @waline/vercel@1.43.4');
}
await mkdir(data, { recursive: true });
try { await copyFile(path.join(root, 'scripts', 'waline', 'empty.sqlite'), path.join(data, 'waline.sqlite'), constants.COPYFILE_EXCL); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
const secretPath = path.join(data, '.jwt-secret');
try { await writeFile(secretPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
const secret = (await readFile(secretPath, 'utf8')).trim();
const systemKeys = new Set([
  'PATH', 'SYSTEMROOT', 'WINDIR', 'SYSTEMDRIVE', 'COMSPEC', 'PATHEXT',
  'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA',
  'LANG', 'LC_ALL', 'TZ',
]);
const systemEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => systemKeys.has(name.toUpperCase())),
);
const child = spawn(node, [path.join(root, 'scripts', 'waline', 'local-server.cjs')], {
  cwd: root, windowsHide: true, stdio: 'inherit',
  env: {
    ...systemEnvironment, NODE_ENV: 'production', SQLITE_PATH: data, SQLITE_DB: 'waline', JWT_TOKEN: secret,
    SITE_NAME: '晴屿 · 本机试用', SITE_URL: 'http://127.0.0.1:4173', SERVER_URL: 'http://127.0.0.1:8360',
    AKISMET_KEY: 'false', COMMENT_AUDIT: 'false', IPQPS: '1',
    DISABLE_USERAGENT: 'true', DISABLE_REGION: 'true', DISABLE_AUTHOR_NOTIFY: 'true',
    MARKDOWN_TEX: 'false', AVATAR_PROXY: 'false',
  },
});
child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.once('close', (code) => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
process.once('exit', () => { if (child.exitCode === null) child.kill(); });
