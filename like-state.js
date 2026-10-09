// Used by Waline's existing Vue handler so counts and stored likes share one state.
export function createLikeHandler({ likedIds, getComment, update, notify }) {
  const pending = new Set();
  return async (comment) => {
    const objectId = comment.objectId;
    const id = String(objectId);
    if (pending.has(id)) return false;
    const wasLiked = likedIds.value.includes(objectId);
    const previousCount = Number(comment.like) || 0;
    const liked = !wasLiked;
    pending.add(id);
    likedIds.value = liked
      ? [...likedIds.value, objectId]
      : likedIds.value.filter(value => value !== objectId);
    comment.like = Math.max(0, previousCount + (liked ? 1 : -1));
    notify({ id, liked, pending: true, phase: 'start' });
    let phase;
    try {
      const saved = await update({ objectId, like: liked });
      const confirmedCount = saved?.data?.like;
      if (typeof confirmedCount === 'number' && Number.isFinite(confirmedCount)) {
        comment.like = Math.max(0, confirmedCount);
      }
      if (likedIds.value.length > 50) likedIds.value = likedIds.value.slice(-50);
      phase = 'success';
      return true;
    } catch {
      // Restore only this comment; concurrent likes on other cards stay intact.
      likedIds.value = wasLiked
        ? likedIds.value.includes(objectId) ? likedIds.value : [...likedIds.value, objectId]
        : likedIds.value.filter(value => value !== objectId);
      comment.like = previousCount;
      phase = 'error';
      return false;
    } finally {
      pending.delete(id);
      const current = getComment?.(objectId);
      if (current && current !== comment) current.like = comment.like;
      notify({ id, liked: phase === 'error' ? wasLiked : liked, pending: false, phase });
    }
  };
}
