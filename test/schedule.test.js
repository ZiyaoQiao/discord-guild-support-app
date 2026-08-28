import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRecruitingMessage,
  parseScheduleFields,
  resolveScheduleZone,
} from '../src/schedule.js';

const now = new Date('2026-08-05T19:00:00.000Z');
const options = { now };

describe('schedule helpers', () => {
  it('parses separate time, zone, and activity fields', () => {
    const result = parseScheduleFields({
      time: '明晚十点',
      zone: '美东',
      activity: '五人竞速',
    }, options);
    assert.equal(result.activity, '五人竞速');
    assert.equal(result.timeZone, 'America/New_York');
    assert.equal(result.formattedTime, '8/6/2026 周四 晚上 10:00（美东）');
    assert.equal(result.eventAt, '2026-08-07T02:00:00.000Z');
  });

  it('parses a Chinese date and specific time in the selected zone', () => {
    const result = parseScheduleFields({
      time: '8月10日下午三点半',
      zone: '加西',
      activity: '五人竞速',
    }, options);
    assert.equal(result.formattedTime, '8/10/2026 周一 下午 3:30（加西）');
    assert.equal(result.eventAt, '2026-08-10T22:30:00.000Z');
  });

  it('accepts common Chinese and English zone aliases', () => {
    assert.deepEqual(resolveScheduleZone('美国西部'), {
      label: '美西',
      timeZone: 'America/Los_Angeles',
    });
    assert.equal(resolveScheduleZone('ET').label, '美东');
    assert.equal(resolveScheduleZone('加拿大东岸').label, '加东');
  });

  it('parses upcoming weekdays and 24-hour times', () => {
    const result = parseScheduleFields({
      time: '周五 20:00',
      zone: '美中',
      activity: '团本开荒',
    }, options);
    assert.equal(result.formattedTime, '8/7/2026 周五 20:00（美中）');
    assert.equal(result.eventAt, '2026-08-08T01:00:00.000Z');
  });

  it('requires both a date and a specific time', () => {
    assert.throws(() => parseScheduleFields({
      time: '晚上十点', zone: '美东', activity: '五人竞速',
    }, options), /没有识别到日期/);
    assert.throws(() => parseScheduleFields({
      time: '明天晚上', zone: '美东', activity: '五人竞速',
    }, options), /必须写明具体时间/);
    assert.throws(() => parseScheduleFields({
      time: '明晚十点', zone: '欧洲', activity: '五人竞速',
    }, options), /无法识别时区/);
    assert.throws(() => parseScheduleFields({
      time: '明晚十点', activity: '五人竞速',
    }, options), /无法识别时区/);
  });

  it('accepts full-width time separators', () => {
    const result = parseScheduleFields({
      time: '后天20：00', zone: '美西', activity: '团本',
    }, options);
    assert.equal(result.formattedTime, '8/7/2026 周五 20:00（美西）');
    assert.equal(result.eventAt, '2026-08-08T03:00:00.000Z');
  });

  it('parses this-week weekday shorthand with a specific period', () => {
    const result = parseScheduleFields({
      time: '这周日晚9点', zone: '美东', activity: '群策',
    }, options);
    assert.equal(result.formattedTime, '8/9/2026 周日 晚上 9:00（美东）');
    assert.equal(result.eventAt, '2026-08-10T01:00:00.000Z');
  });

  it('parses Chinese-number months and days', () => {
    const result = parseScheduleFields({
      time: '十月一号晚9点', zone: '美东', activity: '演武',
    }, options);
    assert.equal(result.formattedTime, '10/1/2026 周四 晚上 9:00（美东）');
    assert.equal(result.eventAt, '2026-10-02T01:00:00.000Z');
  });

  it('rejects an event time that is not later than publication time', () => {
    assert.throws(() => parseScheduleFields({
      time: '今天15:00', zone: '美东', activity: '演武',
    }, options), /活动时间必须晚于现在/);
  });

  it('builds the requested recruiting message format', () => {
    const schedule = parseScheduleFields({
      time: '明晚十点', zone: '美东', activity: '五人竞速',
    }, options);
    assert.deepEqual(buildRecruitingMessage(schedule, '123'), {
      content: '招募：五人竞速\n时间：8/6/2026 周四 晚上 10:00（美东）\n发起人：<@123>\n\n👇 有意参加？请点击下方 👍 或任意表情报名！',
    });
  });
});
