# 本地标题字体

`lxgw-wenkai-headings.woff2` 是霞鹜文楷 Regular 的网页标题子集，使用 SIL Open Font License 1.1；完整授权文本见 [`OFL.txt`](OFL.txt)。当前文件为 13,028 字节、静态字重 400，WOFF2 cmap 覆盖 54 个 Unicode 码位。它只适用于本项目当前模块标题，不是完整字体。

当前字体文件的精确 CSS 覆盖范围：

```css
unicode-range: U+3002, U+4E00, U+4E0B, U+4E1C, U+4E86, U+4E8E, U+4E9B, U+4F5C, U+4F60, U+4F8B, U+4FDD, U+505A, U+516C, U+5173, U+5199, U+53E5, U+5427, U+54C1, U+5728, U+5750, U+597D, U+5C0F, U+5F00, U+5F55, U+6211, U+6280, U+6301, U+6587, U+6700, U+672F, U+6765, U+6811, U+6B22, U+6B63, U+6D3B, U+6D77, U+6F14, U+751F, U+7559, U+7684, U+793A, U+7AE0, U+7CFB, U+8054, U+897F, U+8A00, U+8BB0, U+8BDD, U+8FB9, U+8FCE, U+8FD1, U+8FD9, U+98CE, U+FF0C;
```

## 重新构建

从 [lxgw/LxgwWenKai](https://github.com/lxgw/LxgwWenKai) 官方仓库取得 `fonts/TTF/LXGWWenKai-Regular.ttf`。字体源文件和构建工具不属于本项目，不要提交它们。

构建脚本需要 Python 3.10 或更新版本，以及可选开发工具 `fonttools` 与 `brotli`，不需要也不会安装生产依赖。可在系统临时目录建立独立虚拟环境；以下为 PowerShell 示例：

```powershell
$fontEnv = Join-Path $env:TEMP 'qingyu-font-tools'
python -m venv $fontEnv
& (Join-Path $fontEnv 'Scripts/python.exe') -m pip install fonttools brotli
$fontSource = Read-Host '官方 LXGW WenKai Regular TTF 文件路径'
& (Join-Path $fontEnv 'Scripts/python.exe') scripts/build-heading-font.py --source $fontSource
```

脚本扫描根目录 HTML 中的 `h2` 和固定模块标签，写出 `assets/fonts/lxgw-wenkai-headings.woff2`，并报告静态字重、覆盖码位、文件大小和精确 `unicode-range`。脚本不会修改 CSS。改动标题后，将新范围同步到 `site.css` 的 `@font-face`，同时更新本页的覆盖范围与文件大小，确认新增字符在源字体 cmap 中，再检查浏览器渲染和回退效果。
