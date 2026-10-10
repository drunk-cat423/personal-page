import { articles, works, messages } from './content.js?v=20261010-detective-ink';
import { setupPoseScene } from './scene-player.js?v=20261010-pose-player';
import { createCommentAvatar } from './comment-avatars.js?v=20261010-avatars-footer';

if (document.readyState === 'loading') {
  await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

const $ = (selector, root = document) => root.querySelector(selector);
const page = document.body.dataset.page;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeArticleRow(article) {
  const row = element('article', 'article-row');
  const meta = element('div', 'article-meta');
  const date = element('time', '', article.date);
  date.dateTime = article.dateISO;
  meta.append(date);
  const titleWrap = element('div', 'article-title');
  const titleLink = element('a');
  titleLink.href = `posts/${encodeURIComponent(article.id)}.html`;
  titleLink.append(element('h3', '', article.title));
  titleWrap.append(titleLink);
  const copy = element('p', 'article-excerpt', article.excerpt);
  const category = element('span', 'article-category', article.categoryName);
  row.append(meta, titleWrap, copy, category);
  return row;
}

function makeWorkCover(cover, coverImage) {
  const container = element('div', 'work-cover');
  container.dataset.cover = cover;
  container.setAttribute('aria-hidden', 'true');
  if (coverImage) {
    container.classList.add('has-screenshot');
    const image = element('img', 'work-screenshot');
    image.src = coverImage;
    image.alt = '';
    image.width = 2560;
    image.height = 1700;
    image.loading = 'lazy';
    image.decoding = 'async';
    container.append(image);
    return container;
  }
  const window = element('div', 'cover-window');
  const toolbar = element('div', 'cover-toolbar');
  for (let index = 0; index < 3; index += 1) toolbar.append(element('i', 'cover-dot'));
  const body = element('div', 'cover-body');
  if (cover === 'window') {
    body.append(element('span', 'cover-note', '09:18 · 小小的天气'), element('strong', 'cover-title', '今天也有一点晴'), element('span', 'cover-line'), element('span', 'cover-line short'));
  } else if (cover === 'notes') {
    body.append(element('span', 'cover-note', '灵感清单 · 03'), element('strong', 'cover-title', '先记下来'), element('span', 'cover-line'), element('span', 'cover-line short'));
  } else {
    body.append(element('span', 'cover-note', '七月 · 片刻档案'), element('strong', 'cover-title', '留住这一页'), element('span', 'cover-line'), element('span', 'cover-line short'));
  }
  window.append(toolbar, body);
  container.append(window);
  return container;
}

function makeWorkRow(work) {
  const row = element('article', 'work-row');
  const href = work.url || `work.html?id=${encodeURIComponent(work.id)}`;
  function configureLink(link) {
    link.href = href;
    link.setAttribute('aria-label', work.url ? `打开作品：${work.title}（新标签页）` : `查看作品：${work.title}`);
    if (work.url) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = '在新标签页打开作品';
    }
  }
  const link = element('a', 'work-cover-link');
  configureLink(link);
  link.append(makeWorkCover(work.cover, work.coverImage));
  const copy = element('div', 'work-copy');
  const meta = element('div', 'work-meta');
  meta.append(element(work.status ? 'span' : 'time', '', work.status || work.date), element('span', '', work.categoryName));
  const title = element('h3', 'work-title');
  const titleLink = element('a', '', work.title);
  configureLink(titleLink);
  title.append(titleLink);
  const excerpt = element('p', 'work-excerpt', work.excerpt);
  copy.append(meta, title, excerpt);
  row.append(link, copy);
  return row;
}

function makeMessageRow(message, isDemo = false) {
  const row = element('article', 'message-row');
  const meta = element('div', 'message-meta');
  const author = element('div', 'message-author-group');
  author.append(createCommentAvatar(message.author), element('strong', 'message-author', message.author));
  meta.append(author);
  const date = element('time', 'message-date', message.date);
  date.dateTime = message.dateISO;
  meta.append(date);
  const body = element('p', 'message-body', message.body);
  row.append(meta, body);
  if (message.reply) {
    const reply = element('div', 'owner-reply');
    const replyAuthor = element('div', 'reply-author-group');
    replyAuthor.append(createCommentAvatar('LYW', 'comment-avatar--reply'), element('strong', 'reply-label', 'LYW · 回复'));
    reply.append(replyAuthor, element('p', 'reply-body', message.reply));
    row.append(reply);
  } else if (isDemo) {
    row.append(element('p', 'demo-label', '仅保存在此浏览器 · 尚未公开'));
  }
  return row;
}

function renderHome() {
  const articleList = $('[data-home-articles]');
  const workList = $('[data-home-works]');
  const messageList = $('[data-home-messages]');
  if (!articleList || !workList || !messageList) return;
  articles.slice(0, 4).forEach((article) => articleList.append(makeArticleRow(article)));
  works.slice(0, 2).forEach((work) => workList.append(makeWorkRow(work)));
  messages.slice(0, 2).forEach((message) => messageList.append(makeMessageRow(message)));
}

function renderArticles() {
  const list = $('[data-article-list]');
  if (!list) return;
  const buttons = [...$$('[data-category]')];
  const count = $('[data-article-count]');
  const validCategories = new Set(['all', 'tech', 'life', 'ramble']);
  const url = new URL(location.href);
  let activeCategory = validCategories.has(url.searchParams.get('category')) ? (url.searchParams.get('category') || 'all') : 'all';

  function render(updateUrl = false) {
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
    const visible = activeCategory === 'all' ? articles : articles.filter((article) => article.category === activeCategory);
    list.replaceChildren(...visible.map(makeArticleRow));
    list.setAttribute('aria-busy', 'false');
    list.classList.add('content-ready');
    count.textContent = `共 ${visible.length} 篇`;
    document.title = `${activeCategory === 'all' ? '文章' : activeCategory === 'tech' ? '技术文章' : activeCategory === 'life' ? '生活文章' : '碎碎念文章'} · LYW Station`;
    if (updateUrl) {
      const next = new URL(location.href);
      if (activeCategory === 'all') next.searchParams.delete('category');
      else next.searchParams.set('category', activeCategory);
      history.pushState({ category: activeCategory }, '', `${next.pathname}${next.search}${next.hash}`);
    }
  }

  buttons.forEach((button) => button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    render(true);
  }));
  window.addEventListener('popstate', () => {
    const selected = new URL(location.href).searchParams.get('category') || 'all';
    activeCategory = validCategories.has(selected) ? selected : 'all';
    render();
  });
  render();
}

function renderDetail(items, type) {
  const detail = $(`[data-${type}-detail]`);
  if (!detail) return;
  const id = new URLSearchParams(location.search).get('id');
  const item = items.find((entry) => entry.id === id);
  const notFound = $('[data-not-found]');
  if (!item) {
    detail.hidden = true;
    notFound.hidden = false;
    document.title = `${type === 'article' ? '文章' : '作品'}未找到 · LYW Station`;
    return;
  }
  $('[data-detail-title]', detail).textContent = item.title;
  $('[data-detail-excerpt]', detail).textContent = item.excerpt;
  const meta = $('[data-detail-meta]', detail);
  if (type === 'article') {
    const date = element('time', '', item.date);
    date.dateTime = item.dateISO;
    meta.append(date, element('span', 'category-label', item.categoryName));
  } else {
    meta.append(element('time', '', item.date), element('span', '', item.categoryName), element('span', '', item.status || '概念示例'));
  }
  const content = $('[data-detail-content]', detail);
  item.paragraphs.forEach((text) => content.append(element('p', '', text)));
  if (type === 'work' && item.url) {
    const visit = element('a', 'text-link', '打开作品 ↗');
    visit.href = item.url;
    visit.target = '_blank';
    visit.rel = 'noopener noreferrer';
    visit.setAttribute('aria-label', `打开作品：${item.title}（新标签页）`);
    content.append(visit);
  }
  document.title = `${item.title} · LYW Station`;
}

function openArticleLink() {
  const id = new URLSearchParams(location.search).get('id');
  const article = articles.find(item => item.id === id);
  if (article) {
    const target = new URL(`posts/${encodeURIComponent(article.id)}.html`, document.baseURI);
    target.hash = location.hash;
    location.replace(target.href);
    return;
  }
  $('[data-article-opening]').hidden = true;
  $('[data-not-found]').hidden = false;
  document.title = '文章未找到 · LYW Station';
}

const GUESTBOOK_KEY = 'qingyu.guestbook-demo.v1';
const MAX_SAVED_MESSAGES = 50;

function readDemoMessages() {
  const raw = localStorage.getItem(GUESTBOOK_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('留言数据格式无法读取');
  return parsed.filter((item) => item && typeof item.id === 'string' &&
    typeof item.author === 'string' && item.author.trim().length > 0 && item.author.length <= 32 &&
    typeof item.body === 'string' && item.body.trim().length > 0 && item.body.length <= 1000 &&
    typeof item.dateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dateISO) &&
    typeof item.date === 'string').slice(0, MAX_SAVED_MESSAGES);
}

function renderGuestbook() {
  const publicList = $('[data-message-list]');
  const personalList = $('[data-personal-messages]');
  if (!publicList || !personalList) return;
  messages.forEach((message) => publicList.append(makeMessageRow(message)));
  const status = $('[data-form-status]');
  const form = $('#guestbook-form');
  function renderPersonal() {
    personalList.replaceChildren();
    try {
      const saved = readDemoMessages();
      if (!saved.length) {
        personalList.append(element('p', 'empty-state', '还没有保存的演示留言。'));
        return true;
      }
      saved.forEach((message) => personalList.append(makeMessageRow(message, true)));
      return true;
    } catch {
      personalList.append(element('p', 'empty-state', '暂时无法读取本地演示留言；请检查浏览器的本地存储设置。'));
      return false;
    }
  }

  renderPersonal();
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const author = $('#guest-name').value.trim();
    const body = $('#guest-message').value.trim();
    if (!author || !body) {
      status.textContent = '请填写称呼和留言内容。';
      return;
    }
    const now = new Date();
    const item = {
      id: `demo-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      author: author.slice(0, 32), body: body.slice(0, 1000),
      dateISO: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      date: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
    };
    try {
      const saved = readDemoMessages();
      const next = [item, ...saved].slice(0, MAX_SAVED_MESSAGES);
      localStorage.setItem(GUESTBOOK_KEY, JSON.stringify(next));
    } catch {
      status.textContent = '无法保存到此浏览器。请检查本地存储空间或隐私设置，填写内容仍保留在表单中。';
      return;
    }
    renderPersonal();
    form.reset();
    status.textContent = '已保存为演示留言，尚未公开。';
    status.tabIndex = -1;
    status.focus();
  });
}

function setupNavigation() {
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  if (!toggle || !nav) return;
  const label = $('.nav-toggle-label', toggle);
  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    label.textContent = '打开菜单';
  }
  const mobileLayout = matchMedia('(max-width: 640px)');
  mobileLayout.addEventListener('change', closeMenu);
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    label.textContent = expanded ? '关闭菜单' : '打开菜单';
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });
}

function setupPostContents() {
  const headings = $$('.post-section h2[id]');
  const links = $$('.post-toc a[href^="#"], .post-sidebar a[href^="#"]');
  if (!headings.length || !links.length) return;
  let frame = 0;
  let currentId;
  const hashTarget = () => headings.find(heading => `#${heading.id}` === location.hash)?.id;
  let anchorTarget = hashTarget();

  function markCurrent(id) {
    if (id === currentId) return;
    currentId = id;
    links.forEach((link) => {
      if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function sync() {
    frame = 0;
    if (anchorTarget) {
      markCurrent(anchorTarget);
      return;
    }
    let current = headings[0];
    const threshold = Math.min(160, innerHeight * .25);
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= threshold) current = heading;
    }
    const scrollable = document.documentElement.scrollHeight > innerHeight + 2;
    if (scrollable && scrollY > 0 && Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2) current = headings.at(-1);
    markCurrent(current.id);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('.post-toc a[href^="#"], .post-sidebar a[href^="#"]');
    if (link) {
      anchorTarget = link.hash.slice(1);
      markCurrent(anchorTarget);
    }
  });
  function resumeTracking() {
    anchorTarget = undefined;
    schedule();
  }
  document.addEventListener('wheel', resumeTracking, { passive: true });
  document.addEventListener('touchmove', resumeTracking, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest?.('.post-toc, .post-sidebar')) resumeTracking();
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.closest?.('input, textarea, [contenteditable="true"]')) return;
    if (event.key === ' ' && event.target.closest?.('button, summary, select, [role="button"]')) return;
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) resumeTracking();
  });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', () => { anchorTarget = hashTarget(); schedule(); });
  sync();
}

function setupSectionMarks() {
  if (page !== 'home') return;
  const marks = $$('[data-section-mark]');
  if (!marks.length) return;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (prefersReducedMotion) {
    marks.forEach((mark) => mark.classList.add('is-drawn'));
    return;
  }
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-drawn');
      observer.unobserve(entry.target);
    });
  });
  marks.forEach((mark) => observer.observe(mark));
}

function setupSceneMotion() {
  document.querySelectorAll('link[data-scene-preload]').forEach((link) => link.remove());
  document.querySelectorAll('.scene-image[data-scene-poses]').forEach(setupPoseScene);
  const image = $('.scene-image[data-motion-src]:not([data-scene-poses])');
  if (!image) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 600px)').matches;
  const motionSource = mobile && image.dataset.motionSrcMobile ? image.dataset.motionSrcMobile : image.dataset.motionSrc;
  const posterUrl = new URL(mobile && image.dataset.posterMobile ? image.dataset.posterMobile : image.getAttribute('src'), document.baseURI).href;
  const movingUrl = new URL(motionSource, document.baseURI).href;
  const posterSrcset = image.getAttribute('srcset');
  const posterSizes = image.getAttribute('sizes');
  let failed = false;
  let frame = 0;
  let movingImage;
  let motionReady = false;

  function prepareMotion() {
    if (movingImage) return;
    movingImage = new Image();
    movingImage.src = movingUrl;
    movingImage.decode().then(() => {
      motionReady = true;
      sync();
    }).catch(() => {
      failed = true;
      sync();
    });
  }

  function sync() {
    frame = 0;
    const bounds = image.getBoundingClientRect();
    const visible = bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth;
    const reduced = preference.matches;
    const wantsMovement = visible && !document.hidden && !reduced && !failed;
    if (wantsMovement) prepareMotion();
    const moving = wantsMovement && motionReady;
    if (moving) {
      if (image.hasAttribute('srcset')) image.removeAttribute('srcset');
      if (image.hasAttribute('sizes')) image.removeAttribute('sizes');
      if (image.src !== movingUrl) image.src = movingUrl;
    } else {
      if (image.src !== posterUrl) image.src = posterUrl;
      if (posterSrcset) image.setAttribute('srcset', posterSrcset);
      if (posterSizes) image.setAttribute('sizes', posterSizes);
    }
    image.dataset.motionState = moving ? 'running' : wantsMovement ? 'loading' : 'still';
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }
  image.addEventListener('error', () => {
    if (image.src === movingUrl || image.currentSrc === movingUrl) { failed = true; sync(); }
  });
  preference.addEventListener('change', sync);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  sync();
}

const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
setupNavigation();
setupSectionMarks();
setupSceneMotion();
if (page === 'home') renderHome();
if (page === 'articles') renderArticles();
if (page === 'article') openArticleLink();
if (page === 'post') setupPostContents();
if (page === 'works') {
  const list = $('[data-work-list]');
  if (list) {
    list.replaceChildren(...works.map(makeWorkRow));
    list.setAttribute('aria-busy', 'false');
    list.classList.add('content-ready');
  }
}
if (page === 'work') renderDetail(works, 'work');
if (page === 'guestbook') renderGuestbook();
