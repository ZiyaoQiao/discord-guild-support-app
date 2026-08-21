const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const CHINESE_WEEKDAYS = new Map([
  ['日', 0], ['天', 0], ['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5], ['六', 6],
]);
const PERIODS = '凌晨|早上|上午|中午|下午|傍晚|晚上';
const NUMBER_TOKEN = String.raw`(?:\d{1,2}|[零〇一二两三四五六七八九十]{1,3})`;

const ZONES = [
  { label: '美东', timeZone: 'America/New_York', aliases: ['美东', '美国东部', '美国东岸', '东部时间', 'et', 'est', 'edt'] },
  { label: '美西', timeZone: 'America/Los_Angeles', aliases: ['美西', '美国西部', '美国西岸', '西部时间', 'pt', 'pst', 'pdt'] },
  { label: '美中', timeZone: 'America/Chicago', aliases: ['美中', '美国中部', '中部时间', 'ct', 'cst', 'cdt'] },
  { label: '美山', timeZone: 'America/Denver', aliases: ['美山', '美国山地', '山地时间', 'mt', 'mst', 'mdt'] },
  { label: '加东', timeZone: 'America/Toronto', aliases: ['加东', '加拿大东部', '加拿大东岸'] },
  { label: '加西', timeZone: 'America/Vancouver', aliases: ['加西', '加拿大西部', '加拿大西岸'] },
  { label: '加中', timeZone: 'America/Winnipeg', aliases: ['加中', '加拿大中部'] },
];

function normalizeZoneInput(value) {
  return String(value || '').trim().toLowerCase().replaceAll(/\s+/g, '');
}

export function resolveScheduleZone(value) {
  const normalized = normalizeZoneInput(value);
  const zone = ZONES.find((item) => item.aliases.some((alias) => normalizeZoneInput(alias) === normalized));
  if (!zone) {
    throw new Error('无法识别时区。可使用：美东、美西、美中、美山、加东、加西或加中。');
  }
  return { label: zone.label, timeZone: zone.timeZone };
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function zonedDateParts(now, timeZone) {
  const { year, month, day } = zonedParts(now, timeZone);
  return { year, month, day };
}

function dateFromParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('日期无效，请检查月份和日期。');
  }
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function chineseNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = new Map([
    ['零', 0], ['〇', 0], ['一', 1], ['二', 2], ['两', 2], ['三', 3],
    ['四', 4], ['五', 5], ['六', 6], ['七', 7], ['八', 8], ['九', 9],
  ]);
  if (value === '十') return 10;
  if (value.includes('十')) {
    const [tens, ones] = value.split('十');
    return (tens ? digits.get(tens) : 1) * 10 + (ones ? digits.get(ones) : 0);
  }
  return digits.get(value);
}

function to24Hour(hour, period) {
  if (['下午', '傍晚', '晚上', '中午'].includes(period) && hour < 12) return hour + 12;
  if (['凌晨', '早上', '上午'].includes(period) && hour === 12) return 0;
  return hour;
}

function normalizeTimeText(input) {
  const numericTime = input.match(new RegExp(
    String.raw`(${PERIODS})?\s*(${NUMBER_TOKEN})\s*(?:[:：点时])\s*(${NUMBER_TOKEN}|半)?\s*(?:分)?`,
  ));
  if (!numericTime) {
    throw new Error('必须写明具体时间，例如“明晚十点”“明晚10:00”或“后天20:00”。');
  }

  const [, period, hourToken, minuteToken] = numericTime;
  const displayHour = chineseNumber(hourToken);
  const minute = minuteToken === undefined ? 0 : (minuteToken === '半' ? 30 : chineseNumber(minuteToken));
  if (!Number.isInteger(displayHour) || displayHour > 23 || !Number.isInteger(minute) || minute > 59) {
    throw new Error('时间无效，请使用例如“晚上十点”或“20:30”。');
  }
  if (period && (displayHour < 1 || displayHour > 12)) {
    throw new Error('带“上午/下午/晚上”的时间请使用 1–12 点，例如“晚上十点”。');
  }

  return {
    text: `${period ? `${period} ` : ''}${displayHour}:${String(minute).padStart(2, '0')}`,
    matched: numericTime[0],
    hour: to24Hour(displayHour, period),
    minute,
  };
}

function normalizeTimeInput(value) {
  return String(value || '')
    .trim()
    .replaceAll(/\s+/g, ' ')
    .replaceAll('今晚', '今天晚上')
    .replaceAll('明晚', '明天晚上')
    .replaceAll('明早', '明天早上')
    .replaceAll('这周', '周')
    .replace(/晚(?=\s*(?:\d|[零〇一二两三四五六七八九十]))/g, '晚上');
}

function resolveDate(input, now, timeZone) {
  const current = zonedDateParts(now, timeZone);
  const today = dateFromParts(current.year, current.month, current.day);
  const relative = input.match(/今天|明天|后天/);
  if (relative) {
    const offsets = { 今天: 0, 明天: 1, 后天: 2 };
    return { date: addDays(today, offsets[relative[0]]), matched: relative[0] };
  }

  const chineseDate = input.match(new RegExp(
    String.raw`(?:(\d{4})年)?\s*(${NUMBER_TOKEN})月\s*(${NUMBER_TOKEN})[日号]?`,
  ));
  const usDate = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const isoDate = input.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  const shortDate = input.match(/(\d{1,2})[/-](\d{1,2})/);
  if (chineseDate || usDate || isoDate || shortDate) {
    const matched = chineseDate || usDate || isoDate || shortDate;
    const yearToken = chineseDate?.[1] || usDate?.[3] || isoDate?.[1];
    let year = yearToken ? Number(yearToken) : current.year;
    const month = chineseDate
      ? chineseNumber(chineseDate[2])
      : Number(usDate?.[1] || isoDate?.[2] || shortDate?.[1]);
    const day = chineseDate
      ? chineseNumber(chineseDate[3])
      : Number(usDate?.[2] || isoDate?.[3] || shortDate?.[2]);
    let date = dateFromParts(year, month, day);
    if (!yearToken && date < today) {
      year += 1;
      date = dateFromParts(year, month, day);
    }
    return { date, matched: matched[0] };
  }

  const weekday = input.match(/(下周|下星期|周|星期)([一二三四五六日天])/);
  if (weekday) {
    const targetWeekday = CHINESE_WEEKDAYS.get(weekday[2]);
    let daysAhead;
    if (weekday[1] === '下周' || weekday[1] === '下星期') {
      const daysToNextMonday = ((8 - today.getUTCDay()) % 7) || 7;
      const offsetFromMonday = targetWeekday === 0 ? 6 : targetWeekday - 1;
      daysAhead = daysToNextMonday + offsetFromMonday;
    } else {
      daysAhead = (targetWeekday - today.getUTCDay() + 7) % 7 || 7;
    }
    return { date: addDays(today, daysAhead), matched: weekday[0] };
  }
  throw new Error('没有识别到日期，请输入例如“明晚十点”或“8月10日 20:00”。');
}

function zonedDateTimeToUtc(date, hour, minute, timeZone) {
  const target = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour,
    minute,
  };
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, hour, minute, 0);
  let candidate = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      0,
    );
    candidate += targetAsUtc - actualAsUtc;
  }

  const verified = zonedParts(new Date(candidate), timeZone);
  if (
    verified.year !== target.year
    || verified.month !== target.month
    || verified.day !== target.day
    || verified.hour !== target.hour
    || verified.minute !== target.minute
  ) {
    throw new Error('该时间在所选时区不存在，可能处于夏令时切换时段，请换一个时间。');
  }
  return new Date(candidate);
}

function removeOnce(input, value) {
  const index = input.indexOf(value);
  if (index < 0) return input;
  return `${input.slice(0, index)} ${input.slice(index + value.length)}`;
}

export function formatScheduleDate(date, timeText = '', zoneLabel = '') {
  const formatted = `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()} ${WEEKDAY_LABELS[date.getUTCDay()]}`;
  const withTime = timeText ? `${formatted} ${timeText}` : formatted;
  return zoneLabel ? `${withTime}（${zoneLabel}）` : withTime;
}

export function parseScheduleFields(fields, options = {}) {
  const activity = String(fields.activity || '').trim();
  const timeInput = normalizeTimeInput(fields.time);
  if (!activity) throw new Error('请输入招募活动。');
  if (!timeInput) throw new Error('请输入日期和具体时间。');

  const zone = resolveScheduleZone(fields.zone);
  const now = options.now ?? new Date();
  const resolvedDate = resolveDate(timeInput, now, zone.timeZone);
  const resolvedTime = normalizeTimeText(removeOnce(timeInput, resolvedDate.matched));
  const eventAt = zonedDateTimeToUtc(
    resolvedDate.date,
    resolvedTime.hour,
    resolvedTime.minute,
    zone.timeZone,
  );
  if (eventAt.getTime() <= now.getTime()) {
    throw new Error('活动时间必须晚于现在。');
  }

  return {
    activity,
    date: resolvedDate.date,
    timeText: resolvedTime.text,
    zoneLabel: zone.label,
    timeZone: zone.timeZone,
    eventAt: eventAt.toISOString(),
    formattedTime: formatScheduleDate(resolvedDate.date, resolvedTime.text, zone.label),
  };
}

export function buildRecruitingMessage(schedule, userId) {
  return {
    content: `招募：${schedule.activity}\n时间：${schedule.formattedTime}\n发起人：<@${userId}>\n\n👇 有意参加？请点击下方 👍 或任意表情报名！`,
  };
}
