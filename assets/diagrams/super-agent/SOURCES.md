# Super-agent 原文配图来源

本文使用的三张配图来自 DeepSeek Harness 团队的[《Super-agent 设计探索：迈向更自主的 Agent 系统》](https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg)。图片直接保存原文 JPEG，保留原有水印；图片版权归原作者。检索日期：2026-11-02。

## official-router-workers.jpg

双层架构：Router 层统一负责路由与对外交互，多个 Worker Session 隔离并发执行任务

- 原文图片序号：3
- 图片地址：[原图](https://mmbiz.qpic.cn/sz_mmbiz_jpg/1tAz3OsOg5aiaibaodlb8mKmxlqd7fgiamrRjG4bq0xI9iaibAkHv2djdohiaKpBvuibd1IM9WqSvKnZfvMGW8D5x8Z5wePvj2Yv14gEDpgaNHNDBw/0?wx_fmt=jpeg)
- SHA-256：`83a6385b914ff0f87c0735911b032d3b8cbbb8cf0507d3e283fde218d527f9a2`

## official-context-recall.jpg

链式召回：每次召回的对象均内联下一跳关联对象的 ID，支持沿引用关系逐跳展开上下文

- 原文图片序号：7
- 图片地址：[原图](https://mmbiz.qpic.cn/sz_mmbiz_jpg/1tAz3OsOg5b1ENK3jNNVvhZfCeR6qicWnH8YUD6YB4OKAwQibpqia3qyjyMGvZd0Gl6C2O7tfUiaXJialhEHKhCTbMQKJqMeS70qO3zp01m0sSLI/0?wx_fmt=jpeg)
- SHA-256：`c3a416ef3b45ded4a2d6bf7cc1a0f1218ee3ae4c10f6f194290b5af61b0bc050`

## official-async-loop.jpg

经典 ReAct Loop 与异步 ReAct Loop 对比：异步调用立即返回 Started 通知，后台工具运行期间仍可响应新消息

- 原文图片序号：9
- 图片地址：[原图](https://mmbiz.qpic.cn/sz_mmbiz_jpg/1tAz3OsOg5bSP2SMWxlqib7j1yT6C7n0OtwPP73MlxbRHytBcF1I8IoZ8wlKvXvjw4fS2yibXDiat5kVk6AxUpwvPFcqXlooYrUA27ZRKmBsos/0?wx_fmt=jpeg)
- SHA-256：`c057d20ba2fe9c5fe0943ba281bfa21fe0faa25ab6e1b34af9ccd3ad080390ba`
