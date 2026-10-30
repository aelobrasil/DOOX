// The initial reaction belongs to HOCCO. All additional likes come from the API.
export function communityWelcomeLike(post, now = Date.now()) {
  const start = Date.parse(post.published_at), end = Date.parse(post.expires_at);
  return post.id && Number.isFinite(start) && Number.isFinite(end) && end > start && now >= start ? 1 : 0;
}

export function communityActualLikes(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER - 1, Math.floor(count))) : 0;
}

export function communityReactionCount(post, now = Date.now()) {
  return communityActualLikes(post.likes_count) + communityWelcomeLike(post, now);
}

export function paintCommunityReactions(element, now = Date.now()) {
  const post = { id: element.dataset.communityReactions, published_at: element.dataset.reactionPublishedAt,
    expires_at: element.dataset.reactionExpiresAt, likes_count: element.dataset.actualLikes };
  const count = communityReactionCount(post, now), node = element.querySelector('.community-like-count');
  if (node && node.textContent !== String(count)) node.textContent = String(count);
  const prefix = element.matches('button') ? (element.getAttribute('aria-pressed') === 'true' ? 'Remover gostei. ' : 'Gostei. ') : '';
  element.setAttribute('aria-label', `${prefix}${count} ${count === 1 ? 'curtida' : 'curtidas'}`);
  return count;
}

export function mountCommunityReactions(root, { now = () => Date.now() } = {}) {
  const refresh = () => {
    if (document.hidden || !root.isConnected) return;
    const time = now();
    root.querySelectorAll('[data-community-reactions]').forEach(element => {
      if (!element.disabled) paintCommunityReactions(element, time);
    });
  };
  refresh();
  const timer = setInterval(refresh, 30_000);
  document.addEventListener('visibilitychange', refresh);
  return { refresh, dispose() { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); } };
}
