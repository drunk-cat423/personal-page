# 晴屿 · 个人网页

晴屿是一份蓝色钢笔淡水彩风格的个人网页初版。根目录是正式预览入口，首页依次呈现文章、作品、留言和关于；海岸单页作为独立设计预览保留。前端使用原生 HTML、CSS 和 JavaScript；Waline 客户端资源随项目本地提供，留言服务作为单独的本机进程运行。

## 本地运行

预览静态页面需要 Node.js 18 或更新版本。在项目根目录运行：

```sh
node server.mjs
```

打开 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)。根路径直接服务 `index.html`，其余页面以 `.html` 文件名访问；服务器只监听本机，不需要安装 npm 包。

留言板本机试用还需要 Node.js 22。终端一启动本机 Waline 服务，终端二启动静态预览：

```sh
npm install --prefix outputs/waline-trial/runtime --no-save --package-lock=false --no-audit --no-fund @waline/vercel@1.43.4
node scripts/start-waline-trial.mjs
```

服务依赖只安装到本机忽略目录，不加入项目依赖清单。另开终端运行静态预览：

```sh
node server.mjs
```

再访问 [http://127.0.0.1:4173/guestbook.html](http://127.0.0.1:4173/guestbook.html)。本机服务使用 SQLite 保存真实留言；未启动服务时留言页会提示未连接并提供重试。其他域名默认不会尝试连接本机服务，也不会回退到 Waline 公共演示地址。配置和差异说明见 [`docs/waline.md`](docs/waline.md)。

## 页面

- `index.html`：主页开场、文章与作品预览、公开示例留言、关于与联系入口。
- `articles.html`：文章目录，可按技术、生活或碎碎念分类。
- `posts/small-things.html` 等：每篇文章各自的完整静态阅读页，包含章节目录、正文、上一篇/下一篇。旧 `article.html?id=small-things` 链接跳转到对应新页，ID 无效时显示返回目录入口。
- `works.html` 与 `work.html?id=quiet-window`：作品目录和概念说明。
- `guestbook.html`：真实 Waline 便签留言墙，点击入口打开顶层编辑浮窗。
- `about.html`：关于说明与联系信息占位。
- [`variants/coast/index.html`](variants/coast/index.html)：蓝色海岸构图的单页预览。

## 更新内容

页面切换由 `page-transitions.js` 在 head 阶段注册浏览器原生跨文档 View Transition。顶部导航及首页预览入口用约 320ms 退场、560ms 入场的顺风漂移衔接，入场错开 260ms 以减少新旧标题重叠；五片淡蓝色手绘叶子在约 1.4–1.6 秒内飘过，导航栏保持稳定，页面出现后叶子继续随风退去。动效不拦截或延迟链接跳转。链接、浏览器前进后退与锚点仍采用原生行为，键盘打开链接与系统减少动态效果时跳过过渡。不支持跨文档过渡时，保留旧页直到跳转，在目标页执行轻淡入场；刷新和直接打开页面不触发叶子动效。

每次导航的叶片位置、大小和角度轻微变化，同一次切换前后保持一致，避免叶片突然跳位。插画自动播放，继续尊重系统减少动态偏好和页面可见状态。

返回主页的链接使用另一阵轻风：叶片向左下飘过，主页以轻微的纵向起伏和缩放展开。顶部“主页”和页脚主页链接均可触发，文章详情页的相对路径及项目子目录部署也使用同一过渡；在主页点击主页链接不重复播放。

文章、作品与留言页在真实内容准备前显示浅蓝骨架占位，完成后立即替换，不设置最低等待时间。页面模块异步下载，初始化前确认 DOM 已解析；远程字体样式不阻塞首屏，本地 CSS 和标题字体仍正常使用。插画先保留静态 PNG，在动图下载和解码完成、当前允许播放时才切换，下载失败则保持静态。

文章、作品和公开示例留言集中在 [`content.js`](content.js)。修改时保留稳定且不重复的 `id`；文章使用 `category: 'tech' | 'life' | 'ramble'` 和 ISO 日期 `dateISO`，首页按日期从同一份数据取最新内容。作品目前是概念示例，不对应外部产品或仓库。

文章正文使用 `sections`，每节包含稳定的 `id`、`title` 与 `paragraphs` 数组。文章生成器需要 Node.js 22.7 或更新版本（本机使用 Node.js 24 验证）；更新文章后运行 `node scripts/build-articles.mjs`，重新生成 `posts/` 下的独立 HTML。标题、摘要、日期和正文直接保存在页面中，刷新或不执行 JavaScript 也能阅读。阅读页样式集中在 `article.css`，主站脚本仅负责导航、切换过渡及插画播放。

文章目录在宽屏常驻正文右侧并随阅读位置高亮，窄屏改为正文上方的可折叠目录。首末文章的缺失前后入口保留淡色占位。篇末 `data-post-image-slot` 默认隐藏；以后可在文章数据添加 `illustration: { src, alt, motionSrc? }` 放图（资源路径相对 `posts/` 页面），当前六篇不显示插画。

文章、作品和访客留言的早期示例身份不代表真实经历。正式留言页现接入 Waline：本机试用的已提交留言存入 SQLite 服务，客户端仍会在浏览器缓存昵称和未提交草稿；`variants/guestbook-local/index.html` 保留旧的纯本地演示版本作对照。正式服务地址默认为空，只在 `localhost` 或 `127.0.0.1` 自动连接本机试用服务；部署到其他域名需在 [`waline-config.js`](waline-config.js) 配置自己的服务地址。

## 字体与插画

Noto Serif SC、DM Sans 和 Caveat 由 Google Fonts 加载，需要网络访问；离线时使用 CSS 后备字体。本地霞鹜文楷 WOFF2 只覆盖当前模块标题所需字符，不是完整字库，许可见 [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt)，覆盖范围和更新方法见 [`assets/fonts/README.md`](assets/fonts/README.md)。

草原与海岸的静态图、六姿态循环动画以及插画更新流程见 [`docs/illustrations.md`](docs/illustrations.md)。设计约定见 [`docs/design.md`](docs/design.md)。
