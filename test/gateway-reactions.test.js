import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  addMessageReaction,
  createThreadFromMessage,
  deleteChannel,
  getChannelMessage,
  listReactionUsers,
} from '../src/discord.js';
import {
  findMessageReactionRule,
  findMessageReactionRules,
  normalizeReactionEmoji,
  parseMessageReactionRules,
  reactToConfiguredMessage,
  resolveGuildEmojiName,
  resolveReactionEmojiInput,
} from '../src/gateway-reactions.js';

const originalDiscordToken = process.env.DISCORD_TOKEN;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalDiscordToken === undefined) {
    delete process.env.DISCORD_TOKEN;
  } else {
    process.env.DISCORD_TOKEN = originalDiscordToken;
  }

  globalThis.fetch = originalFetch;
});

describe('message reaction gateway config', () => {
  it('parses a single user reaction rule from env vars', () => {
    assert.deepEqual(parseMessageReactionRules({
      GUILD_ID: 'guild-1',
      MESSAGE_REACTION_USER_ID: 'user-1',
      MESSAGE_REACTION_EMOJI: '🔥',
      MESSAGE_REACTION_CHANNEL_IDS: 'channel-1, channel-2',
    }), [{
      userId: 'user-1',
      emoji: '🔥',
      guildId: 'guild-1',
      channelIds: ['channel-1', 'channel-2'],
    }]);
  });

  it('parses JSON reaction rules and normalizes custom emoji', () => {
    assert.deepEqual(parseMessageReactionRules({
      MESSAGE_REACTION_RULES: JSON.stringify([
        { userId: 'user-1', emoji: '<:wwm:1234567890>', guildId: 'guild-1' },
        { user_id: 'user-2', emoji: '<a:spin:9876543210>', channel_ids: 'channel-3' },
      ]),
    }), [
      {
        userId: 'user-1',
        emoji: 'wwm:1234567890',
        guildId: 'guild-1',
        channelIds: [],
      },
      {
        userId: 'user-2',
        emoji: 'spin:9876543210',
        guildId: '',
        channelIds: ['channel-3'],
      },
    ]);
  });

  it('resolves a custom emoji name through guild emojis', async () => {
    assert.deepEqual(await resolveGuildEmojiName('lubian', 'guild-1', async () => [
      { name: 'lubian', id: '1494439857135554660' },
    ]), {
      emojiName: 'lubian',
      emoji: 'lubian:1494439857135554660',
    });
    assert.equal(await resolveReactionEmojiInput('lubian', 'guild-1', async () => [
      { name: 'lubian', id: '1494439857135554660' },
    ]), 'lubian:1494439857135554660');
    assert.equal(await resolveReactionEmojiInput('1495682797866713088', 'guild-1', async () => [
      { name: '13421142546174839', id: '1495682797866713088' },
    ]), '13421142546174839:1495682797866713088');
  });

  it('matches messages by configured user, guild, and channel', () => {
    const rules = parseMessageReactionRules({
      GUILD_ID: 'guild-1',
      MESSAGE_REACTION_USER_ID: 'user-1',
      MESSAGE_REACTION_EMOJI: '👍',
      MESSAGE_REACTION_CHANNEL_IDS: 'channel-1',
    });

    assert.equal(findMessageReactionRule({
      id: 'message-1',
      channel_id: 'channel-1',
      guild_id: 'guild-1',
      author: { id: 'user-1' },
    }, rules)?.emoji, '👍');
    assert.equal(findMessageReactionRule({
      id: 'message-2',
      channel_id: 'channel-2',
      guild_id: 'guild-1',
      author: { id: 'user-1' },
    }, rules), null);
  });

  it('adds all matching reactions and skips non-matching messages', async () => {
    const calls = [];
    const rules = [
      {
        userId: 'user-1',
        emoji: normalizeReactionEmoji('<:wwm:1234567890>'),
        guildId: 'guild-1',
        channelIds: [],
      },
      {
        userId: 'user-1',
        emoji: '13421142546174839:1495682797866713088',
        guildId: 'guild-1',
        channelIds: [],
      },
    ];
    const message = {
      id: 'message-1',
      channel_id: 'channel-1',
      guild_id: 'guild-1',
      author: { id: 'user-1' },
    };

    assert.equal(findMessageReactionRules(message, rules).length, 2);
    let inFlight = false;
    const sent = await reactToConfiguredMessage(message, rules, async (...args) => {
      assert.equal(inFlight, false);
      inFlight = true;
      calls.push(args);
      await Promise.resolve();
      inFlight = false;
      return { sent: true };
    });
    const skipped = await reactToConfiguredMessage({
      id: 'message-2',
      channel_id: 'channel-1',
      guild_id: 'guild-1',
      author: { id: 'user-2' },
    }, rules, async (...args) => {
      calls.push(args);
      return { sent: true };
    });

    assert.deepEqual(sent, { sent: true, reactions: 2 });
    assert.deepEqual(skipped, { sent: false, reason: 'no_matching_rule' });
    assert.deepEqual(calls, [
      ['channel-1', 'message-1', 'wwm:1234567890'],
      ['channel-1', 'message-1', '13421142546174839:1495682797866713088'],
    ]);
  });
});

describe('Discord reaction REST helper', () => {
  it('uses the add reaction endpoint with URL-encoded emoji', async () => {
    process.env.DISCORD_TOKEN = 'test-token';
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return { ok: true };
    };

    assert.deepEqual(await addMessageReaction('channel-1', 'message-1', 'wwm:1234567890'), { sent: true });
    assert.equal(calls.length, 1);
    assert.match(
      calls[0].url,
      /\/channels\/channel-1\/messages\/message-1\/reactions\/wwm%3A1234567890\/@me$/,
    );
    assert.equal(calls[0].options.method, 'PUT');
  });

  it('retries reaction requests after Discord rate limits', async () => {
    process.env.DISCORD_TOKEN = 'test-token';
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) {
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ retry_after: 0, global: false }),
        };
      }

      return { ok: true };
    };

    assert.deepEqual(await addMessageReaction('channel-1', 'message-1', 'wwm:1234567890'), { sent: true });
    assert.equal(calls.length, 2);
  });

  it('reads messages and reaction users, then creates a message thread', async () => {
    process.env.DISCORD_TOKEN = 'test-token';
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/channels/channel-1/messages/message-1')) {
        return { ok: true, json: async () => ({ id: 'message-1', reactions: [] }) };
      }
      if (url.includes('/reactions/')) {
        return { ok: true, json: async () => [{ id: 'user-1', bot: false }] };
      }
      return { ok: true, json: async () => ({ id: 'thread-1' }) };
    };

    assert.equal((await getChannelMessage('channel-1', 'message-1')).id, 'message-1');
    assert.deepEqual(await listReactionUsers('channel-1', 'message-1', 'join:999'), [
      { id: 'user-1', bot: false },
    ]);
    assert.equal(
      (await createThreadFromMessage('channel-1', 'message-1', '活动提醒｜五人竞速')).id,
      'thread-1',
    );
    assert.match(calls[1].url, /\/reactions\/join%3A999\?limit=100&type=0$/);
    assert.match(calls[2].url, /\/channels\/channel-1\/messages\/message-1\/threads$/);
    assert.equal(calls[2].options.method, 'POST');
    assert.deepEqual(await deleteChannel('thread-1'), { deleted: true });
    assert.match(calls[3].url, /\/channels\/thread-1$/);
    assert.equal(calls[3].options.method, 'DELETE');
  });
});
