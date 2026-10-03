const articles = [
  { id: 'small-things', category: 'idea', categoryName: '想法', date: '2026.09.18', dateISO: '2026-09-18', title: '把注意力，还给那些小事', excerpt: '一杯刚好的茶，路边的树影，还有今天终于读完的那几页书。', paragraphs: ['最近试着把一天里的空隙还给自己。走路时不急着听点什么，吃饭时也不把手机放在手边。起初总觉得少做了些事情，后来才发现，原来那些小事一直都在，只是我走得太快。','傍晚把窗子打开，风带进来一点潮湿的草木气味。水壶刚好烧开，书页停在一个没读完的段落。没有什么特别的安排，但这一刻很完整。','也许所谓留意生活，并不是要把每件事都变成值得记录的故事。只是偶尔停一下，让正在发生的日子好好经过。'], featured: true },
  { id: 'little-tool', category: 'making', categoryName: '折腾', date: '2026.09.06', dateISO: '2026-09-06', title: '一个小工具的诞生', excerpt: '从一个总被忘记的小问题开始，慢慢做出能用的第一版。', paragraphs: ['这个小工具的起点很普通：我总把临时记下的灵感放得到处都是。手机备忘录里一条，桌面便签里几条，纸上还有半句没写完的话。','于是先做了一个只解决一件事的页面。没有账号，也没有复杂的分类，打开就能记下，再按自己想要的方式找回来。第一个版本很朴素，但终于能把散落的句子放在同一个地方。','接下来还想试试更舒服的浏览方式。先让它安静地长一阵子，再决定下一步。'] },
  { id: 'coast-walk', category: 'life', categoryName: '生活', date: '2026.08.27', dateISO: '2026-08-27', title: '沿着海风，走一段没有目的的路', excerpt: '不赶着抵达哪里，只记得浪声一阵一阵从身边经过。', paragraphs: ['沿海的小路绕过几片低矮的草地，尽头没有什么特别的景点。我只是沿着风吹来的方向走，走到鞋面沾了细沙，才发现已经过了很久。','海面上的光一闪一闪。远处有人收起帆，岸边的小屋开着窗，窗帘被风轻轻带起来。那段路没有给我答案，只让心里原本很拥挤的地方松了一些。','回去时天色还亮着。这样就很好。'] },
  { id: 'unfinished-ideas', category: 'idea', categoryName: '想法', date: '2026.08.12', dateISO: '2026-08-12', title: '给未完成的想法留一个位置', excerpt: '有些念头还不完整，也可以先被好好放着。', paragraphs: ['以前总想等想法足够清楚，才开始写下来。结果很多时候，它们还没长成一句完整的话，就已经被下一件事盖住。','现在会先留一个小小的位置：一张纸、一段语音，或一句很短的描述。暂时不用判断它能不能变成什么，也不用急着把它整理得漂亮。','未完成并不等于没有价值。也许某天再看见它时，就刚好知道接下来怎么走。'] },
];

const projects = [
  { title: '一扇可以慢慢打开的窗', label: 'A SMALL WEB EXPERIMENT', paragraphs: ['这是一个关于收藏日常片刻的小页面练习。把一句文字、当天的天气和一小块留白放在一起，让每次打开时都像推开窗户。','目前它还是一个概念草稿，接下来会继续尝试更适合阅读和回看的方式。这里展示的是设计方向示例，没有外部链接或在线服务。'] },
  { title: '给未完成的想法留个位置', label: 'A NOTE-KEEPING TOOL', paragraphs: ['一个很轻的灵感收纳练习，重点是让还没想清楚的事情也有地方停靠。先记下来，之后再决定要不要继续。','它目前只是一个概念说明，页面上的按钮用来查看这段介绍，不会跳转到仓库或外部产品。'] },
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const noteList = $('#note-list');
const filters = $$('.filter-tab');
const savedIds = new Set();
const reader = $('#reader-dialog');
let activeFilter = 'all';
let lastTrigger = null;

function createMeta(article) {
  const meta = document.createElement('div');
  meta.className = 'article-meta';
  const date = document.createElement('time');
  date.dateTime = article.dateISO;
  date.textContent = article.date;
  const dot = document.createElement('span');
  dot.className = 'meta-dot';
  dot.setAttribute('aria-hidden', 'true');
  const category = document.createElement('span');
  category.className = 'category-label';
  category.textContent = article.categoryName;
  const sample = document.createElement('span');
  sample.textContent = '示例文章';
  meta.append(date, dot, category, sample);
  return meta;
}

function createBookmark(article) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bookmark-button';
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/journal-symbols.svg#i-bookmark"/></svg>';
  function update() {
    const saved = savedIds.has(article.id);
    button.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}《${article.title}》`);
    button.setAttribute('aria-pressed', String(saved));
  }
  update();
  button.addEventListener('click', () => {
    if (savedIds.has(article.id)) savedIds.delete(article.id);
    else savedIds.add(article.id);
    $('#saved-total').textContent = savedIds.size;
    update();
  });
  return button;
}

function openReader({ title, label, paragraphs, date, dateISO, categoryName }, trigger) {
  lastTrigger = trigger;
  $('#reader-title').textContent = title;
  $('#reader-kicker').textContent = label || 'A QUIET NOTE';
  const meta = $('#reader-meta');
  meta.replaceChildren();
  if (date) {
    const time = document.createElement('time');
    time.dateTime = dateISO;
    time.textContent = date;
    const category = document.createElement('span');
    category.textContent = ` · ${categoryName} · 示例内容`;
    meta.append(time, category);
  } else {
    meta.textContent = '示例作品 · 设计概念';
  }
  $('#reader-content').replaceChildren(...paragraphs.map((copy) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = copy;
    return paragraph;
  }));
  reader.showModal();
  reader.scrollTop = 0;
  $('#reader-close').focus();
}

function makeFeature(article) {
  const card = document.createElement('article');
  card.className = 'note-feature';
  card.setAttribute('aria-label', `示例文章：${article.title}`);
  const content = document.createElement('div');
  content.className = 'note-feature-content';
  content.append(createMeta(article));
  const title = document.createElement('h3');
  title.textContent = article.title;
  const excerpt = document.createElement('p');
  excerpt.textContent = article.excerpt;
  content.append(title, excerpt);
  const note = document.createElement('span');
  note.className = 'feature-aside';
  note.textContent = 'a small reminder';
  card.append(note);
  const bottom = document.createElement('div');
  bottom.className = 'feature-bottom';
  const read = document.createElement('button');
  read.className = 'read-link';
  read.type = 'button';
  read.innerHTML = '继续读这篇 <svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/journal-symbols.svg#i-arrow"/></svg>';
  read.addEventListener('click', () => openReader(article, read));
  bottom.append(read, createBookmark(article));
  content.append(bottom);
  card.append(content);
  return card;
}

function makeRow(article) {
  const row = document.createElement('article');
  row.className = 'note-row';
  const open = document.createElement('button');
  open.className = 'note-row-main';
  open.type = 'button';
  open.setAttribute('aria-label', `阅读《${article.title}》，示例文章`);
  const title = document.createElement('h3');
  title.textContent = article.title;
  const excerpt = document.createElement('p');
  excerpt.textContent = article.excerpt;
  open.append(createMeta(article), title, excerpt);
  open.addEventListener('click', () => openReader(article, open));
  row.append(open, createBookmark(article));
  return row;
}

function renderNotes() {
  const visible = articles.filter((article) => activeFilter === 'all' || article.category === activeFilter);
  noteList.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '这一页还空着，等新的小事来到这里。';
    noteList.append(empty);
    return;
  }
  const featured = visible.find((article) => article.featured) || visible[0];
  const rows = visible.filter((article) => article !== featured);
  noteList.classList.toggle('is-single', rows.length === 0);
  noteList.append(makeFeature(featured));
  if (rows.length) {
    const rowList = document.createElement('div');
    rowList.className = 'note-row-list';
    rows.forEach((article) => rowList.append(makeRow(article)));
    noteList.append(rowList);
  }
}

function setFilter(filter) {
  activeFilter = filter;
  const selectedTab = filters.find((tab) => tab.dataset.filter === filter) || filters[0];
  filters.forEach((tab) => {
    const selected = tab === selectedTab;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  noteList.setAttribute('aria-labelledby', selectedTab.id);
  renderNotes();
  scheduleNavUpdate();
}

filters.forEach((tab, index) => {
  tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  tab.addEventListener('keydown', (event) => {
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % filters.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + filters.length) % filters.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = filters.length - 1;
    if (next !== null) {
      event.preventDefault();
      filters[next].focus();
      setFilter(filters[next].dataset.filter);
    }
  });
});

$$('.quick-links a[data-filter]').forEach((link) => link.addEventListener('click', () => setFilter(link.dataset.filter)));
$$('.project-open').forEach((button) => button.addEventListener('click', () => openReader(projects[Number(button.dataset.project)], button)));
$('#reader-close').addEventListener('click', () => reader.close());
reader.addEventListener('click', (event) => { if (event.target === reader) reader.close(); });
reader.addEventListener('close', () => { if (lastTrigger?.isConnected) lastTrigger.focus(); });

const navLinks = $$('.main-nav a');
const navSections = $$('.section-block');
let navFrame = 0;
function updateCurrentSection() {
  navFrame = 0;
  const scrollSurface = document.scrollingElement;
  const atBottom = scrollSurface.scrollTop + scrollSurface.clientHeight >= scrollSurface.scrollHeight - 2;
  const readingLine = window.innerHeight * .42;
  let sectionId = 'notes';
  navSections.forEach((section) => { if (section.getBoundingClientRect().top <= readingLine) sectionId = section.id; });
  if (atBottom) sectionId = 'about';
  navLinks.forEach((link) => {
    const selected = link.hash === `#${sectionId}`;
    link.classList.toggle('is-current', selected);
    if (selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function scheduleNavUpdate() {
  if (!navFrame) navFrame = requestAnimationFrame(updateCurrentSection);
}
window.addEventListener('scroll', scheduleNavUpdate, { passive: true });
window.addEventListener('resize', scheduleNavUpdate);
renderNotes();
updateCurrentSection();
