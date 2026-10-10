# 插画与动画工作流

## 当前资产

- `assets/illustrations/meadow-static.png`：主页草原和大树静态原画。
- `assets/illustrations/cel-six/meadow-six-wind.webp`：草原六姿态风吹循环。
- `assets/illustrations/coast-static.png`：海岸静态原画，供子页面使用。
- `assets/illustrations/cel-six/coast-six-wind.webp`：海岸六姿态循环。
- `variants/coast/assets/journal-symbols.svg`：海岸单页自己的符号资源。

两张动图和主页树下构图已通过本地预览页面验收。页面在动画暂停、减少动态偏好、图像离开视口或标签页隐藏时回到静态原画。

## 当前网页：六姿态浏览器过渡

网页现在使用 `assets/illustrations/web/poses/` 中的六张清晰透明 WebP，由 `scene-player.js` 在 Canvas 中合成过渡。编码质量 96，保留完整透明通道；1280px 组适合高像素密度屏幕，960px 组适合较小显示尺寸。播放器匹配浏览器为海报选择的分辨率，避免海报和动画清晰度不同或重复下载另一组。

每幅画停留 500ms，再以 500ms 的 smoothstep 溶解到下一幅；六秒循环首尾相接。Canvas 将两个图像的预乘颜色和透明度按互补权重相加，避免普通叠加导致半透明笔触变暗。草原沿用原 A/D/C/B/E/F 顺序，海岸沿用 A/C/B/D/E/F，输出文件 a-f 已按播放顺序编号；原来对齐与固定树干的处理继续使用。

构建清晰姿态图（需要任务环境 Pillow；对齐步骤需要 FFmpeg）：

```sh
node scripts/build-six-pose-wind.mjs --prepare-only
python scripts/build-scene-poses.py
```

六张总量：草原 1280px 约 1.33MB、960px 约 0.86MB；海岸约 0.74MB、0.48MB。首张作为清晰海报优先显示，其余姿态通过 fetch 下载，不再下载几十个过渡帧。可见且允许动态时才加载；隐藏、出视口和减少动态时停止绘制并显示海报。加载失败同样保留海报。

修改姿态后更新 HTML 和脚本中的资源 URL 版本参数。静态资源沿用 `/assets/illustrations/web/` 七天缓存；原始图、原动图与上一版压缩动图都保留。

## 上一版压缩动画（保留）

`v2026.10.10-3` 使用 `assets/illustrations/web/` 下的压缩版本：动图为桌面 960px / 手机 640px，静态海报为 1280px / 640px。原画与原动画保留，六幅姿态、73 个编码帧和 5999ms 循环时长保持一致。动图采用 WebP 质量 70/68，透明通道量化至 64 级；静态海报质量 82。现行页面已改用上述六姿态浏览器过渡方案。

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
