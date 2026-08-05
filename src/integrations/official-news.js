const OFFICIAL_NEWS_URL = 'https://www.wherewindsmeetgame.com/hmt/news/index.html';

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseOfficialNews(html, limit = 5) {
  const items = [];
  const seen = new Set();
  const pageItemPattern = /<a\s+href="([^"]+)"\s+class="news"[^>]*title="([^"]+)"[\s\S]*?<p class="news_text">([\s\S]*?)<\/p>[\s\S]*?<p class="date_day">(\d{2})\.(\d{2})<\/p>\s*<p class="date_year">(\d{4})<\/p>/g;
  const homeItemPattern = /<a[^>]+class="newsItem"[^>]+href="([^"]+)"[\s\S]*?<div class="time">([^<]+)<\/div>[\s\S]*?<div class="newsTitle"><i class="newsLabel">[【〖]([^】〗]+)[】〗]<\/i>([\s\S]*?)<\/div>[\s\S]*?<div class="newsDesc">([\s\S]*?)<\/div>/g;
  let match;

  while ((match = pageItemPattern.exec(html)) && items.length < limit) {
    const [, url, title, description, month, day, year] = match;
    if (!seen.has(url)) {
      seen.add(url);
      items.push({
        date: `${year}-${month}-${day}`,
        type: url.includes('/hmt/') ? '新聞' : 'NEWS',
        title: `${stripHtml(title)} - ${stripHtml(description)}`.slice(0, 220),
        url,
      });
    }
  }

  while ((match = homeItemPattern.exec(html)) && items.length < limit) {
    const [, url, date, type, title, description] = match;
    if (!seen.has(url)) {
      seen.add(url);
      items.push({
        date,
        type,
        title: `${stripHtml(title)} - ${stripHtml(description)}`.slice(0, 220),
        url,
      });
    }
  }

  if (items.length) {
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  const text = stripHtml(html);
  const pattern = /(\d{4}-\d{2}-\d{2})\s*[【〖]([^】〗]+)[】〗]\s*([\s\S]*?)(?=\d{4}-\d{2}-\d{2}\s*[【〖]|Where Winds Meet is|$)/g;

  while ((match = pattern.exec(text)) && items.length < limit) {
    const [, date, type, rawTitle] = match;
    const title = rawTitle
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

    if (title) {
      items.push({
        date,
        type,
        title,
        url: OFFICIAL_NEWS_URL,
      });
    }
  }

  return items;
}

export async function fetchOfficialNews(limit = 5) {
  const url = process.env.WWM_OFFICIAL_NEWS_URL || OFFICIAL_NEWS_URL;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'DiscordGuildSupportApp/0.1 (+https://wherewindsmeetgame.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`官方新闻请求失败：${response.status}`);
  }

  return parseOfficialNews(await response.text(), limit);
}
