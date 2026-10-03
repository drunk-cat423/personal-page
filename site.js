import { articles, works, messages } from './content.js';

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
  titleLink.href = `article.html?id=${encodeURIComponent(article.id)}`;
  titleLink.append(element('h3', '', article.title));
  titleWrap.append(titleLink);
  const copy = element('p', 'article-excerpt', article.excerpt);
  const category = element('span', 'article-category', article.categoryName);
  row.append(meta, titleWrap, copy, category);
  return row;
}

function makeWorkCover(cover) {
  const container = element('div', 'work-cover');
  container.dataset.cover = cover;
  container.setAttribute('aria-hidden', 'true');
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
  const link = element('a', 'work-cover-link');
  link.href = `work.html?id=${encodeURIComponent(work.id)}`;
  link.setAttribute('aria-label', `查看作品概念：${work.title}`);
  link.append(makeWorkCover(work.cover));
  const copy = element('div', 'work-copy');
  const meta = element('div', 'work-meta');
  meta.append(element('time', '', work.date), element('span', '', work.categoryName));
  const title = element('h3', 'work-title');
  const titleLink = element('a', '', work.title);
  titleLink.href = `work.html?id=${encodeURIComponent(work.id)}`;
  title.append(titleLink);
  const excerpt = element('p', 'work-excerpt', work.excerpt);
  const more = element('a', 'text-link', '看看这个想法 →');
  more.href = titleLink.href;
  copy.append(meta, title, excerpt, more);
  row.append(link, copy);
  return row;
}

function makeMessageRow(message, isDemo = false) {
  const row = element('article', 'message-row');
  const meta = element('div', 'message-meta');
  meta.append(element('strong', 'message-author', message.author));
  const date = element('time', 'message-date', message.date);
  date.dateTime = message.dateISO;
  meta.append(date);
  const body = element('p', 'message-body', message.body);
  row.append(meta, body);
  if (message.reply) {
    const reply = element('div', 'owner-reply');
    reply.append(element('strong', 'reply-label', '晴屿 · 回复'), element('p', 'reply-body', message.reply));
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
  const validCategories = new Set(['all', 'tech', 'life']);
  const url = new URL(location.href);
  let activeCategory = validCategories.has(url.searchParams.get('category')) ? (url.searchParams.get('category') || 'all') : 'all';

  function render(updateUrl = false) {
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
    const visible = activeCategory === 'all' ? articles : articles.filter((article) => article.category === activeCategory);
    list.replaceChildren(...visible.map(makeArticleRow));
    count.textContent = `共 ${visible.length} 篇`;
    document.title = `${activeCategory === 'all' ? '文章' : activeCategory === 'tech' ? '技术文章' : '生活文章'} · 晴屿`;
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
    document.title = `${type === 'article' ? '文章' : '作品'}未找到 · 晴屿`;
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
    meta.append(element('time', '', item.date), element('span', '', item.categoryName), element('span', '', '概念示例'));
  }
  const content = $('[data-detail-content]', detail);
  item.paragraphs.forEach((text) => content.append(element('p', '', text)));
  document.title = `${item.title} · 晴屿`;
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
  const image = $('.scene-image[data-motion-src]');
  const toggle = $('.motion-toggle');
  if (!image || !toggle) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const stillUrl = new URL(image.getAttribute('src'), location.href).href;
  const movingUrl = new URL(image.dataset.motionSrc, location.href).href;
  let paused = false;
  let failed = false;
  let frame = 0;

  function sync() {
    frame = 0;
    const bounds = image.getBoundingClientRect();
    const visible = bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth;
    const reduced = preference.matches;
    const moving = visible && !document.hidden && !reduced && !paused && !failed;
    const nextUrl = moving ? movingUrl : stillUrl;
    if (image.src !== nextUrl) image.src = nextUrl;
    image.dataset.motionState = moving ? 'running' : 'still';
    toggle.disabled = reduced || failed;
    toggle.setAttribute('aria-pressed', String(reduced || paused || failed));
    toggle.textContent = reduced || failed ? '静态插画' : paused ? '开启微风' : '暂停微风';
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  image.addEventListener('error', () => {
    if (image.src === movingUrl) { failed = true; sync(); }
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
if (page === 'article') renderDetail(articles, 'article');
if (page === 'works') {
  const list = $('[data-work-list]');
  if (list) works.forEach((work) => list.append(makeWorkRow(work)));
}
if (page === 'work') renderDetail(works, 'work');
if (page === 'guestbook') renderGuestbook();
