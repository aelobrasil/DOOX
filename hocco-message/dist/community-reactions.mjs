// Presentation-only automated reactions. Never write these values to likes_count
// or to the table of actual votes; those remain independent of this projection.
export const COMMUNITY_REACTION_LIMIT = 890;
const MINUTE = 60_000;

function randomFor(id, label) {
  let hash = 2166136261;
  for (const char of `${id}:${label}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export function communityReactionProfile(id, lifetime = 4 * 60 * MINUTE) {
  const bucket = randomFor(id, 'bucket');
  const [low, high] = bucket < .2 ? [3, 9] : bucket < .55 ? [10, 49]
    : bucket < .8 ? [50, 149] : bucket < .94 ? [150, 399]
    : bucket < .99 ? [400, 699] : [700, COMMUNITY_REACTION_LIMIT];
  return {
    target: low + Math.floor(randomFor(id, 'target') * (high - low + 1)),
    duration: Math.max(20 * MINUTE, lifetime * (.25 + randomFor(id, 'duration') * 1.25)),
    curve: .8 + randomFor(id, 'curve') * 1.6,
  };
}

export function automatedCommunityLikes(post, now = Date.now()) {
  const start = Date.parse(post.published_at), end = Date.parse(post.expires_at);
  if (!post.id || !Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || now < start) return 0;
  // Freeze at expiration. A visit or reload never restarts the schedule.
  const age = Math.max(0, Math.min(now, end) - start);
  const { target, duration, curve } = communityReactionProfile(post.id, end - start);
  const cadence = (12 + Math.floor(randomFor(post.id, 'cadence') * 49)) * 1000;
  const elapsed = Math.floor(age / cadence) * cadence;
  const progress = Math.min(1, elapsed / duration);
  return 1 + Math.floor((target - 1) * Math.pow(progress, curve));
}

export function communityReactionCount(post, now = Date.now()) {
  const actual = Math.max(0, Math.floor(Number(post.likes_count) || 0));
  return Math.min(COMMUNITY_REACTION_LIMIT, actual + automatedCommunityLikes(post, now));
}

export function paintCommunityReactions(element, now = Date.now()) {
  const post = { id: element.dataset.communityReactions, published_at: element.dataset.reactionPublishedAt,
    expires_at: element.dataset.reactionExpiresAt, likes_count: element.dataset.actualLikes };
  const count = communityReactionCount(post, now), node = element.querySelector('.community-like-count');
  if (node && node.textContent !== String(count)) node.textContent = String(count);
  const prefix = element.matches('button') ? (element.getAttribute('aria-pressed') === 'true' ? 'Remover gostei. ' : 'Gostei. ') : '';
  element.setAttribute('aria-label', `${prefix}${count} curtidas`);
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
  const timer = setInterval(refresh, 10_000);
  document.addEventListener('visibilitychange', refresh);
  return { refresh, dispose() { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); } };
}
