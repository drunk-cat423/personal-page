import assert from 'node:assert/strict';
import test from 'node:test';
import { getCommentAvatarPath, normalizeAvatarNickname, normalizeCommentTimeLabel } from '../comment-avatars.js';

test('avatar assignment normalizes equivalent nicknames and remains stable', () => {
  assert.equal(normalizeAvatarNickname('  Ａlice   Smith '), 'alice smith');
  assert.equal(getCommentAvatarPath('  Ａlice   Smith '), getCommentAvatarPath('alice smith'));
  assert.equal(getCommentAvatarPath('alice smith'), getCommentAvatarPath('ALICE SMITH'));
});

test('avatar assignment selects from the three shared assets', () => {
  const allowed = new Set([
    'assets/avatars/paper-plane-v2.svg',
    'assets/avatars/windmill-v2.svg',
    'assets/avatars/flower-v2.svg',
  ]);
  for (const nickname of ['LYW', 'Alice', '小明', 'guest']) {
    assert.ok(allowed.has(getCommentAvatarPath(nickname)));
  }
});

test('Waline second labels become just now while minute and older labels remain unchanged', () => {
  for (const seconds of [0, 7, 59, 60]) {
    assert.equal(normalizeCommentTimeLabel(`${seconds} 秒前`), '刚刚');
  }
  for (const label of ['刚刚', '1 分钟前', '3 小时前', '2026-10-10']) {
    assert.equal(normalizeCommentTimeLabel(label), label);
  }
});
