import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { InteractionResponseType } from '../src/constants.js';
import { handleInteraction } from '../src/interactions.js';
import { rememberMemeCandidates } from '../src/integrations/meme-stickers.js';

const originalDiscordToken = process.env.DISCORD_TOKEN;
const originalReactionAdminRoleId = process.env.MESSAGE_REACTION_ADMIN_ROLE_ID;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalDiscordToken === undefined) {
    delete process.env.DISCORD_TOKEN;
  } else {
    process.env.DISCORD_TOKEN = originalDiscordToken;
  }

  if (originalReactionAdminRoleId === undefined) {
    delete process.env.MESSAGE_REACTION_ADMIN_ROLE_ID;
  } else {
    process.env.MESSAGE_REACTION_ADMIN_ROLE_ID = originalReactionAdminRoleId;
  }

  globalThis.fetch = originalFetch;
});

describe('interaction routing', () => {
  it('posts selected meme as a standalone channel message without referencing the candidate message', async () => {
    process.env.DISCORD_TOKEN = 'test-token';
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { ok: true };
    };

    const [selection] = rememberMemeCandidates([{
      title: '猫猫无语',
      description: '斗图啦表情包候选',
      pageUrl: 'https://www.doutupk.com/photo/1',
      imageUrl: 'https://img.doutupk.com/cat.gif',
      source: 'doutupk',
      sourceLabel: '斗图啦',
    }], 'user-1', '猫猫无语');

    const originalEmbeds = [
      { image: { url: 'https://img.doutupk.com/candidate-1.gif' } },
      { image: { url: 'https://img.doutupk.com/candidate-2.gif' } },
    ];

    const response = await handleInteraction({
      type: 3,
      guild_id: 'guild-1',
      channel_id: 'channel-1',
      member: { user: { id: 'user-1', username: 'tester' } },
      data: { custom_id: `meme_post:${selection.id}` },
      message: {
        content: '',
        embeds: originalEmbeds,
        components: [{ type: 1, components: [] }],
      },
    });

    assert.equal(response.type, InteractionResponseType.UPDATE_MESSAGE);
    assert.deepEqual(response.data, {
      content: '',
      components: [],
      embeds: originalEmbeds,
      allowed_mentions: { parse: [] },
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/channels\/channel-1\/messages$/);
    assert.deepEqual(calls[0].body, {
      allowed_mentions: { parse: [] },
      content: '',
      embeds: [{ image: { url: 'https://img.doutupk.com/cat.gif' } }],
    });
    assert.equal(Object.hasOwn(calls[0].body, 'message_reference'), false);
  });

  it('blocks auto-reaction edits from members without the configured role', async () => {
    process.env.MESSAGE_REACTION_ADMIN_ROLE_ID = 'role-1';

    const response = await handleInteraction({
      type: 2,
      guild_id: 'guild-1',
      member: {
        roles: ['other-role'],
        user: { id: 'user-1', username: 'tester' },
      },
      data: {
        name: 'auto-reaction',
        options: [{
          name: 'set',
          options: [
            { name: 'user_id', value: '1017955151765573723' },
            { name: 'emoji', value: 'lubian' },
          ],
        }],
      },
    });

    assert.equal(response.type, InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    assert.match(response.data.content, /只有 <@&role-1> 可以修改自动反应设置/);
  });
});
