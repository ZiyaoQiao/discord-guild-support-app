import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';

describe('local guild store', () => {
  it('saves profile, lfg, and build records', async () => {
    process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'wwm-store-'));
    const storage = await import(`../src/storage.js?case=${Date.now()}`);

    const profile = await storage.saveProfile('guild-1', 'user-1', {
      characterName: '燕小侠',
      role: 'dps',
    });
    assert.equal(profile.characterName, '燕小侠');
    assert.equal((await storage.getProfile('guild-1', 'user-1')).role, 'dps');

    const lfg = await storage.createLfg('guild-1', 'user-1', {
      activity: 'arena',
      startsAt: '今晚 21:00',
      note: '练习',
    });
    await storage.joinLfg('guild-1', lfg.id, 'user-2');
    const lfgList = await storage.listOpenLfg('guild-1');
    assert.deepEqual(lfgList[0].participants, ['user-1', 'user-2']);

    const build = await storage.saveBuild('guild-1', 'user-1', {
      name: '伞治疗入门',
      weapon: '伞',
      role: 'pve-healer',
      notes: '适合新手。',
    });
    await storage.voteBuild('guild-1', build.id, 'user-2');
    const builds = await storage.searchBuilds('guild-1', '治疗');
    assert.equal(builds[0].votes.length, 1);

    const rule = await storage.saveMessageReactionRule('guild-1', {
      userId: 'user-3',
      emojiName: 'lubian',
      emoji: 'lubian:1494439857135554660',
      channelIds: ['channel-1'],
      updatedBy: 'leader-1',
    });
    await storage.addMessageReactionRule('guild-1', {
      userId: 'user-3',
      emojiName: '13421142546174839',
      emoji: '13421142546174839:1495682797866713088',
      channelIds: [],
      updatedBy: 'leader-1',
    });
    await storage.addMessageReactionRule('guild-1', {
      userId: 'user-3',
      emojiName: '13421142546174839',
      emoji: '13421142546174839:1495682797866713088',
      channelIds: [],
      updatedBy: 'leader-2',
    });
    assert.equal(rule.userId, 'user-3');
    assert.equal((await storage.getMessageReactionRules('guild-1'))[0].emoji, 'lubian:1494439857135554660');
    assert.equal((await storage.getAllMessageReactionRules()).length, 2);
    assert.equal((await storage.removeMessageReactionRule('guild-1', {
      userId: 'user-3',
      emojiName: '13421142546174839',
      channelIds: [],
    })).emoji, '13421142546174839:1495682797866713088');
    assert.equal((await storage.getMessageReactionRules('guild-1')).length, 1);
    assert.equal(await storage.removeMessageReactionRule('guild-1', {
      userId: 'user-3',
      emoji: 'missing:1',
      channelIds: [],
    }), null);
    assert.equal((await storage.clearMessageReactionRules('guild-1')).length, 1);
    assert.equal((await storage.getMessageReactionRules('guild-1')).length, 0);

    const schedule = await storage.saveScheduleMessage('guild-1', {
      messageId: '1534651572061999304',
      channelId: 'channel-2',
      ownerId: 'user-1',
      activity: '五人竞速',
      formattedTime: '8/6/2026 周四 晚上（美东）',
      eventAt: '2026-08-07T02:00:00.000Z',
    });
    assert.equal(schedule.ownerId, 'user-1');
    assert.equal(
      (await storage.getScheduleMessage('guild-1', '1534651572061999304')).channelId,
      'channel-2',
    );
    assert.equal((await storage.listScheduleMessages())[0].guildId, 'guild-1');
    await storage.updateScheduleMessage('guild-1', '1534651572061999304', {
      reminderStatus: 'sent',
    });
    assert.equal(
      (await storage.getScheduleMessage('guild-1', '1534651572061999304')).reminderStatus,
      'sent',
    );
    assert.equal(
      (await storage.removeScheduleMessage('guild-1', '1534651572061999304')).activity,
      '五人竞速',
    );
    assert.equal(await storage.getScheduleMessage('guild-1', '1534651572061999304'), null);
  });
});
