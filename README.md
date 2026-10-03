# 晴屿 · 个人网页

晴屿是一份蓝色钢笔淡水彩风格的个人网页初版。根目录是正式预览入口，首页依次呈现文章、作品、留言和关于；海岸单页作为独立设计预览保留。项目使用原生 HTML、CSS 和 JavaScript，没有生产依赖。

## 本地运行

需要 Node.js 18 或更新版本。在项目根目录运行：

```sh
node server.mjs
```

打开 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)。根路径直接服务 `index.html`，其余页面以 `.html` 文件名访问；服务器只监听本机，不需要安装 npm 包。

## 页面

- `index.html`：主页开场、文章与作品预览、公开示例留言、关于与联系入口。
- `articles.html`：文章目录，可按技术或生活分类。
- `article.html?id=small-things`：文章详情；ID 无效时显示返回列表入口。
- `works.html` 与 `work.html?id=quiet-window`：作品目录和概念说明。
- `guestbook.html`：公开示例留言及本地演示表单。
- `about.html`：关于说明与联系信息占位。
- [`variants/coast/index.html`](variants/coast/index.html)：蓝色海岸构图的单页预览。

## 更新内容

文章、作品和公开示例留言集中在 [`content.js`](content.js)。修改时保留稳定且不重复的 `id`；文章使用 `category: 'tech' | 'life'` 和 ISO 日期 `dateISO`，首页按日期从同一份数据取最新内容。作品目前是概念示例，不对应外部产品或仓库。

网页中的姓名、作品、文章和公开留言均为示例内容，不代表真实经历或访客。留言表单只将个人演示留言保存在当前浏览器的 `localStorage`（键名 `qingyu.guestbook-demo.v1`），不会上传、公开发布或同步到其他访客设备。

## 字体与插画

Noto Serif SC、DM Sans 和 Caveat 由 Google Fonts 加载，需要网络访问；离线时使用 CSS 后备字体。本地霞鹜文楷 WOFF2 只覆盖当前模块标题所需字符，不是完整字库，许可见 [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt)，覆盖范围和更新方法见 [`assets/fonts/README.md`](assets/fonts/README.md)。

草原与海岸的静态图、六姿态循环动画以及插画更新流程见 [`docs/illustrations.md`](docs/illustrations.md)。设计约定见 [`docs/design.md`](docs/design.md)。
