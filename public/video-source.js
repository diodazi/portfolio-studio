// Only identifiers are stored. Never accept iframe HTML or arbitrary embed URLs.
const BVID = /^BV[1-9A-HJ-NP-Za-km-z]{10}$/;
const validPage = page => Number.isSafeInteger(page) && page >= 1 && page <= 1000;

export function parseBilibiliInput(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (BVID.test(input)) return { bvid: input, page: 1 };
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.hostname) || url.port || url.username || url.password) return null;
    const match = /^\/video\/(BV[1-9A-HJ-NP-Za-km-z]{10})\/?$/.exec(url.pathname);
    const page = url.searchParams.has('p') ? Number(url.searchParams.get('p')) : 1;
    if (!match || !validPage(page)) return null;
    return { bvid: match[1], page };
  } catch { return null; }
}

export function bilibiliVideoSource(item) {
  if (!item || item.provider !== 'bilibili' || typeof item.bvid !== 'string' || !BVID.test(item.bvid)) return null;
  const page = item.page ?? 1;
  if (!validPage(page)) return null;
  const query = new URLSearchParams({ bvid: item.bvid, p: String(page), autoplay: '0', danmaku: '0', poster: '1' });
  return {
    embed: `https://player.bilibili.com/player.html?${query}`,
    original: `https://www.bilibili.com/video/${item.bvid}/${page > 1 ? `?p=${page}` : ''}`
  };
}
