import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  BAIYE_DRAGON_COUNTDOWNS_MS,
  BAIYE_DURATION_MS,
  BAIYE_FIRST_WARNING_LEAD_MS,
  BAIYE_REFRESH_OFFSETS_MS,
  BAIYE_WARNING_REPETITIONS,
  BaiyeVoiceService,
  buildWarningPcm,
  formatRemainingDuration,
  parseStartDelay,
  readPcmWave,
} from '../src/baiye-voice.js';

function createFakeClock(start = 0) {
  let now = start;
  let nextId = 1;
  const timers = new Map();

  async function flushMicrotasks() {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  }

  return {
    now: () => now,
    flush: flushMicrotasks,
    setTimer(callback, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    async advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const pending = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!pending) break;
        const [id, timer] = pending;
        timers.delete(id);
        now = timer.at;
        timer.callback();
        await flushMicrotasks();
      }
      now = target;
      await flushMicrotasks();
    },
  };
}

describe('baiye voice reminders', () => {
  it('counts down from 30 minutes and visits two channels before each refresh', async () => {
    const clock = createFakeClock(1_000_000);
    const events = [];
    const connector = {
      async prepare() {
        events.push('prepared');
      },
      async connect({ channelId }) {
        events.push(`joined:${channelId}`);
        return {
          async playWarning(kind) {
            events.push(`warning:start:${kind}:${channelId}`);
            await Promise.resolve();
            events.push(`warning:end:${kind}:${channelId}`);
          },
          destroy() {
            events.push(`left:${channelId}`);
          },
        };
      },
    };
    const service = new BaiyeVoiceService({
      connector,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });

    const session = await service.setup({
      guildId: 'guild-1',
      channelOneId: 'voice-1',
      channelTwoId: 'voice-2',
      ownerId: 'user-1',
      startIn: '10',
    });
    assert.equal(session.phase, 'waiting');
    assert.deepEqual(events, ['prepared']);

    await clock.advance(10 * 60 * 1000);
    const running = service.getSession('guild-1');
    assert.equal(running.phase, 'running');
    assert.equal(running.remainingToEndMs, 30 * 60 * 1000);
    assert.deepEqual(events, ['prepared']);

    let elapsed = 0;
    for (const refreshOffset of BAIYE_REFRESH_OFFSETS_MS) {
      const firstAt = refreshOffset - BAIYE_FIRST_WARNING_LEAD_MS;
      await clock.advance(firstAt - elapsed);
      elapsed = firstAt;
      assert.deepEqual(events.slice(-8), [
        'joined:voice-1',
        'warning:start:mob:voice-1',
        'warning:end:mob:voice-1',
        'left:voice-1',
        'joined:voice-2',
        'warning:start:mob:voice-2',
        'warning:end:mob:voice-2',
        'left:voice-2',
      ]);
    }

    await clock.advance((30 * 60 * 1000) - elapsed);
    assert.equal(events.filter((event) => event.startsWith('warning:start:')).length, 14);
    assert.equal(events.filter((event) => event.startsWith('warning:start:mob:')).length, 10);
    assert.equal(events.filter((event) => event.startsWith('warning:start:dragon:')).length, 4);
    assert.equal(events.filter((event) => event.startsWith('left:')).length, 14);
    assert.equal(events.at(-1), 'left:voice-2');
    assert.equal(service.getSession('guild-1'), null);
  });

  it('loads the bundled audio, boosts it, and parses minute or minute:second delays', async () => {
    const audioPath = fileURLToPath(new URL('../assets/baiye-refresh-warning.wav', import.meta.url));
    const dragonAudioPath = fileURLToPath(new URL('../assets/baiye-dragon-warning.wav', import.meta.url));
    const pcm = readPcmWave(await readFile(audioPath));
    const dragonPcm = readPcmWave(await readFile(dragonAudioPath));
    const warning = buildWarningPcm(pcm);
    assert.ok(pcm.length > 1000);
    assert.ok(dragonPcm.length > 1000);
    assert.equal(BAIYE_WARNING_REPETITIONS, 2);
    assert.ok(warning.length > pcm.length * 2);
    assert.ok(warning.length / (48_000 * 2 * 2) < 8);
    let sourcePeak = 0;
    let warningPeak = 0;
    for (let offset = 0; offset < pcm.length; offset += 2) {
      sourcePeak = Math.max(sourcePeak, Math.abs(pcm.readInt16LE(offset)));
    }
    for (let offset = 0; offset < warning.length; offset += 2) {
      warningPeak = Math.max(warningPeak, Math.abs(warning.readInt16LE(offset)));
    }
    assert.ok(warningPeak > sourcePeak);
    assert.ok(warningPeak <= 32_767);
    assert.equal(parseStartDelay('10'), 10 * 60 * 1000);
    assert.equal(parseStartDelay('1:29'), 89 * 1000);
    assert.equal(parseStartDelay('0:00'), 0);
    assert.throws(() => parseStartDelay('1:60'), /分:秒/);
    assert.equal(formatRemainingDuration(630_000), '10 分 30 秒');
    assert.equal(formatRemainingDuration(60_000), '1 分钟');
  });

  it('announces the dragon in both channels at countdown 17:05 and 16:05', async () => {
    const clock = createFakeClock();
    const events = [];
    const connector = {
      async prepare() {},
      async connect({ channelId }) {
        events.push(`joined:${channelId}`);
        return {
          async playWarning(kind) {
            events.push(`warning:${kind}:${channelId}`);
          },
          destroy() {
            events.push(`left:${channelId}`);
          },
        };
      },
    };
    const service = new BaiyeVoiceService({
      connector,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });

    await service.setup({
      guildId: 'guild-1',
      channelOneId: 'voice-1',
      channelTwoId: 'voice-2',
      ownerId: 'user-1',
      startIn: '0',
    });

    const firstElapsed = BAIYE_DURATION_MS - BAIYE_DRAGON_COUNTDOWNS_MS[0];
    await clock.advance(firstElapsed);
    assert.deepEqual(events.slice(-6), [
      'joined:voice-1',
      'warning:dragon:voice-1',
      'left:voice-1',
      'joined:voice-2',
      'warning:dragon:voice-2',
      'left:voice-2',
    ]);

    await clock.advance(BAIYE_DRAGON_COUNTDOWNS_MS[0] - BAIYE_DRAGON_COUNTDOWNS_MS[1]);
    assert.deepEqual(events.slice(-6), [
      'joined:voice-1',
      'warning:dragon:voice-1',
      'left:voice-1',
      'joined:voice-2',
      'warning:dragon:voice-2',
      'left:voice-2',
    ]);
    assert.equal(events.filter((event) => event.startsWith('warning:dragon:')).length, 4);
  });

  it('joins channel two immediately after channel one finishes', async () => {
    const clock = createFakeClock();
    const events = [];
    let finishFirst;
    const firstPlayback = new Promise((resolve) => {
      finishFirst = resolve;
    });
    const connector = {
      async prepare() {},
      async connect({ channelId }) {
        events.push(`joined:${channelId}`);
        return {
          async playWarning() {
            if (channelId === 'voice-1') await firstPlayback;
          },
          destroy() {
            events.push(`left:${channelId}`);
          },
        };
      },
    };
    const service = new BaiyeVoiceService({
      connector,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });

    await service.setup({
      guildId: 'guild-1',
      channelOneId: 'voice-1',
      channelTwoId: 'voice-2',
      ownerId: 'user-1',
      startIn: '0',
    });
    await clock.advance((5 * 60 * 1000) - BAIYE_FIRST_WARNING_LEAD_MS);
    assert.deepEqual(events, ['joined:voice-1']);

    finishFirst();
    await clock.flush();
    assert.deepEqual(events, [
      'joined:voice-1',
      'left:voice-1',
      'joined:voice-2',
      'left:voice-2',
    ]);
  });
});
