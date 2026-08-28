import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildReminderMessages,
  collectReactionParticipantIds,
  processScheduleReminders,
} from '../src/schedule-reminders.js';

describe('schedule reminders', () => {
  it('deduplicates reaction users and excludes bots', async () => {
    const calls = [];
    const participants = await collectReactionParticipantIds(
      'channel-1',
      'message-1',
      [
        { count: 2, count_details: { normal: 2, burst: 0 }, emoji: { name: '👍', id: null } },
        { count: 2, count_details: { normal: 1, burst: 1 }, emoji: { name: 'join', id: '999' } },
      ],
      async (_channelId, _messageId, emoji, type) => {
        calls.push({ emoji, type });
        if (emoji === '👍') return [{ id: '222', bot: false }, { id: '333', bot: true }];
        if (type === 0) return [{ id: '444', bot: false }];
        return [{ id: '222', bot: false }];
      },
    );
    assert.deepEqual(participants, ['222', '444']);
    assert.deepEqual(calls, [
      { emoji: '👍', type: 0 },
      { emoji: 'join:999', type: 0 },
      { emoji: 'join:999', type: 1 },
    ]);
  });

  it('uses the pre-created thread 15 minutes before the event and mentions everyone once', async () => {
    const posts = [];
    const updates = [];
    const creates = [];
    const result = await processScheduleReminders({
      now: new Date('2026-08-07T01:45:00.000Z'),
      dependencies: {
        listSchedules: async () => [{
          guildId: 'guild-1',
          messageId: '1534651572061999304',
          channelId: 'channel-1',
          ownerId: '111',
          activity: '五人竞速',
          eventAt: '2026-08-07T02:00:00.000Z',
          threadId: 'thread-1',
        }],
        getMessage: async () => ({
          reactions: [{ count: 2, emoji: { name: '👍', id: null } }],
        }),
        getReactionUsers: async () => [
          { id: '222', bot: false },
          { id: '111', bot: false },
        ],
        createThread: async (channelId, messageId, name) => {
          creates.push({ channelId, messageId, name });
          return { id: 'thread-1' };
        },
        postMessage: async (threadId, payload) => {
          posts.push({ threadId, payload });
          return { sent: true };
        },
        updateSchedule: async (guildId, messageId, update) => {
          updates.push({ guildId, messageId, update });
          return update;
        },
      },
    });

    // Capture updates separately without coupling the worker to the storage implementation.
    assert.deepEqual(result, [{
      messageId: '1534651572061999304', status: 'sent', threadId: 'thread-1',
    }]);
    assert.deepEqual(creates, []);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].threadId, 'thread-1');
    assert.equal(posts[0].payload.content, '时间差不多咯！<@111> <@222>');
    assert.deepEqual(posts[0].payload.allowed_mentions.users, ['111', '222']);
    assert.equal(updates.at(-1).update.reminderStatus, 'sent');
  });

  it('does nothing before the reminder window and expires past events', async () => {
    const updated = [];
    const schedules = [
      {
        guildId: 'guild-1', messageId: 'future', channelId: 'channel-1',
        ownerId: '111', eventAt: '2026-08-07T03:00:00.000Z',
      },
      {
        guildId: 'guild-1', messageId: 'past', channelId: 'channel-1',
        ownerId: '111', eventAt: '2026-08-07T01:00:00.000Z',
      },
    ];
    const result = await processScheduleReminders({
      now: new Date('2026-08-07T02:00:00.000Z'),
      dependencies: {
        listSchedules: async () => schedules,
        updateSchedule: async (guildId, messageId, update) => {
          updated.push({ guildId, messageId, update });
        },
      },
    });
    assert.deepEqual(result, [{ messageId: 'past', status: 'expired' }]);
    assert.deepEqual(updated[0], {
      guildId: 'guild-1',
      messageId: 'past',
      update: { reminderStatus: 'expired' },
    });
  });

  it('splits large mention lists into safe message chunks', () => {
    const ids = Array.from({ length: 151 }, (_, index) => String(index + 1));
    const messages = buildReminderMessages(ids);
    assert.deepEqual(messages.map((message) => message.allowed_mentions.users.length), [75, 75, 1]);
  });
});
