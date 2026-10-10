# 使用 GitHub 记录线上部署

GitHub 保存源码和发布记录；阿里云服务器运行网站与数据库。一次 `push` 更新仓库，一次部署更新服务器；需要用明确的提交 SHA 把两次操作关联起来。当前状态见 [部署核对快照](deployments/2026-10-10-baseline.md)。

## 先补齐当前生产基线

1. `personal-page` 提交本轮已上线的 HTML、JS、CSS、文章生成器、作品插画与提示词、正式 Waline 包装脚本、systemd/Nginx 模板以及部署文档。保留原截图作为素材原稿。
2. `detective` 单独提交取消登录所需的路由修正。排除尚未部署的 `useChat.ts`、设计原型和预览文件。
3. 推送后，分别记录两个仓库的完整提交 SHA。核对生产文件与该提交的源码/构建产物；如重新构建或部署，沿用当前备份和验收流程。

私有 `.env`、密码、SSH 私钥、JWT 密钥、SQLite/MySQL 用户数据、Chroma 持久数据、访问日志和包含凭据的备份不进入 GitHub。服务器路径、公开域名、依赖版本、无凭据配置模板和示例环境字段可以记录。博客仓库不复制推理助手源码，只关联它的仓库地址与实际部署 SHA。

## 每次发布怎样记录

先采用人工发布，暂不新增 GitHub Actions、CI/CD 配置或服务器密钥接入。

1. 完成代码和必要验证，提交并推送；发布材料只从这个已提交版本生成，不混入未提交实验。
2. 准备发布包，并生成版本清单：仓库、完整提交 SHA、构建时间、产物校验值、环境和上个版本。构建源快照必须只包含已提交内容；本地有其他草稿时，可导出指定提交后单独构建，不必丢弃草稿。若需要保留兼容旧浏览器的旧哈希资源，在产物清单里明确记录。
3. 部署到带版本的目录，例如 `20261010-<short-sha>`；验证后切换 `current`。记录实际切换时间、验证范围、上一发布目录及回滚方式。
4. 成功后为源提交打正式标签，在 GitHub Release 写发布说明并附上静态发布包、校验文件和无凭据的版本清单。失败尝试不能记录为成功上线。

GitHub Release 用于保存“这版是什么”和可下载的发布材料；GitHub Deployment 记录某个提交在 `production` 环境的部署状态，可关联线上地址与验证日志。Deployment 记录本身不负责把代码送到阿里云。第一阶段用 Release、版本清单和人工发布日志即可；需要集中查看环境历史时再接入 Deployment 状态。

官方说明：[GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)、[Deployments](https://docs.github.com/en/rest/deployments/deployments)。

## 版本清单示例

以下是字段示例，不是已经存在的生产记录。实际 SHA、时间、校验值和上个版本必须来自本次成功发布。

```json
{
  "repository": "drunk-cat423/personal-page",
  "source_commit": "<full committed SHA>",
  "source_dirty": false,
  "environment": "production",
  "site_url": "https://linyouwei.top/",
  "release_id": "<date-short-sha>",
  "built_at": "<ISO 8601 with timezone>",
  "deployed_at": "<ISO 8601 with timezone>",
  "artifact_sha256": "<release archive SHA-256>",
  "previous_release": "<previous successful release>",
  "related_projects": [
    { "repository": "drunk-cat423/detective", "source_commit": "<actual deployed SHA>" }
  ]
}
```

发布包校验值与版本清单可作为独立 Release 附件。若在服务器保存公开 `deployment.json`，只写提交、时间和公开域名等字段；敏感路径和私有运行参数留在私有运维记录中。避免把发布包自身的校验值写进包内后再声称该值就是包含自身清单的发布包校验值。

留言和案件数据库备份是数据恢复材料，不是代码发布包。回滚博客静态版本时切换 `current`，不会回退留言数据；回滚推理助手时需单独检查代码与数据库迁移兼容性。
