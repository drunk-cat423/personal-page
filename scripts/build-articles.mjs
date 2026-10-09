import { mkdir, writeFile } from 'node:fs/promises';
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
    if (article.illustration !== undefined) {
      const illustration = article.illustration;
      if (!illustration || typeof illustration !== 'object'
        || typeof illustration.src !== 'string' || !illustration.src.trim()
        || typeof illustration.alt !== 'string' || !illustration.alt.trim()
        || (illustration.motionSrc !== undefined
          && (typeof illustration.motionSrc !== 'string' || !illustration.motionSrc.trim()))) {
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
    }
  }
}

function estimateReadMinutes(article) {
  const characterCount = article.sections.reduce(
    (total, section) => total + section.paragraphs.reduce((length, paragraph) => length + paragraph.length, 0),
    0,
  );
  return Math.max(1, Math.ceil(characterCount / 300));
}

function renderSections(article) {
  const toc = article.sections.map((section) => (
    `<li><a href="#${escapeHTML(section.id)}">${escapeHTML(section.title)}</a></li>`
  )).join('\n');
  const body = article.sections.map((section) => `
      <section class="post-section" aria-labelledby="${escapeHTML(section.id)}">
        <h2 id="${escapeHTML(section.id)}">${escapeHTML(section.title)}</h2>
${section.paragraphs.map((paragraph) => `        <p>${escapeHTML(paragraph)}</p>`).join('\n')}
      </section>`).join('\n');
  return { toc, body };
}

function renderNeighbor(article, label, rel) {
  if (!article) {
    const emptyLabel = rel === 'prev' ? '暂无上一篇' : '暂无下一篇';
    return `<div class="post-neighbor post-neighbor--${rel} post-neighbor--empty"><span>${label}</span><strong>${emptyLabel}</strong></div>`;
  }
  return `<a class="post-neighbor post-neighbor--${rel}" href="${escapeHTML(`${article.id}.html`)}" rel="${rel}"><span>${label}</span><strong>${escapeHTML(article.title)}</strong></a>`;
}

function renderArticle(article, index) {
  const previous = articles[index - 1];
  const next = articles[index + 1];
  const minutes = estimateReadMinutes(article);
  const { toc, body } = renderSections(article);
  const illustration = article.illustration;
  const illustrationMarkup = illustration
    ? `<img class="scene-image" src="${escapeHTML(illustration.src)}"${illustration.motionSrc ? ` data-motion-src="${escapeHTML(illustration.motionSrc)}"` : ''} alt="${escapeHTML(illustration.alt)}">`
    : '';
  const title = escapeHTML(article.title);
  const description = escapeHTML(article.excerpt);
  const categoryName = escapeHTML(article.categoryName);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <script src="../page-transitions.js"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#fdfefe">
  <meta name="description" content="${description}">
  <title>${title} · 晴屿</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=DM+Sans:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="../site.css">
  <link rel="stylesheet" href="../article.css">
  <script type="module" src="../site.js" async></script>
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
${body}
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
    <footer class="site-footer"><a class="footer-brand" href="../index.html">晴屿 <span>·</span> A QUIET PLACE</a><p>初版预览 · 内容为示例</p><a href="#top">回到顶部 ↑</a></footer>
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
