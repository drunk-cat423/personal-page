import assert from 'node:assert/strict';
import test from 'node:test';
import { getCommentAvatarPath, normalizeAvatarNickname } from '../comment-avatars.js';

test('avatar assignment normalizes equivalent nicknames and remains stable', () => {
  assert.equal(normalizeAvatarNickname('  Ａlice   Smith '), 'alice smith');
  assert.equal(getCommentAvatarPath('  Ａlice   Smith '), getCommentAvatarPath('alice smith'));
  assert.equal(getCommentAvatarPath('alice smith'), getCommentAvatarPath('ALICE SMITH'));
});

test('avatar assignment selects from the three shared assets', () => {
  const allowed = new Set([
    'assets/avatars/paper-plane-v1.webp',
    'assets/avatars/windmill-v1.webp',
    'assets/avatars/flower-v1.webp',
  ]);
  for (const nickname of ['LYW', 'Alice', '小明', 'guest']) {
    assert.ok(allowed.has(getCommentAvatarPath(nickname)));
  }
});
