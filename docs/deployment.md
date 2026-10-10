# 正式部署与运维

以下记录对应 2026-10-10 的上线状态。博客为 [https://linyouwei.top](https://linyouwei.top)，`www.linyouwei.top` 同样服务博客；作品项目入口为 [https://detective.linyouwei.top/](https://detective.linyouwei.top/)，无需登录，旧 `/login` 地址重定向至首页。HTTP 通过 301 跳转 HTTPS，页脚沿用旧域名已有备案号：粤ICP备2026096103号-1。

## 服务与目录

服务器使用 Ubuntu 24.04 和原有 Nginx，无 Docker。仓库中的配置对应 [`scripts/deployment/nginx.conf`](../scripts/deployment/nginx.conf) 与 [`scripts/deployment/qingyu-waline.service`](../scripts/deployment/qingyu-waline.service)。Nginx 站点文件为 `/etc/nginx/sites-available/detective`。

| 内容 | 当前位置或运行方式 |
| --- | --- |
| 博客首次静态发布 | `/var/www/personal-page/releases/20261010-first` |
| 正式博客发布目录 | `/var/www/personal-page/releases/YYYYMMDD-<short-sha>`；当前版本见线上 `/deployment.json` |
| 博客生效目录 | `/var/www/personal-page/current`，指向发布目录的符号链接 |
| 原作品项目 | `/opt/detective-assistant`，目录与原 MySQL 实例保留，通过作品子域访问 |
| Waline 代码与运行时 | `/opt/qingyu-waline`；`runtime` 内为 `@waline/vercel` 1.43.4 |
| Waline Node.js | 22.23.3，`/opt/node-v22.23.3/bin/node` |
| Waline 服务与数据 | 独立用户 `qingyu-waline`，`qingyu-waline.service`；SQLite 与 JWT 位于 `/var/lib/qingyu-waline` |

Nginx 的 `/waline/` 代理剥离前缀，后端仅监听 `127.0.0.1:8360`。生产环境设置 `SITE_URL=https://linyouwei.top`、`SERVER_URL=https://linyouwei.top/waline`。`waline-config.js` 保持空覆盖值：正式域名自动使用同源 `/waline`，本机 4173 预览仍连接本机 8360。

推理助手生产路由修正对应独立仓库提交 `59990741685977966562d42ad5eea6bca16bf525`；服务器的私有 `.env` 设置 `AUTH_ENABLED=false`。Nginx 将作品子域的 `/login` 重定向至 `/`，入口 HTML 使用 `Cache-Control: no-cache`。两个仓库首次正式基线使用各自的 `v2026.10.10-1` 标签；完整 SHA、实际部署时间与产物校验值保存在各自 Release 附件和线上 `/deployment.json`。代码与部署的对应方式见 [部署版本记录](deployment-versioning.md)，上线前的核对结果见 [2026-10-10 快照](deployments/2026-10-10-baseline.md)。

Waline 与原项目数据库独立，本机试用数据没有迁移。访客可匿名留言，同 IP 留言间隔为 30 秒；OAuth 禁用，邮件未配置。账号注册由后端在 REST 解析后按 `user/post` 动作限制为本机来源，Nginx 强制覆盖 `X-Real-IP`，路径别名不能绕过该限制。配置细节见 [Waline 说明](waline.md)。

systemd 设置 `MemoryHigh=192M`、`MemoryMax=256M`，子进程固定 `--max-old-space-size=128`。验收时服务总 `MemoryCurrent` 约为 133–154 MB，`NRestarts=0`；期间人工重启一次不计为故障自动重启。这只是当时实测，不能作为未来用量上界，V8 堆限制也不等于总内存限制。

## 管理与已完成验证

首个管理员已在服务器本地创建，邮箱为 `admin@linyouwei.top`。随机密码仅保存在服务器 `/root/site-backups/20261010-migration/waline-admin.json`，权限 600；不要复制到发布包、仓库或运维日志。SQLite 与 JWT 密钥文件同样为 600，更新时保留数据目录和密钥。

管理入口 `https://linyouwei.top/waline/ui` 已在浏览器正常显示登录表单，官方管理脚本默认从 unpkg 加载。管理员登录与删除已通过真实 API 验证，未在浏览器中填写管理员密码。

正式页面的匿名回复已通过浏览器提交，点击爱心后计数从 1 立即变为 2，后台确认一致。人工重启服务后根留言、回复、计数与 JWT 保持；验收测试数据均已删除，验收结束时留言总数为 0。

旧主域的应用接口和 `/login` 已迁移至 `detective.linyouwei.top`。在博客主域请求原应用 `/api/` 或 `/login` 返回 404 属于当前路由设计，不表示原项目被删除。

日常状态检查在服务器执行：

```sh
systemctl status qingyu-waline.service --no-pager
journalctl -u qingyu-waline.service -n 80 --no-pager
nginx -t
curl -I https://linyouwei.top/
curl -I https://detective.linyouwei.top/
curl -fsS 'https://linyouwei.top/waline/api/comment?path=%2Fguestbook&page=1&pageSize=1'
```

## 更新与静态页面回滚

修改文章后先在本地执行 `node scripts/build-articles.mjs`，完成相关检查与页面验收。准备包含页面、生成的 `posts/`、静态脚本、样式和 `assets/` 的静态发布包；不包含 `.env`、`outputs/`、运行时依赖或凭据。将发布包上传至服务器 `/tmp/personal-page.tar` 后，以有写入权限的账号执行：

```sh
set -e
release="/var/www/personal-page/releases/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$release"
tar -xf /tmp/personal-page.tar -C "$release"
test -f "$release/index.html"
readlink -f /var/www/personal-page/current
ln -sfn "$release" /var/www/personal-page/current.next
mv -Tf /var/www/personal-page/current.next /var/www/personal-page/current
```

记下切换前的发布目录。切换后检查首页、文章、作品链接和留言列表；静态更新不需要重启 Waline。若需回退，将符号链接切回已验证的发布目录，例如首次发布：

```sh
ln -sfn /var/www/personal-page/releases/20261010-first /var/www/personal-page/current.next
mv -Tf /var/www/personal-page/current.next /var/www/personal-page/current
```

Waline 代码更新单独进行：先备份运行中的版本与持久数据，仅替换 `/opt/qingyu-waline` 中需要更新的代码，然后 `systemctl restart qingyu-waline.service` 并检查状态与 API。不要把本机试用数据或空库覆盖到生产数据库。修改 systemd 单元后先 `systemctl daemon-reload` 再重启；修改 Nginx 配置后仅在 `nginx -t` 成功时 reload。

## 备份与主域迁移回滚

迁移前备份均位于服务器 `/root/site-backups/20261010-migration/`：

- `detective-and-config.tar.gz`：原项目、Nginx 与 Supervisor 配置归档。
- `detective.sql`：原项目数据库导出。
- `detective.nginx.conf`：旧主域 Nginx 配置。
- `waline-admin.json`：新管理员凭据，权限 600，仅服务器保存。

备份 Waline 时暂停写入，将整个持久目录一并保存，以免复制到数据库与密钥的不一致状态。以下操作在服务器以 root 执行：

```sh
backup="/root/site-backups/$(date +%Y%m%d-%H%M%S)-waline"
install -d -m 700 "$backup"
systemctl stop qingyu-waline.service
cp -a /var/lib/qingyu-waline "$backup/waline-data"
systemctl start qingyu-waline.service
systemctl status qingyu-waline.service --no-pager
```

若要恢复旧主域应用服务，保存当前 Nginx 配置，再恢复迁移前配置并验证、重载：

```sh
cp /etc/nginx/sites-available/detective /root/site-backups/20261010-migration/before-domain-rollback.nginx.conf
cp /root/site-backups/20261010-migration/detective.nginx.conf /etc/nginx/sites-available/detective
nginx -t && systemctl reload nginx
```

随后检查旧主域 `/login` 和应用 API。原项目目录与 MySQL 实例仍在，因此这一步只回滚入口配置，不删除或重置数据库，也不需要重新导入数据库备份。若配置验证失败，先恢复保存的当前配置再处理错误。

## HTTPS 与续期

Let's Encrypt 证书覆盖 `linyouwei.top`、`www.linyouwei.top`、`detective.linyouwei.top`，有效至 **2027-01-08**。`certbot.timer` 与成功续期后 reload Nginx 的 deploy hook 已设置。

第三次 `certbot renew --dry-run` 已完整成功，日志保存在服务器 `/root/site-backups/20261010-migration/certbot-dry-run-3.log`。前两次的 CAA 查询与 CA secondary validation 问题已结束。

```sh
systemctl status certbot.timer --no-pager
certbot certificates
certbot renew --dry-run
```

ACME 验证路径为 `/.well-known/acme-challenge/`，Nginx 使用 `/var/www/acme`；80 与 443 端口均已验证可读取，更新站点配置时保留该入口。
