import { randomUUID } from 'node:crypto';

const DOUTUPK_SEARCH_URL = 'https://www.doutupk.com/search';
const USER_AGENT = 'DiscordGuildSupportApp/0.1';
const MEME_SELECTION_TTL_MS = 10 * 60 * 1000;
const MEME_RANDOM_POOL_MULTIPLIER = 4;
const MEME_RANDOM_POOL_LIMIT = 24;
const memeSelections = new Map();

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(value) {
  const url = String(value || '').trim();

  if (!url) {
    return '';
  }

  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  if (url.startsWith('http://img.doutupk.com/')) {
    return url.replace('http://', 'https://');
  }

  if (url.startsWith('/')) {
    return `https://www.doutupk.com${url}`;
  }

  return url;
}

export function buildMemeStickerSearchUrl(query) {
  const params = new URLSearchParams({ keyword: String(query || '').trim() });
  return `${DOUTUPK_SEARCH_URL}?${params.toString()}`;
}

export function parseDoutuPkResults(html, limit = 4) {
  const results = [];
  const itemPattern = /<a\s+class="col-xs-6 col-md-2"\s+href="([^"]+)"[\s\S]*?<\/a>/g;
  let match;

  while ((match = itemPattern.exec(html)) && results.length < limit) {
    const itemHtml = match[0];
    const pageUrl = normalizeUrl(match[1]);
    const imageUrl = normalizeUrl(
      itemHtml.match(/data-original="([^"]+)"/)?.[1]
      || itemHtml.match(/data-backup="([^"]+)"/)?.[1]
      || itemHtml.match(/<img[^>]+src="([^"]+)"/)?.[1],
    );
    const title = cleanText(
      itemHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]
      || itemHtml.match(/alt="([^"]+)"/)?.[1]
      || itemHtml.match(/title="([^"]+)"/)?.[1],
    );

    if (!pageUrl || !imageUrl || !title || imageUrl.includes('/loader.gif')) {
      continue;
    }

    results.push({
      title,
      description: '斗图啦表情包候选',
      pageUrl,
      imageUrl,
      source: 'doutupk',
      sourceLabel: '斗图啦',
    });
  }

  return results;
}

export function pickRandomMemeCandidates(results, limit = 4, random = Math.random) {
  const candidates = [...results];

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  return candidates.slice(0, limit);
}

export async function searchMemeStickers(query, limit = 4, fetchImpl = fetch, options = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    throw new Error('请输入要搜索的表情包描述。');
  }

  const randomPoolLimit = Math.max(
    limit,
    Math.min(MEME_RANDOM_POOL_LIMIT, limit * MEME_RANDOM_POOL_MULTIPLIER),
  );

  const response = await fetchImpl(buildMemeStickerSearchUrl(normalizedQuery), {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`表情包搜索失败：${response.status}`);
  }

  return {
    source: 'doutupk',
    sourceLabel: '斗图啦',
    sourceUrl: buildMemeStickerSearchUrl(normalizedQuery),
    query: normalizedQuery,
    results: pickRandomMemeCandidates(
      parseDoutuPkResults(await response.text(), randomPoolLimit),
      limit,
      options.random,
    ),
  };
}

function cleanupMemeSelections(now = Date.now()) {
  for (const [id, entry] of memeSelections.entries()) {
    if (entry.expiresAt <= now) {
      memeSelections.delete(id);
    }
  }
}

export function rememberMemeCandidates(results, ownerId, query, now = Date.now()) {
  cleanupMemeSelections(now);

  return results.slice(0, 4).map((candidate, index) => {
    const id = randomUUID();
    memeSelections.set(id, {
      candidate,
      index,
      ownerId,
      query,
      expiresAt: now + MEME_SELECTION_TTL_MS,
    });

    return { id, index, candidate };
  });
}

export function consumeMemeCandidate(id, ownerId, now = Date.now()) {
  cleanupMemeSelections(now);

  const entry = memeSelections.get(id);
  if (!entry) {
    return null;
  }

  if (ownerId && entry.ownerId !== ownerId) {
    return { ...entry, ownerMismatch: true };
  }

  memeSelections.delete(id);
  return entry;
}
