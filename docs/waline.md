# Waline 留言板

## 版本与来源

正式留言页使用本地打包的 `@waline/client` 3.16.0 客户端，许可证以 `assets/vendor/waline/LICENSE` 随包文件为准。Waline 官方资料包括[客户端属性](https://waline.js.org/reference/client/props.html)、[客户端 API](https://waline.js.org/reference/client/api.html)、[服务端 HTTP API](https://waline.js.org/reference/server/api.html)和[自定义语言](https://waline.js.org/cookbook/customize/locale.html)。本页使用本地分发文件，不从 CDN 加载客户端。设置了 `path: '/guestbook'`、昵称必填、千字上限、每页六条、禁用登录、搜索、图片上传和表情包；组件版权保留。

本机试用服务使用 `@waline/vercel` 1.43.4 和 SQLite。服务启动脚本 `scripts/start-waline-trial.mjs` 与数据库数据由本机服务流程管理，前端不直连数据库。

## 运行与配置

先在项目根目录准备服务运行时。此命令只把后端包安装到本机忽略目录，不修改项目依赖清单：

```sh
npm install --prefix outputs/waline-trial/runtime --no-save --package-lock=false --no-audit --no-fund @waline/vercel@1.43.4
```

然后在第一个终端运行：

```sh
node scripts/start-waline-trial.mjs
```

再在第二个终端运行：

```sh
node server.mjs
```

浏览器打开 `http://127.0.0.1:4173/guestbook.html`。静态预览由 Node.js 18 或更新版本运行；本机服务要求 Node.js 22。启动脚本在环境版本不符时优先使用可配置的本机临时 Node 22 或 `WALINE_NODE_PATH`。数据库和服务密钥保存在忽略的 `outputs/waline-trial/.data/`，不要提交该目录。`waline-config.js` 中的 `serverURL` 默认是空值：页面仅在 `localhost` 或 `127.0.0.1` 自动连接同主机的 `:8360` 本机服务；其他主机名会显示“留言服务尚未配置”，不会尝试访问 `localhost` 或第三方演示服务。若将来配置其他真实服务地址，在同一配置文件中填写它；页面会连接该地址并按其实际存储服务保存留言。

初始化前页面会对配置的服务请求 `/api/comment`，五秒超时，并要求 Waline 1.43.4 响应成功且 `data.data` 是数组；服务不可用、响应无效或客户端初始化失败时显示“留言服务未连接”和重试按钮。没有配置服务时不显示重试。

静态 HTML 先显示不包含真实昵称/内容的装饰骨架，Vue 挂载区标记 `aria-busy=true`。骨架会持续到官方组件自己的首次列表请求结束、出现留言/空列表/刷新错误状态后才移除；探测服务成功本身不代表列表已就绪。未配置或连接失败时移除骨架并显示原有状态提示，重试重新进入加载。图片和骨架没有人为最低展示时长。

在本机模式下，页面小字标注“本机试用 · 留言保存于本机服务”。这代表已提交留言写入本机服务的 SQLite 数据库；官方客户端仍在浏览器 `localStorage` 缓存昵称和未提交草稿。`variants/guestbook-local/index.html` 保留此前的本地浏览器演示表单供对照，两种留言存储彼此独立。

## 便签墙与编辑层

留言墙仍由同一个官方 Waline 实例渲染。CSS 只将 `.wl-cards` 的直接根留言项排成桌面两列、手机单列的浅蓝纸条；使用多栏流式排列，按每列从上往下阅读，桌面便签上下间距固定 16px、手机 12px，相邻两列无需按行对齐。卡片内部的回复保持原来的 Waline 嵌套结构，回复不会成为新的墙面便签；超过一条回复时保留首条预览，按钮展开其余回复，再次点击可收起。官方排序、加载更多、分页、预览、回复和点赞控件仍由 Waline 管理。

顶部总数只统计原始留言。初始连接使用 `pageSize=1` 的公开留言列表响应，此时 `totalPages` 等于根留言数（空列表特判为 0），而官方 `count` 包含回复，不能直接用于墙面总数。页面保留但隐藏官方计数节点，以其变化作为刷新根总数的触发信号；新增回复不增加根总数，新增原始留言会刷新。该查询覆盖全部分页，而非仅当前已加载卡片。

回复展开/收起通过 `reply-motion.js` 使用浏览器 View Transition API，短暂捕获墙面根便签，让内容淡化与便签位置变化平滑衔接。快照只用于过渡，原生回复节点与表单不移动或复制；结束后移除临时快照名称。键盘触发、减少动态效果偏好或浏览器不支持时直接更新状态。

“写一张便签”会打开 Waline 自己生成的 `.wl-panel` 原生 `popover=auto` 编辑面板。页面从 `template#note-composer-chrome` 克隆标题、当前留言/回复说明和“先收起”按钮；表单、草稿、预览和提交仍由官方组件维护，没有复制表单或自写评论渲染。Escape 与轻点面板外会由浏览器关闭 Popover；关闭只收起编辑面板，不卸载 Vue 实例，因此未提交草稿保留。回复按钮触发官方新面板时也复用相同的标题区和原生 Popover。

鼠标打开编辑层时会短暂淡入并上移 6px；键盘触发和系统减少动态偏好不做位移动效。触屏不使用 hover 位移或卡片倾斜。编辑器与回复按钮保留 Waline 自己的交互。

收起回复时入口改为“继续回应”，再次打开仍保留回复草稿；浮窗内的“取消回应，改写新便签”调用 Waline 原生取消回复，清除回复目标并回到独立留言入口。提交后仅在用户未继续编辑、原生列表出现新的留言 ID 且组件清空正文时显示保存成功并收起，正文为空本身不作为保存凭据。

## 样式与语言

本机服务通过 Waline 的自定义 model 接口修复 `@waline/core` 0.1.0 的点赞返回错误：匿名点赞只更新 like 时，移除该版本额外填入的 `comment: undefined`，让存储返回原有正文并正常完成 Markdown 格式化。数据库写入和权限检查仍由官方服务负责，未修改服务安装包。

本地客户端 3.16.0 仅将点赞事件处理函数接到 `like-state.js`，保留官方 Vue 留言数据、图标、计数和本地点赞记录。点击即更新原有状态，接口成功时以服务端计数校准，失败时恢复本条原状态并提示；同一条请求未结束时不重复提交，其他便签的并发点赞互不覆盖。`scripts/like-state.test.mjs` 使用 Node 内置测试覆盖延迟响应、重复点击及失败回滚。替换 vendor 客户端时需保留这一处调用和模块导入，MIT 许可证随包保留。

`like-motion.js` 按点赞状态事件提供约 300ms 的轻微弹跳、淡圆环与小粒子，取消时只回落。视觉参考为 [Heart Icon CSS Animation](https://codepen.io/31mskz10/pen/axvGym)，按本站纸张蓝与柔和粉重新实现，没有复制参考代码或增加动画库。键盘触发和减少动态偏好直接更新状态。

`guestbook.html` 按顺序加载 Waline 官方 `waline.css`、主站 `site.css` 和 `waline-theme.css`。主题文件设置 Waline 提供的 `--waline-*` 变量，并在 `.wl-*` 类范围内覆盖留言卡片、嵌套回复、输入字号、按钮触控尺寸、固定编辑区与编辑 Popover 外观。除上述点赞事件处理外，评论内容及表单继续由官方组件渲染。

昵称和占位提示通过客户端 3.16.0 类型声明中的真实 locale 键 `nick` 与 `placeholder` 设置。服务端登录关闭，但官方排序、预览、回复、分页与版权信息保留。

本机启动器只向子进程传递必要的系统环境变量和本机配置，不继承其他数据库、邮件或 Webhook 服务的配置。它只监听 127.0.0.1:8360，不用于云端正式部署。
