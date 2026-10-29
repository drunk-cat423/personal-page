import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { articles } from '../content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'posts');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const categoryLabels = { tech: '技术', life: '生活', ramble: '碎碎念' };

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function versionSceneAsset(value) {
  if (!value.includes('/assets/illustrations/web/')) return value;
  if (/[?&]v=20261010-scene-lite(?:&|#|$)/.test(value)) return value;
  const hashIndex = value.indexOf('#');
  const resource = hashIndex < 0 ? value : value.slice(0, hashIndex);
  const hash = hashIndex < 0 ? '' : value.slice(hashIndex);
  const separator = resource.includes('?') ? '&' : '?';
  return `${resource}${separator}v=20261010-scene-lite${hash}`;
}

function validateArticles(items) {
  const articleIds = new Set();
  for (const article of items) {
    if (!article || !idPattern.test(article.id) || articleIds.has(article.id)) {
      throw new Error(`Article id is missing, invalid or duplicated: ${article?.id ?? '(empty)'}`);
    }
    articleIds.add(article.id);
    if (!article.title || !article.excerpt || !article.date || !/^\d{4}-\d{2}-\d{2}$/.test(article.dateISO)) {
      throw new Error(`Article metadata is incomplete: ${article.id}`);
    }
    if (!categoryLabels[article.category] || article.categoryName !== categoryLabels[article.category]) {
      throw new Error(`Article category is invalid: ${article.id}`);
    }
    if (!Array.isArray(article.sections) || !article.sections.length) {
      throw new Error(`Article sections are missing: ${article.id}`);
    }
    if (article.intro !== undefined && (!Array.isArray(article.intro)
      || article.intro.some((paragraph) => typeof paragraph !== 'string'))) {
      throw new Error(`Article introduction is invalid: ${article.id}`);
    }
    if (article.illustration !== undefined) {
      const illustration = article.illustration;
      if (!illustration || typeof illustration !== 'object'
        || typeof illustration.src !== 'string' || !illustration.src.trim()
        || typeof illustration.alt !== 'string' || !illustration.alt.trim()
        || (illustration.motionSrc !== undefined
          && (typeof illustration.motionSrc !== 'string' || !illustration.motionSrc.trim())
          || illustration.motionSrcMobile !== undefined
          && (typeof illustration.motionSrcMobile !== 'string' || !illustration.motionSrcMobile.trim()
            || illustration.motionSrc === undefined))) {
        throw new Error(`Article illustration is invalid: ${article.id}`);
      }
    }
    const sectionIds = new Set();
    for (const section of article.sections) {
      if (!section || !idPattern.test(section.id) || sectionIds.has(section.id)) {
        throw new Error(`Section id is missing, invalid or duplicated in ${article.id}`);
      }
      sectionIds.add(section.id);
      if (!section.title || !Array.isArray(section.paragraphs) || !section.paragraphs.length || section.paragraphs.some((paragraph) => typeof paragraph !== 'string')) {
        throw new Error(`Section content is incomplete in ${article.id}#${section.id}`);
      }
      if (section.animation !== undefined) {
        const animation = section.animation;
        if (!animation || !Number.isInteger(animation.afterParagraph)
          || animation.afterParagraph < 0 || animation.afterParagraph >= section.paragraphs.length
          || typeof animation.src !== 'string' || !/^\.\.\/assets\/animations\/[a-z0-9-]+\.svg$/.test(animation.src)
          || typeof animation.caption !== 'string' || !animation.caption.trim()) {
          throw new Error(`Section animation is invalid in ${article.id}#${section.id}`);
        }
      }
      if (section.demo !== undefined && (!section.demo || section.demo.id !== 'motion-vocabulary'
        || !Number.isInteger(section.demo.afterParagraph) || section.demo.afterParagraph < 0
        || section.demo.afterParagraph >= section.paragraphs.length)) {
        throw new Error(`Section demo is invalid in ${article.id}#${section.id}`);
      }
    }
  }
}

function estimateReadMinutes(article) {
  const characterCount = article.sections.reduce(
    (total, section) => total + section.paragraphs.reduce((length, paragraph) => length + paragraph.length, 0),
    (article.intro ?? []).reduce((length, paragraph) => length + paragraph.length, 0),
  );
  return Math.max(1, Math.ceil(characterCount / 300));
}

function renderParagraph(paragraph) {
  const codeBlock = /^```(?:text)?\n([\s\S]*?)\n```$/.exec(paragraph);
  if (codeBlock) return `<pre><code>${escapeHTML(codeBlock[1])}</code></pre>`;
  const content = paragraph.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part) => {
    if (part.startsWith('`') && part.endsWith('`')) return `<code>${escapeHTML(part.slice(1, -1))}</code>`;
    if (part.startsWith('**') && part.endsWith('**')) return `<strong>${escapeHTML(part.slice(2, -2))}</strong>`;
    return escapeHTML(part);
  }).join('');
  return `<p>${content}</p>`;
}

function renderSections(article) {
  const waymarks = ['signpost', 'cairn', 'trail-flag', 'footsteps', 'cairn', 'summit'];
  const toc = article.sections.map((section) => (
    `<li><a href="#${escapeHTML(section.id)}">${escapeHTML(section.title)}</a></li>`
  )).join('\n');
  const body = article.sections.map((section, sectionIndex) => `
      <section class="post-section" aria-labelledby="${escapeHTML(section.id)}">
        <h2 id="${escapeHTML(section.id)}"><img class="post-section-mark" src="../assets/waymarks/${waymarks[sectionIndex % waymarks.length]}.svg" width="48" height="52" alt="" aria-hidden="true"><span>${escapeHTML(section.title)}</span></h2>
${section.paragraphs.map((paragraph, index) => `        ${renderParagraph(paragraph)}${section.animation?.afterParagraph === index ? renderAnimation(section.animation) : ''}${section.demo?.afterParagraph === index ? renderMotionDemo() : ''}`).join('\n')}
      </section>`).join('\n');
  return { toc, body };
}

function renderMotionDemo() {
  return `\n${readFileSync(path.join(root, 'assets/fragments/motion-vocabulary.html'), 'utf8').trim()}\n`;
}

function renderAnimation(animation) {
  const svg = readFileSync(path.resolve(postsDir, animation.src), 'utf8').trim();
  return `
        <figure class="post-animation" data-context-animation>
          ${svg}
          <figcaption>
            <span>${escapeHTML(animation.caption)}</span>
            <span class="post-animation-controls">
              <button type="button" data-animation-toggle hidden>暂停</button>
              <button type="button" data-animation-replay hidden>重播</button>
            </span>
          </figcaption>
        </figure>`;
}

function renderNeighbor(article, label, rel) {
  if (!article) {
    const emptyLabel = rel === 'prev' ? '暂无上一篇' : '暂无下一篇';
    return `<div class="post-neighbor post-neighbor--${rel} post-neighbor--empty"><span>${label}</span><strong>${emptyLabel}</strong></div>`;
  }
  return `<a class="post-neighbor post-neighbor--${rel}" href="${escapeHTML(`${article.id}.html`)}" rel="${rel}"><span>${label}</span><strong>${escapeHTML(article.title)}</strong></a>`;
}

function renderReadingTools() {
  return `<div class="post-reading-tools">
      <div class="reading-progress" data-reading-progress role="progressbar" aria-label="文章阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>
        <svg viewBox="0 0 46 46" aria-hidden="true" focusable="false"><circle class="reading-progress-track" cx="23" cy="23" r="20"/><circle class="reading-progress-arc" cx="23" cy="23" r="20" pathLength="100"/></svg>
        <span data-reading-percent>0%</span>
      </div>
      <a class="footer-back-top" href="#top">回到顶部 ↑</a>
    </div>`;
}

function renderArticle(article, index) {
  const previous = articles[index - 1];
  const next = articles[index + 1];
  const minutes = estimateReadMinutes(article);
  const { toc, body } = renderSections(article);
  const illustration = article.illustration;
  const illustrationMarkup = illustration
    ? `<img class="scene-image" src="${escapeHTML(versionSceneAsset(illustration.src))}"${illustration.motionSrc ? ` data-motion-src="${escapeHTML(versionSceneAsset(illustration.motionSrc))}"` : ''}${illustration.motionSrcMobile ? ` data-motion-src-mobile="${escapeHTML(versionSceneAsset(illustration.motionSrcMobile))}"` : ''} alt="${escapeHTML(illustration.alt)}">`
    : '';
  const title = escapeHTML(article.title);
  const description = escapeHTML(article.excerpt);
  const categoryName = escapeHTML(article.categoryName);
  const animationScript = article.sections.some((section) => section.animation)
    ? '  <script type="module" src="../context-animation.js?v=20261018-svg"></script>\n' : '';
  const demoAssets = article.sections.some((section) => section.demo)
    ? '  <link rel="stylesheet" href="../motion-vocabulary.css?v=20261028-menu-chevron">\n  <script type="module" src="../motion-vocabulary.js?v=20261028-soft-controls"></script>\n' : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <link rel="icon" type="image/svg+xml" href="../assets/branding/tree.svg?v=20261010-lyw-station">
  <meta charset="utf-8">
  <script src="../theme.js?v=20261029-dark-r2"></script>
  <script src="../page-transitions.js"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#fdfefe">
  <meta name="description" content="${description}">
  <title>${title} · LYW Station</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=DM+Sans:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="../site.css?v=20261010-avatar-icons">
  <link rel="stylesheet" href="../article.css?v=20261018-reading-waymarks">
  <script type="module" src="../site.js?v=20261029-dark" async></script>
${animationScript}${demoAssets}  <link rel="stylesheet" href="../theme.css?v=20261029-dark-r2">
</head>
<body data-page="post">
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <div class="site-shell">
    <header class="site-header" id="top">
      <a class="brand" href="../index.html" aria-label="回到主页"><span class="home-label">主页</span><svg class="home-ink" viewBox="0 0 60 12" aria-hidden="true" focusable="false"><path d="M3 5C17 3 38 7 56 4" /><path class="home-ink-echo" d="M9 9C25 7 40 10 51 8" /></svg></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="nav-toggle-label">打开菜单</span><span aria-hidden="true">☰</span></button>
      <nav class="main-nav" id="site-nav" aria-label="主要导航"><a href="../articles.html" aria-current="page">文章</a><a href="../works.html">作品</a><a href="../guestbook.html">留言</a><a href="../about.html">关于</a></nav>
    </header>
    <main id="main-content" class="post-page">
      <article class="post-article">
        <a class="post-back" href="../articles.html">← 返回文章列表</a>
        <header class="post-header">
          <h1 class="post-title">${title}</h1>
          <p class="post-excerpt">${description}</p>
          <div class="post-meta"><span class="post-category">${categoryName}</span><time datetime="${escapeHTML(article.dateISO)}">${escapeHTML(article.date)}</time><span>约 ${minutes} 分钟</span></div>
        </header>
        <details class="post-toc post-toc--mobile">
          <summary>这一页的目录</summary>
          <nav aria-label="文章目录"><ol>
${toc}
          </ol></nav>
        </details>
        <div class="post-content">
${(article.intro ?? []).map((paragraph) => `        ${renderParagraph(paragraph)}`).join('\n')}${body}
        </div>
        <figure class="post-illustration" data-post-image-slot${illustration ? '' : ' hidden'}>${illustrationMarkup}</figure>
        <nav class="post-pagination" aria-label="前后文章">
          ${renderNeighbor(previous, '上一篇', 'prev')}
          <a class="post-list-link" href="../articles.html"><svg class="post-list-arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7 5 3 9l4 4M3.5 9H12c4.5 0 5 3.5 3 6" /></svg><span class="post-list-label">返回文章列表<svg class="post-list-ink" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M3 5C30 3 68 7 116 4" /><path class="post-list-echo" d="M12 9C43 7 77 10 106 8" /></svg></span></a>
          ${renderNeighbor(next, '下一篇', 'next')}
        </nav>
      </article>
      <aside class="post-sidebar post-toc--desktop" aria-labelledby="post-toc-title">
        <div class="post-sidebar-inner">
          <h2 id="post-toc-title">这一页的目录</h2>
          <nav aria-labelledby="post-toc-title"><ol>
${toc}
          </ol></nav>
        </div>
      </aside>
    </main>
    <footer class="site-footer"><a class="footer-brand" href="../index.html">LYW Station</a><a class="site-filing" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">粤ICP备2026096103号-1</a><nav class="footer-social" aria-label="社交链接"><a class="footer-social-link" href="https://github.com/drunk-cat423" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 18.5c-3.7 1.1-3.7-1.8-5.2-2.2m10.4 4v-2.8c0-.8.1-1.4-.4-1.9 3.2-.4 6.5-1.6 6.5-7.2a5.6 5.6 0 0 0-1.5-3.9 5.2 5.2 0 0 0-.1-3.9s-1.2-.4-4 1.5a13.8 13.8 0 0 0-7.3 0C3.6.2 2.4.6 2.4.6a5.2 5.2 0 0 0-.1 3.9A5.6 5.6 0 0 0 .8 8.4c0 5.6 3.3 6.8 6.5 7.2-.4.4-.5 1-.4 1.9v2.8"/></svg><span>GitHub</span></a><button class="footer-social-link footer-social-link--disabled" type="button" disabled aria-label="RSS 稍后开放" title="RSS 稍后开放"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="19" r="1.2"/><path d="M4 11a9 9 0 0 1 9 9M4 5a15 15 0 0 1 15 15"/></svg><span>RSS</span></button></nav>${renderReadingTools()}</footer>
  </div>
</body>
</html>
`;
}

validateArticles(articles);
await mkdir(postsDir, { recursive: true });
for (const [index, article] of articles.entries()) {
  const destination = path.join(postsDir, `${article.id}.html`);
  await writeFile(destination, renderArticle(article, index), 'utf8');
  console.log(`Wrote posts/${article.id}.html`);
}
