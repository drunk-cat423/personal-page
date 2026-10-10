# 插画与动画工作流

## 当前资产

- `assets/illustrations/meadow-static.png`：主页草原和大树静态原画。
- `assets/illustrations/cel-six/meadow-six-wind.webp`：草原六姿态风吹循环。
- `assets/illustrations/coast-static.png`：海岸静态原画，供子页面使用。
- `assets/illustrations/cel-six/coast-six-wind.webp`：海岸六姿态循环。
- `variants/coast/assets/journal-symbols.svg`：海岸单页自己的符号资源。

两张动图和主页树下构图已通过本地预览页面验收。页面在动画暂停、减少动态偏好、图像离开视口或标签页隐藏时回到静态原画。

## 网页加载版本

页面使用 `assets/illustrations/web/` 下的轻量版本：动图为桌面 960px / 手机 640px，静态海报为 1280px / 640px。原画与原动画保留，六幅姿态、73 个编码帧和 5999ms 循环时长保持一致。动图采用 WebP 质量 70/68，透明通道量化至 64 级；静态海报质量 82。正常页面尺寸下对比检查线条与透明边缘。

从已验收动画生成网页版本（需要任务环境提供 Pillow，无服务器运行依赖）：

```sh
python scripts/optimize-scene-assets.py
```

`optimization.json` 保存尺寸、体积、帧数、时长与透明验证结果。首屏场景按屏幕宽度预加载对应动画，减少动态偏好只显示海报；正文末尾插画进入视口才加载。桌面动图约 4.08MB / 2.25MB，手机约 2.13MB / 1.20MB；海报约 140KB / 83KB。新资源目录缓存七天，每次改图同步更新 HTML 中的资源 URL 版本参数，避免浏览器继续使用旧图。

## 更新姿态

姿态图需要保持原画的透明画布、比例、蓝色钢笔和淡水彩。树的树根、主干和主要枝叉应固定，只改变树冠、外侧细枝、云和草尖；海岸的灯塔、房屋、船、岸线和地平线固定，只改变浪、云和少量草尖。不要用 CSS 位移替代新画出的姿态。

为目标场景准备 A 原画和 B 至 F 五幅不同姿态，放入 `assets/illustrations/cel-six/`，命名为 `{meadow|coast}-pose-{b|c|d|e|f}.png`。对应生成提示词集中记录在 `assets/illustrations/cel-six/PROMPTS.md`。每张输入应保留透明背景，不要裁切或改画布尺寸。

在项目根目录构建循环：

```sh
node scripts/build-six-pose-wind.mjs
```

该脚本需要系统 PATH 中的 `ffmpeg`。若它不在 PATH，可通过 `FFMPEG_PATH` 指定可执行文件。也可只构建一种场景：

```sh
node scripts/build-six-pose-wind.mjs --only=meadow
node scripts/build-six-pose-wind.mjs --only=coast
```

脚本会对齐姿态、恢复固定区域、生成六秒透明 WebP，并写入对齐图、姿态网格和 `six-verification.json`。核对六幅姿态确实不同、树干或海岸结构稳定、透明边缘正常、循环时长与报告一致。构建结果仍需在浏览器里播放检查，脚本报告不能代替视觉验收。

更新静态原画时，同步检查引用该图的页面与对应动画首帧。保留原图和之前的动画文件，不把中间对齐图误当成新的源姿态。
