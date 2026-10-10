const AVATARS = [
  'assets/avatars/paper-plane-v1.webp',
  'assets/avatars/windmill-v1.webp',
  'assets/avatars/flower-v1.webp',
];

export function normalizeAvatarNickname(nickname) {
  return String(nickname ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function getCommentAvatarPath(nickname) {
  const normalized = normalizeAvatarNickname(nickname);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return AVATARS[(hash >>> 0) % AVATARS.length];
}

export function createCommentAvatar(nickname, extraClass = '') {
  const avatar = document.createElement('img');
  avatar.className = ['comment-avatar', extraClass].filter(Boolean).join(' ');
  avatar.src = getCommentAvatarPath(nickname);
  avatar.alt = '';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.loading = 'lazy';
  avatar.decoding = 'async';
  return avatar;
}

export function decorateWalineAvatarHeads(root) {
  for (const head of root.querySelectorAll('.wl-card > .wl-head')) {
    const nickname = head.querySelector(':scope > .wl-nick')?.textContent ?? '';
    if (!normalizeAvatarNickname(nickname)) continue;

    const avatarPath = getCommentAvatarPath(nickname);
    const avatarValue = `url("${avatarPath}")`;
    if (head.style.getPropertyValue('--station-avatar') !== avatarValue) {
      head.style.setProperty('--station-avatar', avatarValue);
    }
    head.classList.add('station-avatar-head');
  }
}
