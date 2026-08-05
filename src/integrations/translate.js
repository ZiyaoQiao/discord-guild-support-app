export const translateTargets = [
  { name: '翻译成中文', value: 'zh' },
  { name: '翻译成英文', value: 'en' },
];

export function detectSourceLanguage(text) {
  return /[\u3400-\u9fff]/.test(text) ? 'zh' : 'en';
}

export function normalizeTargetLanguage(target) {
  if (['zh', 'zh-cn', 'chinese', '中文'].includes(String(target).toLowerCase())) {
    return 'zh';
  }

  if (['en', 'english', '英文'].includes(String(target).toLowerCase())) {
    return 'en';
  }

  throw new Error('只支持中文和英文互译。');
}

function extractLibreTranslateResult(data) {
  if (typeof data.translatedText === 'string') {
    return data.translatedText;
  }

  if (typeof data.translation === 'string') {
    return data.translation;
  }

  return null;
}

export async function translateText({ text, target, source, fetchImpl = fetch }) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error('请输入要翻译的文本。');
  }

  const targetLanguage = normalizeTargetLanguage(target);
  const sourceLanguage = source ? normalizeTargetLanguage(source) : detectSourceLanguage(trimmed);

  if (sourceLanguage === targetLanguage) {
    return {
      source: sourceLanguage,
      target: targetLanguage,
      translatedText: trimmed,
      provider: 'same-language',
    };
  }

  const apiUrl = process.env.TRANSLATE_API_URL;
  if (!apiUrl) {
    throw new Error('翻译服务尚未配置。请设置 `TRANSLATE_API_URL`，例如兼容 LibreTranslate 的 `/translate` 接口地址。');
  }

  const body = {
    q: trimmed,
    source: sourceLanguage,
    target: targetLanguage,
    format: 'text',
  };

  if (process.env.TRANSLATE_API_KEY) {
    body.api_key = process.env.TRANSLATE_API_KEY;
  }

  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`翻译服务请求失败：${response.status}`);
  }

  const data = await response.json();
  const translatedText = extractLibreTranslateResult(data);
  if (!translatedText) {
    throw new Error('翻译服务返回格式无法识别。');
  }

  return {
    source: sourceLanguage,
    target: targetLanguage,
    translatedText,
    provider: 'libretranslate-compatible',
  };
}
