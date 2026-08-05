const FANDOM_API_URL = 'https://where-winds-meet.fandom.com/api.php';
const FANDOM_HOME_URL = 'https://where-winds-meet.fandom.com/wiki/Where_Winds_Meet_Wiki';
const GAMEKEE_SEARCH_API_URL = 'https://www.gamekee.com/v1/content/searchArticle';
const GAMEKEE_WIKI_ALIAS = 'yysls';
const GAMEKEE_WIKI_HOME_URL = 'https://www.gamekee.com/yysls/';
const GAMERSKY_SEARCH_URL = 'https://so.gamersky.com/all/handbook';
const BILIGAME_WIKI_HOME_URL = 'https://wiki.biligame.com/wiki/%E7%87%95%E4%BA%91%E5%8D%81%E5%85%AD%E5%A3%B0WIKI';
const USER_AGENT = 'DiscordGuildSupportApp/0.1';

export const wikiFallbackLinks = [
  { title: 'GameKee 燕云十六声 Wiki', url: GAMEKEE_WIKI_HOME_URL },
  { title: 'Bilibili 燕云十六声WIKI', url: BILIGAME_WIKI_HOME_URL },
];

const traditionalToSimplified = new Map(Object.entries({
  雲: '云',
  聲: '声',
  術: '术',
  學: '学',
  輕: '轻',
  門: '门',
  會: '会',
  裝: '装',
  備: '备',
  劍: '剑',
  槍: '枪',
  俠: '侠',
  龍: '龙',
  體: '体',
  風: '风',
  戰: '战',
  絕: '绝',
  雙: '双',
  歸: '归',
  無: '无',
  開: '开',
  陣: '阵',
  練: '练',
  點: '点',
  寶: '宝',
  醫: '医',
  藥: '药',
  資: '资',
  訊: '讯',
  圖: '图',
  鑑: '鉴',
  馬: '马',
  鳥: '鸟',
  魚: '鱼',
  貓: '猫',
  黃: '黄',
  國: '国',
  銀: '银',
  錢: '钱',
  敵: '敌',
  組: '组',
  隊: '队',
  樓: '楼',
  陽: '阳',
  陰: '阴',
  憶: '忆',
  內: '内',
  斷: '断',
  機: '机',
}));

export function hasChineseText(text = '') {
  return /[\u3400-\u9fff\uf900-\ufaff]/u.test(text);
}

export function normalizeChineseQuery(query = '') {
  return String(query)
    .trim()
    .split('')
    .map((character) => traditionalToSimplified.get(character) || character)
    .join('');
}

function cleanDescription(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '暂无摘要';
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanHtmlText(value) {
  return cleanDescription(decodeHtmlEntities(value));
}

function cleanTitleText(value) {
  return cleanHtmlText(value)
    .replace(/《\s+/g, '《')
    .replace(/\s+》/g, '》')
    .replace(/([\u3400-\u9fff》])\s+(?=[\u3400-\u9fff《])/gu, '$1');
}

function gameKeeResultUrl(item) {
  const alias = item.game?.alias || item.game_alias || GAMEKEE_WIKI_ALIAS;
  return `https://www.gamekee.com/${alias}/${item.id}.html`;
}

function buildGamerSkyQuery(query) {
  const normalizedQuery = normalizeChineseQuery(query);
  return /燕云十六声|where winds meet/i.test(normalizedQuery)
    ? normalizedQuery
    : `燕云十六声 ${normalizedQuery}`;
}

function buildGamerSkySearchUrl(query) {
  const params = new URLSearchParams({ s: buildGamerSkyQuery(query) });
  return `${GAMERSKY_SEARCH_URL}?${params.toString()}`;
}

function rankGameKeeResult(item, query) {
  const normalizedTitle = normalizeChineseQuery(item.title || '').toLowerCase();
  const normalizedSummary = normalizeChineseQuery(item.summary || '').toLowerCase();
  const normalizedQuery = normalizeChineseQuery(query || '').toLowerCase();

  if (normalizedTitle === normalizedQuery) {
    return 0;
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    return 1;
  }

  if (normalizedSummary.includes(normalizedQuery)) {
    return 2;
  }

  return 3;
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = result.url || `${result.source}:${result.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function parseGamerSkySearchResults(html, limit = 5) {
  const results = [];
  const itemPattern = /<li>([\s\S]*?)<\/li>/g;
  let match;

  while ((match = itemPattern.exec(html)) && results.length < limit) {
    const itemHtml = match[1];
    const titleMatch = itemHtml.match(/<div class="t2">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/div>/);
    const descriptionMatch = itemHtml.match(/<div class="con">([\s\S]*?)<\/div>/);
    const dateMatch = itemHtml.match(/<div class="time">([^<]*)<\/div>/);

    if (!titleMatch || !descriptionMatch) {
      continue;
    }

    const [, url, titleHtml] = titleMatch;
    const [, descriptionHtml] = descriptionMatch;
    const date = dateMatch?.[1] || '';
    const title = cleanTitleText(titleHtml);
    const description = cleanHtmlText(descriptionHtml);

    if (!title.includes('燕云十六声') && !description.includes('燕云十六声')) {
      continue;
    }

    results.push({
      title,
      description: date?.trim() ? `${date.trim()} | ${description}` : description,
      url,
      source: 'gamersky',
      sourceLabel: '游民星空攻略',
    });
  }

  return results;
}

export async function searchFandomWiki(query, limit = 5, fetchImpl = fetch) {
  const params = new URLSearchParams({
    action: 'opensearch',
    search: query,
    limit: String(limit),
    namespace: '0',
    format: 'json',
    origin: '*',
  });
  const response = await fetchImpl(`${FANDOM_API_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Fandom Wiki 搜索失败：${response.status}`);
  }

  const [, titles = [], descriptions = [], urls = []] = await response.json();
  return titles.map((title, index) => ({
    title,
    description: descriptions[index] || '暂无摘要',
    url: urls[index],
    source: 'fandom',
    sourceLabel: 'Fandom Wiki',
  }));
}

export async function searchGameKeeWiki(query, limit = 5, fetchImpl = fetch) {
  const normalizedQuery = normalizeChineseQuery(query);
  const params = new URLSearchParams({
    keyword: normalizedQuery,
    limit: String(limit),
    page_no: '1',
  });

  const response = await fetchImpl(`${GAMEKEE_SEARCH_API_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': USER_AGENT,
      Lang: 'zh-cn',
      'game-alias': GAMEKEE_WIKI_ALIAS,
      'device-num': '1',
    },
  });

  if (!response.ok) {
    throw new Error(`GameKee 中文 Wiki 搜索失败：${response.status}`);
  }

  const payload = await response.json();
  if (payload.code !== 0) {
    throw new Error(`GameKee 中文 Wiki 搜索失败：${payload.msg || payload.code}`);
  }

  return (Array.isArray(payload.data) ? payload.data : [])
    .filter((item) => item?.id && (item.game?.alias === GAMEKEE_WIKI_ALIAS || item.game_id === 50304))
    .sort((left, right) => (
      rankGameKeeResult(left, normalizedQuery) - rankGameKeeResult(right, normalizedQuery)
      || (right.view_count || 0) - (left.view_count || 0)
    ))
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      description: cleanDescription(item.summary),
      url: gameKeeResultUrl(item),
      source: 'gamekee',
      sourceLabel: 'GameKee Wiki',
    }));
}

export async function searchGamerSkyGuides(query, limit = 5, fetchImpl = fetch) {
  const response = await fetchImpl(buildGamerSkySearchUrl(query), {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`游民星空攻略搜索失败：${response.status}`);
  }

  return parseGamerSkySearchResults(await response.text(), limit);
}

export async function searchChineseWikiSources(query, limit = 5, fetchImpl = fetch) {
  const normalizedQuery = normalizeChineseQuery(query);
  const searches = await Promise.allSettled([
    searchGamerSkyGuides(normalizedQuery, Math.ceil(limit / 2) + 1, fetchImpl),
    searchGameKeeWiki(normalizedQuery, Math.ceil(limit / 2) + 1, fetchImpl),
  ]);
  const warnings = searches
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || String(result.reason));
  const results = dedupeResults(searches.flatMap((result) => (
    result.status === 'fulfilled' ? result.value : []
  ))).slice(0, limit);

  return {
    source: 'chinese',
    sourceLabel: '中文资料（游民星空 + GameKee）',
    sourceUrl: buildGamerSkySearchUrl(normalizedQuery),
    query,
    normalizedQuery,
    results,
    warning: warnings.join('；'),
    fallbackLinks: [
      { title: '游民星空攻略搜索', url: buildGamerSkySearchUrl(normalizedQuery) },
      ...wikiFallbackLinks,
    ],
  };
}

export async function searchWiki(query, limit = 5, fetchImpl = fetch) {
  const normalizedQuery = normalizeChineseQuery(query);

  if (hasChineseText(query)) {
    return searchChineseWikiSources(normalizedQuery, limit, fetchImpl);
  }

  return {
    source: 'fandom',
    sourceLabel: 'Where Winds Meet Fandom Wiki',
    sourceUrl: FANDOM_HOME_URL,
    query,
    normalizedQuery: query.trim(),
    results: await searchFandomWiki(query, limit, fetchImpl),
    fallbackLinks: [{ title: 'Where Winds Meet Fandom Wiki', url: FANDOM_HOME_URL }],
  };
}
