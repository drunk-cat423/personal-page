export const articles = [
  {
    id: 'small-things', category: 'life', categoryName: '生活', dateISO: '2026-09-18', date: '2026.09.18',
    title: '把注意力，还给那些小事', excerpt: '一杯刚好的茶，路边的树影，还有今天终于读完的那几页书。',
    sections: [
      { id: 'small-things-gap', title: '把空隙还给自己', paragraphs: ['最近试着把一天里的空隙还给自己。走路时不急着听点什么，吃饭时也不把手机放在手边。起初总觉得少做了些事情，后来才发现，原来那些小事一直都在，只是我走得太快。'] },
      { id: 'small-things-evening', title: '一段完整的傍晚', paragraphs: ['傍晚把窗子打开，风带进来一点潮湿的草木气味。水壶刚好烧开，书页停在一个没读完的段落。没有什么特别的安排，但这一刻很完整。'] },
      { id: 'small-things-slow', title: '让日子慢慢经过', paragraphs: ['也许所谓留意生活，并不是要把每件事都变成值得记录的故事。只是偶尔停一下，让正在发生的日子好好经过。'] }
    ]
  },
  {
    id: 'little-tool', category: 'tech', categoryName: '技术', dateISO: '2026-09-06', date: '2026.09.06',
    title: '一个小工具的诞生', excerpt: '从一个总被忘记的小问题开始，慢慢做出能用的第一版。',
    sections: [
      { id: 'little-tool-problem', title: '一个反复遇见的小问题', paragraphs: ['这个小工具的起点很普通：我总把临时记下的灵感放得到处都是。手机备忘录里一条，桌面便签里几条，纸上还有半句没写完的话。'] },
      { id: 'little-tool-first-version', title: '先让第一版能用', paragraphs: ['于是先做了一个只解决一件事的页面。没有账号，也没有复杂的分类，打开就能记下，再按自己想要的方式找回来。第一个版本很朴素，但终于能把散落的句子放在同一个地方。'] },
      { id: 'little-tool-next', title: '留给下一步的余地', paragraphs: ['接下来还想试试更舒服的浏览方式。先让它安静地长一阵子，再决定下一步。'] }
    ]
  },
  {
    id: 'coast-walk', category: 'life', categoryName: '生活', dateISO: '2026-08-27', date: '2026.08.27',
    title: '草坡上，慢慢走一段路', excerpt: '不急着去往哪里，只听风经过树梢与草叶的声音。',
    sections: [
      { id: 'coast-walk-wind', title: '顺着风走', paragraphs: ['草坡的小路绕过几片低矮的野花，尽头没有什么特别的景点。我只是沿着风吹来的方向走，走到鞋边沾了草籽，才发现已经过了很久。'] },
      { id: 'coast-walk-tree', title: '大树下的一段停留', paragraphs: ['远处的大树在阳光里投下一片柔软的影子，云慢慢经过，草尖也跟着轻轻起伏。那段路没有给我答案，只让心里原本很拥挤的地方松了一些。'] },
      { id: 'coast-walk-return', title: '回去的时候', paragraphs: ['回去时天色还亮着。这样就很好。'] }
    ]
  },
  {
    id: 'unfinished-ideas', category: 'tech', categoryName: '技术', dateISO: '2026-08-12', date: '2026.08.12',
    title: '给未完成的想法留一个位置', excerpt: '把想法先记下来，再慢慢整理成可继续的小步骤。',
    sections: [
      { id: 'unfinished-first-line', title: '先写下一句话', paragraphs: ['做一个新页面时，我会先把最重要的一句话写下来，再列出它需要回答的问题。这个过程不需要漂亮的文档，能让自己重新接上思路就够了。'] },
      { id: 'unfinished-place', title: '给想法一个位置', paragraphs: ['以前总想等想法足够清楚，才开始写下来。结果很多时候，它们还没长成一句完整的话，就已经被下一件事盖住。现在会先留一个小小的位置，暂时不判断它能不能变成什么。'] },
      { id: 'unfinished-start', title: '保存一个清楚的起点', paragraphs: ['未完成并不等于没有价值。先保存一个清楚的起点，之后才有机会继续。'] }
    ]
  },
  {
    id: 'paper-and-screen', category: 'ramble', categoryName: '碎碎念', dateISO: '2026-07-29', date: '2026.07.29',
    title: '纸页边的一点空白', excerpt: '给一页文字留些呼吸，也给今天留一点从容。',
    sections: [
      { id: 'paper-margin', title: '纸页边缘', paragraphs: ['我喜欢纸页边缘没有写满的那一圈空白。它不提供答案，只让正在读的句子有地方停一停。'] },
      { id: 'paper-everyday', title: '给日常留一点余地', paragraphs: ['最近也试着把这种余地带进日常安排。少塞进一件事，路上就可以慢慢走；少开一个提醒，也许更容易听见自己正在想什么。'] },
      { id: 'paper-entry', title: '下一件事的入口', paragraphs: ['空白不是空着不做事，而是给下一件事留一个舒服的入口。'] }
    ]
  },
  {
    id: 'small-interface', category: 'tech', categoryName: '技术', dateISO: '2026-07-11', date: '2026.07.11',
    title: '让一个小页面更好读', excerpt: '从清楚的标题、适当的行距和真实的链接开始。',
    sections: [
      { id: 'small-interface-hierarchy', title: '先看清信息层级', paragraphs: ['整理页面时，我先检查读者能不能迅速看懂层级：标题说清主题，段落只承担一件事，链接则明确告诉人们会去哪里。'] },
      { id: 'small-interface-mobile', title: '窄屏上的阅读顺序', paragraphs: ['这些调整看起来很小，却能减少来回寻找的时间。窄屏上把信息顺序排好，也比单纯缩小桌面布局更重要。'] },
      { id: 'small-interface-polish', title: '继续慢慢打磨', paragraphs: ['之后还要在真实设备上慢慢看、慢慢改。这是一份持续练习的记录。'] }
    ]
  }
].sort((a, b) => b.dateISO.localeCompare(a.dateISO));

export const works = [
  {
    id: 'quiet-window', cover: 'window', dateISO: '2026-09-20', date: '2026.09',
    title: '一扇可以慢慢打开的窗', categoryName: '网页概念', excerpt: '把一句文字、天气和一小块留白放在一起，做成安静的日常入口。',
    paragraphs: [
      '这是一个关于收藏日常片刻的小页面概念。设想里有一句随手写下的话、一点天气线索，以及可以慢慢回看的旧记录。',
      '目前它是一份设计练习，用来探索轻量阅读和回看的节奏。页面没有外部服务或在线版本。'
    ]
  },
  {
    id: 'idea-garden', cover: 'notes', dateISO: '2026-08-30', date: '2026.08',
    title: '给未完成的想法留个位置', categoryName: '工具概念', excerpt: '一个轻量的灵感收纳练习，让还没想清楚的事情也能先停靠。',
    paragraphs: [
      '这个概念从一个很小的需求开始：让不完整的念头有地方暂存。先写下一句，再决定它要不要发展成更大的计划。',
      '界面设想以短条目和简单回看为主。当前这里只展示方向说明，没有仓库、下载或上线入口。'
    ]
  },
  {
    id: 'small-archive', cover: 'archive', dateISO: '2026-07-16', date: '2026.07',
    title: '把零散片刻收进小档案', categoryName: '记录练习', excerpt: '用日期和一行摘要整理照片、句子与值得记住的小发现。',
    paragraphs: [
      '小档案的想法，是把零散的片刻按时间放好。每一条只需要日期、一句说明和一个轻轻的主题提示。',
      '它是一份内容与界面构想，强调容易浏览和回想。现在展示的文字与窗口都是示例。'
    ]
  }
].sort((a, b) => b.dateISO.localeCompare(a.dateISO));

export const messages = [
  { id: 'hello-morning', author: '早起的云', dateISO: '2026-09-22', date: '2026.09.22', body: '路过这片安静的小天地，想留下一句早安。', reply: '早安，愿今天也有一段轻松的时间。' },
  { id: 'read-note', author: '一页书', dateISO: '2026-09-14', date: '2026.09.14', body: '喜欢关于给生活留白的那篇，读完心里也慢了下来。', reply: '谢谢你读到这里，也祝你今天从容。' },
  { id: 'blue-shore', author: '海边散步的人', dateISO: '2026-08-31', date: '2026.08.31', body: '海岸插画很舒服，像是可以在那里坐一会儿。', reply: '很高兴这幅小画陪你停留了一会儿。' }
].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
