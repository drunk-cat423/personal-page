#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const SITE_URL = 'https://linyouwei.top/';
const STATIC_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp',
  '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm',
  '.txt', '.md',
]);
const HELP = `Usage: node package_release.mjs --repo <path> --tag <vYYYY.MM.DD-N> --previous <basename> --out <empty-dir> [--commit <ref>] [--repository <owner/repo>] [--help]

Packages static files from a committed Git snapshot. It never commits, pushes, connects over SSH, or deploys.
`;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--help') return { help: true };
    if (!['--repo', '--tag', '--previous', '--out', '--commit', '--repository'].includes(key)) {
      fail(`未知参数: ${key}`);
    }
    if (values.has(key)) fail(`参数重复: ${key}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`参数 ${key} 缺少值`);
    values.set(key, value);
    i += 1;
  }
  for (const required of ['--repo', '--tag', '--previous', '--out']) {
    if (!values.has(required)) fail(`缺少必需参数: ${required}`);
  }
  return {
    repo: path.resolve(values.get('--repo')),
    tag: values.get('--tag'),
    previous: values.get('--previous'),
    out: path.resolve(values.get('--out')),
    commit: values.get('--commit') ?? 'HEAD',
    repository: values.get('--repository'),
  };
}

function validateTag(tag) {
  const match = /^v(\d{4})\.(\d{2})\.(\d{2})-(\d+)$/.exec(tag);
  if (!match || Number(match[4]) < 1) fail(`无效发布标签: ${tag}（格式应为 vYYYY.MM.DD-N）`);
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    fail(`发布标签包含无效日期: ${tag}`);
  }
  return `${year}${month}${day}`;
}

function validatePrevious(previous) {
  if (!previous || previous === '.' || previous === '..' || path.basename(previous) !== previous || /[\\/\0]/.test(previous)) {
    fail('--previous 必须是单一目录名（basename）');
  }
}

function normalizeRepository(value) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) || value.split('/').some((part) => part === '.' || part === '..')) {
    fail(`无效 repository，需为 owner/repo: ${value}`);
  }
  return value.replace(/\.git$/i, '');
}

function repositoryFromRemote(remote) {
  const patterns = [
    /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i,
    /^ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(remote.trim());
    if (match) return normalizeRepository(match[1]);
  }
  fail('无法从 origin 解析 GitHub HTTPS/SSH 仓库地址，请通过 --repository owner/repo 指定。');
}

async function git(repo, args, options = {}) {
  try {
    return await execFileAsync('git', args, {
      cwd: repo,
      encoding: options.encoding ?? 'buffer',
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    const detail = error.stderr ? Buffer.from(error.stderr).toString('utf8').trim() : error.message;
    fail(`git ${args[0]} 失败: ${detail}`);
  }
}

function isAllowedPath(filePath) {
  if (filePath.includes('\\') || filePath.includes(':')) return false;
  const parts = filePath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) return false;
  const lowerParts = parts.map((part) => part.toLowerCase());
  if (lowerParts.some((part) => ['node_modules', 'outputs', 'secrets', 'secret', 'credentials', 'credential', 'backups', 'backup'].includes(part))) return false;
  if (/(^|\/)(?:\.env(?:\..*)?|[^/]*(?:secret|credential|private[-_.]?key)[^/]*|[^/]*\.(?:pem|key|p12|pfx|sqlite3?|db|dump|bak|backup|old|orig|swp))$/i.test(filePath)) return false;
  const rootFile = parts.length === 1;
  const variantsFile = parts.length >= 2 && ['assets', 'posts', 'variants'].includes(parts[0]);
  if (!rootFile && !variantsFile) return false;
  const extension = path.posix.extname(filePath).toLowerCase();
  const noticeFile = /^(?:LICENSE|COPYING|NOTICE)(?:\.[A-Za-z0-9-]+)?$/i.test(path.posix.basename(filePath));
  return rootFile ? ['.html', '.css', '.js'].includes(extension) : STATIC_EXTENSIONS.has(extension) || noticeFile;
}

async function ensureOutput(out) {
  try {
    const info = await stat(out);
    if (!info.isDirectory()) fail(`输出路径不是目录: ${out}`);
    if ((await readdir(out)).length !== 0) fail(`输出目录必须为空，拒绝覆盖已有材料: ${out}`);
  } catch (error) {
    if (error.code === 'ENOENT') await mkdir(out, { recursive: true });
    else throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  const datePart = validateTag(args.tag);
  validatePrevious(args.previous);
  if (args.repository !== undefined) normalizeRepository(args.repository);

  const repoInfo = await stat(args.repo).catch(() => null);
  if (!repoInfo?.isDirectory()) fail(`仓库目录不存在: ${args.repo}`);
  const resolved = await git(args.repo, ['rev-parse', '--verify', `${args.commit}^{commit}`], { encoding: 'utf8' });
  const sourceCommit = resolved.stdout.trim().toLowerCase();
  if (!/^[0-9a-f]{40,64}$/.test(sourceCommit)) fail(`Git 返回了无效 commit id: ${sourceCommit}`);

  const repository = args.repository
    ? normalizeRepository(args.repository)
    : repositoryFromRemote((await git(args.repo, ['remote', 'get-url', 'origin'], { encoding: 'utf8' })).stdout);

  const listed = await git(args.repo, ['ls-tree', '-rz', '--full-tree', sourceCommit]);
  const entries = Buffer.from(listed.stdout).toString('utf8').split('\0').filter(Boolean);
  const files = [];
  for (const entry of entries) {
    const tab = entry.indexOf('\t');
    if (tab < 0) continue;
    const [mode, type, objectId] = entry.slice(0, tab).split(' ');
    const filePath = entry.slice(tab + 1);
    if (type === 'blob' && (mode === '100644' || mode === '100755') && isAllowedPath(filePath)) {
      files.push({ path: filePath, objectId });
    }
  }
  if (files.length === 0) fail('指定提交中没有可打包的静态文件（空仓库或无白名单文件）');
  const paths = new Set(files.map((file) => file.path));
  if (!paths.has('index.html') || !paths.has('content.js')) fail('指定提交必须包含白名单内的根级 index.html 和 content.js');

  await ensureOutput(args.out);
  const archiveName = `personal-page-${args.tag}.tar.gz`;
  const archiveTar = await git(args.repo, ['archive', '--format=tar', sourceCommit, '--', ...files.map((file) => file.path)]);
  const archive = gzipSync(Buffer.from(archiveTar.stdout));
  const artifactHash = createHash('sha256').update(archive).digest('hex');
  const fileRecords = [];
  for (const file of files) {
    const blob = await git(args.repo, ['cat-file', 'blob', file.objectId]);
    fileRecords.push({ path: file.path, sha256: createHash('sha256').update(Buffer.from(blob.stdout)).digest('hex') });
  }
  const releaseId = `${datePart}-${sourceCommit.slice(0, 7)}`;
  const manifest = {
    release_id: releaseId,
    built_at: new Date().toISOString(),
    source_commit: sourceCommit,
    source_dirty: false,
    repository,
    environment: 'production',
    site_url: SITE_URL,
    release_tag: args.tag,
    artifact_file: archiveName,
    artifact_sha256: artifactHash,
    previous_release: args.previous,
    files: fileRecords,
  };

  await writeFile(path.join(args.out, archiveName), archive, { flag: 'wx' });
  await writeFile(path.join(args.out, 'deployment.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await writeFile(path.join(args.out, 'SHA256SUMS'), `${artifactHash}  ${archiveName}\n`, { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ release_id: releaseId, artifact_file: archiveName, artifact_sha256: artifactHash, file_count: files.length, output: args.out })}\n`);
}

main().catch((error) => {
  process.stderr.write(`打包失败: ${error.message}\n`);
  process.exitCode = 1;
});
