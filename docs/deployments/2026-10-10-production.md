# v2026.10.10-1 正式发布基线

本次将已经在线运行的博客和推理助手建立为可追溯的 GitHub 发布基线。两个仓库保持独立，每个仓库的 `v2026.10.10-1` 都只关联自己的源提交。

| 服务 | 发布记录 | 源码与配置 |
| --- | --- | --- |
| 个人博客 | [personal-page Release](https://github.com/drunk-cat423/personal-page/releases/tag/v2026.10.10-1) | 博客页面、作品插画与提示词、正式 Waline 包装脚本及运维模板 |
| 推理助手 | [detective Release](https://github.com/drunk-cat423/detective/releases/tag/v2026.10.10-1) | `59990741685977966562d42ad5eea6bca16bf525`，含本次生产路由修正，不含本地聊天改动和设计实验 |

博客源提交由其发布标签解析获得。源码文件不能引用包含它自身的提交 SHA；完整 SHA 由提交之后生成的版本清单记录，避免制造自引用校验。

每个 Release 的附件包含静态/前端发布包、`deployment.json` 和 `SHA256SUMS.txt`。清单记录构建时间、实际部署时间、产物哈希、上一发布版本和必要的关联服务版本；SHA-256 清单同时覆盖发布包及版本清单自身。构建源来自指定 Git 提交，不读取其他工作区草稿。

线上版本入口：

- 博客：`https://linyouwei.top/deployment.json`。
- 推理助手：`https://detective.linyouwei.top/deployment.json`。

发布包及公开清单不包含运行凭据、用户数据库、JWT 密钥或私有服务器备份。Waline 持久数据、推理助手 MySQL/Chroma 和私有环境配置保持独立。本次不新增依赖、不调整 CI/CD，不触发付费模型验收。

必要验证包括：相关脚本语法、点赞状态检查、空 SQLite 初始化模板、推理助手前端类型检查和构建、发布材料文件清单、源与产物校验值、线上 HTTP/版本清单及既有数据读取。实际部署时间、构建结果和执行状态以附件清单为准；Release 在附件齐备且部署验证成功后发布。

博客切换前保留上一发布目录，回滚只切换 `current`。推理助手源码和前端构建另留备份，其 `timeline_events.title` 数据库迁移保留在 `7c4e19a2d830`；这次仅补齐路由修正，不重新迁移或重置数据库。
