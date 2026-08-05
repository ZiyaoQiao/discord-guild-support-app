import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { parseOfficialNews } from '../src/integrations/official-news.js';
import {
  detectSourceLanguage,
  translateText,
} from '../src/integrations/translate.js';
import {
  buildMemeStickerSearchUrl,
  consumeMemeCandidate,
  parseDoutuPkResults,
  pickRandomMemeCandidates,
  rememberMemeCandidates,
  searchMemeStickers,
} from '../src/integrations/meme-stickers.js';
import {
  hasChineseText,
  normalizeChineseQuery,
  parseGamerSkySearchResults,
  searchGameKeeWiki,
  searchGamerSkyGuides,
  searchWiki,
} from '../src/integrations/wiki.js';

const originalTranslateApiUrl = process.env.TRANSLATE_API_URL;
const originalTranslateApiKey = process.env.TRANSLATE_API_KEY;

afterEach(() => {
  if (originalTranslateApiUrl === undefined) {
    delete process.env.TRANSLATE_API_URL;
  } else {
    process.env.TRANSLATE_API_URL = originalTranslateApiUrl;
  }

  if (originalTranslateApiKey === undefined) {
    delete process.env.TRANSLATE_API_KEY;
  } else {
    process.env.TRANSLATE_API_KEY = originalTranslateApiKey;
  }
});

describe('official news integration', () => {
  it('parses official news entries from homepage text', () => {
    const html = `
      <div>2026-05-22 〖新聞〗5月22日優化與修復一覽 1、1.7版本「宮闕日初升」預下載已開啟。</div>
      <div>2026-05-18 〖新聞〗《燕雲十六聲》違規玩家封鎖公告</div>
      <p>Where Winds Meet is an epic open-world action-adventure RPG.</p>
    `;

    const items = parseOfficialNews(html, 2);

    assert.equal(items.length, 2);
    assert.equal(items[0].date, '2026-05-22');
    assert.equal(items[0].type, '新聞');
    assert.match(items[0].title, /優化與修復/);
    assert.equal(items[1].date, '2026-05-18');
  });

  it('parses official news list markup', () => {
    const html = `
      <a href="https://www.wherewindsmeetgame.com/hmt/news/official/522update.html" class="news" title="5月22日優化與修復一覽" target="_blank">
        <p class="news_tit">5月22日優化與修復一覽</p>
        <p class="news_text">1.7版本「宮闕日初升」預下載已開啟。</p>
        <p class="date_day">05.22</p>
        <p class="date_year">2026</p>
      </a>
    `;

    const [item] = parseOfficialNews(html, 1);

    assert.equal(item.date, '2026-05-22');
    assert.equal(item.type, '新聞');
    assert.equal(item.url, 'https://www.wherewindsmeetgame.com/hmt/news/official/522update.html');
    assert.match(item.title, /預下載/);
  });
});

describe('translation integration', () => {
  it('detects Chinese and English source text', () => {
    assert.equal(detectSourceLanguage('燕云十六声帮会'), 'zh');
    assert.equal(detectSourceLanguage('Where Winds Meet guild'), 'en');
  });

  it('returns the original text when the target language already matches', async () => {
    delete process.env.TRANSLATE_API_URL;

    const result = await translateText({
      text: '  燕云十六声  ',
      target: 'zh',
    });

    assert.deepEqual(result, {
      source: 'zh',
      target: 'zh',
      translatedText: '燕云十六声',
      provider: 'same-language',
    });
  });

  it('posts to a LibreTranslate-compatible endpoint', async () => {
    process.env.TRANSLATE_API_URL = 'https://translate.example.test/translate';
    process.env.TRANSLATE_API_KEY = 'test-key';

    let capturedRequest;
    const result = await translateText({
      text: 'Need help with a build',
      target: 'zh-cn',
      fetchImpl: async (url, options) => {
        capturedRequest = {
          url,
          method: options.method,
          headers: options.headers,
          body: JSON.parse(options.body),
        };

        return {
          ok: true,
          json: async () => ({ translatedText: '需要配装帮助' }),
        };
      },
    });

    assert.deepEqual(capturedRequest, {
      url: 'https://translate.example.test/translate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        q: 'Need help with a build',
        source: 'en',
        target: 'zh',
        format: 'text',
        api_key: 'test-key',
      },
    });
    assert.deepEqual(result, {
      source: 'en',
      target: 'zh',
      translatedText: '需要配装帮助',
      provider: 'libretranslate-compatible',
    });
  });

  it('requires a translation provider for cross-language requests', async () => {
    delete process.env.TRANSLATE_API_URL;

    await assert.rejects(
      translateText({
        text: 'Need help',
        target: 'zh',
      }),
      /翻译服务尚未配置/,
    );
  });
});

describe('wiki integration', () => {
  it('detects and normalizes Chinese wiki queries', () => {
    assert.equal(hasChineseText('凌云踏'), true);
    assert.equal(hasChineseText('merchant'), false);
    assert.equal(normalizeChineseQuery('燕雲十六聲 奇術 武學'), '燕云十六声 奇术 武学');
  });

  it('searches GameKee for Chinese wiki entries', async () => {
    let capturedRequest;
    const results = await searchGameKeeWiki('凌云踏', 2, async (url, options) => {
      capturedRequest = { url, headers: options.headers };

      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: [
            {
              id: 644613,
              game_id: 50304,
              title: '探索属性和技能',
              summary: '凌云踏可以快速位移。',
              view_count: 19491,
              game: { alias: 'yysls' },
            },
            {
              id: 625638,
              game_id: 50304,
              title: '凌云踏',
              summary: '',
              view_count: 3607,
              game: { alias: 'yysls' },
            },
          ],
        }),
      };
    });

    assert.match(capturedRequest.url, /\/v1\/content\/searchArticle/);
    assert.match(capturedRequest.url, /keyword=%E5%87%8C%E4%BA%91%E8%B8%8F/);
    assert.equal(capturedRequest.headers['game-alias'], 'yysls');
    assert.equal(results[0].title, '凌云踏');
    assert.equal(results[0].url, 'https://www.gamekee.com/yysls/625638.html');
    assert.equal(results[1].title, '探索属性和技能');
  });

  it('parses and searches GamerSky Chinese guide results', async () => {
    const html = `
      <ul class="txtlist contentpaging">
        <li>
          <div class="tit">
            <div class="t1"><span>单机</span>|</div>
            <div class="t2"><a href="https://www.gamersky.com/handbook/202412/1865356.shtml" target="_blank">《<font style='color:#e11d03'>燕云十六声</font>》<font style='color:#e11d03'>凌云踏</font>奇术获取方法</a></div>
          </div>
          <div class="con">《燕云十六声》中凌云踏这门奇术应该怎么获得呢？基本介绍 属性：轻...</div>
          <div class="bot"><div class="link"><a href="https://www.gamersky.com/handbook/202412/1865356.shtml">link</a></div><div class="time">2024-12-30 09:43</div></div>
        </li>
      </ul>
    `;

    assert.deepEqual(parseGamerSkySearchResults(html, 1), [{
      title: '《燕云十六声》凌云踏奇术获取方法',
      description: '2024-12-30 09:43 | 《燕云十六声》中凌云踏这门奇术应该怎么获得呢？基本介绍 属性：轻...',
      url: 'https://www.gamersky.com/handbook/202412/1865356.shtml',
      source: 'gamersky',
      sourceLabel: '游民星空攻略',
    }]);

    let capturedUrl;
    const results = await searchGamerSkyGuides('凌云踏', 1, async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        text: async () => html,
      };
    });

    assert.match(capturedUrl, /so\.gamersky\.com\/all\/handbook/);
    assert.match(capturedUrl, /%E7%87%95%E4%BA%91%E5%8D%81%E5%85%AD%E5%A3%B0\+%E5%87%8C%E4%BA%91%E8%B8%8F/);
    assert.equal(results[0].source, 'gamersky');
  });

  it('routes Chinese queries to Chinese sources and English queries to Fandom', async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);

      if (url.includes('gamersky.com')) {
        return {
          ok: true,
          text: async () => `
            <ul class="txtlist contentpaging">
              <li>
                <div class="tit"><div class="t1"><span>单机</span>|</div><div class="t2"><a href="https://www.gamersky.com/handbook/202412/1865356.shtml">《燕云十六声》凌云踏奇术获取方法</a></div></div>
                <div class="con">《燕云十六声》中凌云踏这门奇术应该怎么获得呢？</div>
                <div class="bot"><div class="link"><a href="https://www.gamersky.com/handbook/202412/1865356.shtml">link</a></div><div class="time">2024-12-30 09:43</div></div>
              </li>
            </ul>
          `,
        };
      }

      if (url.includes('gamekee.com')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: [{
              id: 625638,
              game_id: 50304,
              title: '凌云踏',
              summary: '',
              game: { alias: 'yysls' },
            }],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ['merchant', ['Echo Jade'], ['Currency guide'], ['https://example.test/echo-jade']],
      };
    };

    const chineseResult = await searchWiki('凌雲踏', 5, fetchImpl);
    const englishResult = await searchWiki('merchant', 5, fetchImpl);

    assert.equal(chineseResult.source, 'chinese');
    assert.equal(chineseResult.normalizedQuery, '凌云踏');
    assert.equal(chineseResult.results[0].source, 'gamersky');
    assert.equal(chineseResult.results[1].title, '凌云踏');
    assert.equal(englishResult.source, 'fandom');
    assert.equal(englishResult.results[0].title, 'Echo Jade');
    assert.equal(urls.some((url) => url.includes('gamersky.com')), true);
    assert.equal(urls.some((url) => url.includes('gamekee.com')), true);
    assert.equal(urls.some((url) => url.includes('fandom.com')), true);
  });
});

describe('meme sticker integration', () => {
  function memeItem(index, title = `猫猫无语 ${index}`) {
    return `
      <a class="col-xs-6 col-md-2" href="https://www.doutupk.com/photo/${index}" style="padding:5px;">
        <img referrerpolicy="no-referrer" src="//static.doutupk.com/img/loader.gif?33" data-backup="http://img.doutupk.com/production/uploads/image/2019/06/26/${index}.jpg" class="img-responsive lazy image_dtb" data-original="http://img.doutupk.com/production/uploads/image/2019/06/26/${index}.jpg" style="width: 100%;">
        <p style="display: none">${title}</p>
      </a>
    `;
  }

  const sampleHtml = `
    <a class="col-xs-6 col-md-2" href="https://www.doutupk.com/photo/1162860" style="padding:5px;">
      <img referrerpolicy="no-referrer" src="//static.doutupk.com/img/loader.gif?33" data-backup="http://img.doutupk.com/production/uploads/image/2019/06/26/20190626506057_kxbdmq.jpg" class="img-responsive lazy image_dtb" data-original="http://img.doutupk.com/production/uploads/image/2019/06/26/20190626506057_kxbdmq.jpg" style="width: 100%;">
      <p style="display: none">猫猫无语</p>
    </a>
  `;

  it('builds the DoutuPK search URL', () => {
    assert.equal(
      buildMemeStickerSearchUrl('猫猫 无语'),
      'https://www.doutupk.com/search?keyword=%E7%8C%AB%E7%8C%AB+%E6%97%A0%E8%AF%AD',
    );
  });

  it('parses DoutuPK image candidates', () => {
    assert.deepEqual(parseDoutuPkResults(sampleHtml, 2), [{
      title: '猫猫无语',
      description: '斗图啦表情包候选',
      pageUrl: 'https://www.doutupk.com/photo/1162860',
      imageUrl: 'https://img.doutupk.com/production/uploads/image/2019/06/26/20190626506057_kxbdmq.jpg',
      source: 'doutupk',
      sourceLabel: '斗图啦',
    }]);
  });

  it('searches meme stickers through DoutuPK', async () => {
    let capturedUrl;
    const result = await searchMemeStickers('猫猫无语', 2, async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        text: async () => sampleHtml,
      };
    });

    assert.match(capturedUrl, /doutupk\.com\/search/);
    assert.equal(result.source, 'doutupk');
    assert.equal(result.results[0].title, '猫猫无语');
  });

  it('randomizes candidates from a larger exact-keyword result pool', async () => {
    const result = await searchMemeStickers(
      '猫猫无语',
      3,
      async () => ({
        ok: true,
        text: async () => [1, 2, 3, 4, 5, 6].map((index) => memeItem(index)).join(''),
      }),
      { random: () => 0 },
    );

    assert.deepEqual(
      result.results.map((candidate) => candidate.title),
      ['猫猫无语 2', '猫猫无语 3', '猫猫无语 4'],
    );
  });

  it('can shuffle parsed meme candidates directly', () => {
    const candidates = parseDoutuPkResults([1, 2, 3, 4, 5].map((index) => memeItem(index)).join(''), 5);

    assert.deepEqual(
      pickRandomMemeCandidates(candidates, 2, () => 0).map((candidate) => candidate.title),
      ['猫猫无语 2', '猫猫无语 3'],
    );
  });

  it('stores short-lived meme candidates for component selection', () => {
    const [selection] = rememberMemeCandidates(
      parseDoutuPkResults(sampleHtml, 1),
      'user-1',
      '猫猫无语',
      1000,
    );

    assert.match(selection.id, /^[0-9a-f-]+$/);
    assert.equal(selection.index, 0);
    assert.equal(selection.candidate.title, '猫猫无语');

    const mismatch = consumeMemeCandidate(selection.id, 'user-2', 1001);
    assert.equal(mismatch.ownerMismatch, true);

    const entry = consumeMemeCandidate(selection.id, 'user-1', 1001);
    assert.equal(entry.ownerId, 'user-1');
    assert.equal(entry.query, '猫猫无语');
    assert.equal(entry.candidate.title, '猫猫无语');
    assert.equal(consumeMemeCandidate(selection.id, 'user-1', 1001), null);
  });
});
