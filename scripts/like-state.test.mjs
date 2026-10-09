import test from 'node:test';
import assert from 'node:assert/strict';
import { createLikeHandler } from '../like-state.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('like appears before the server responds, duplicate clicks send once, confirmation uses server count', async () => {
  const request = deferred();
  const likedIds = { value: [] };
  const comment = { objectId: 9, like: 0, comment: 'Keep this text' };
  const events = [];
  let requests = 0;
  const toggle = createLikeHandler({ likedIds, update: () => { requests++; return request.promise; }, notify: event => events.push(event) });
  const result = toggle(comment);
  assert.equal(comment.like, 1);
  assert.deepEqual(likedIds.value, [9]);
  assert.equal(events[0].pending, true);
  assert.equal(await toggle(comment), false);
  assert.equal(requests, 1);
  request.resolve({ errno: 0, data: { like: 3 } });
  assert.equal(await result, true);
  assert.equal(comment.like, 3);
  assert.equal(comment.comment, 'Keep this text');
  assert.equal(events.at(-1).phase, 'success');
});

test('failed like rolls back without erasing a concurrent successful like on another comment', async () => {
  const request = deferred();
  const likedIds = { value: [] };
  const first = { objectId: 9, like: 0 };
  const second = { objectId: 12, like: 1 };
  const events = [];
  const toggle = createLikeHandler({ likedIds, update: ({ objectId }) => objectId === 9 ? request.promise : Promise.resolve({ errno: 0, data: { like: 2 } }), notify: event => events.push(event) });
  const result = toggle(first);
  await toggle(second);
  request.reject(new Error('Unavailable'));
  assert.equal(await result, false);
  assert.equal(first.like, 0);
  assert.equal(second.like, 2);
  assert.deepEqual(likedIds.value, [12]);
  assert.deepEqual(events.at(-1), { id: '9', liked: false, pending: false, phase: 'error' });
});

test('failed unlike restores the existing like and allows a new attempt', async () => {
  const request = deferred();
  const likedIds = { value: [9] };
  const comment = { objectId: 9, like: 1 };
  let fail = true;
  const toggle = createLikeHandler({ likedIds, update: () => fail ? request.promise : Promise.resolve({ errno: 0, data: { like: 0 } }), notify: () => {} });
  const result = toggle(comment);
  assert.equal(comment.like, 0);
  assert.deepEqual(likedIds.value, []);
  request.reject(new Error('Unavailable'));
  await result;
  assert.equal(comment.like, 1);
  assert.deepEqual(likedIds.value, [9]);
  fail = false;
  assert.equal(await toggle(comment), true);
  assert.equal(comment.like, 0);
  assert.deepEqual(likedIds.value, []);
});

test('a card replaced by sorting receives the confirmed server count', async () => {
  const request = deferred();
  const likedIds = { value: [] };
  const original = { objectId: 9, like: 0 };
  let current = original;
  const toggle = createLikeHandler({ likedIds, getComment: () => current, update: () => request.promise, notify: () => {} });
  const result = toggle(original);
  current = { objectId: 9, like: 0 };
  request.resolve({ errno: 0, data: { like: 7 } });
  await result;
  assert.equal(current.like, 7);
  assert.equal(original.like, 7);
  assert.deepEqual(likedIds.value, [9]);
});
