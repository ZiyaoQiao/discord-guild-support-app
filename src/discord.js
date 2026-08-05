const API_BASE_URL = 'https://discord.com/api/v10';
const MAX_RATE_LIMIT_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function DiscordRequest(endpoint, options = {}) {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is required for Discord API requests.');
  }

  const body = options.body ? JSON.stringify(options.body) : undefined;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      ...options,
      body,
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent': 'DiscordGuildSupportApp (https://github.com/local/discord-guild-support-app, 0.1.0)',
        ...options.headers,
      },
    });

    if (response.ok) {
      return response;
    }

    const text = await response.text();
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      let retryAfterMs = 1000;
      try {
        const rateLimitBody = JSON.parse(text);
        retryAfterMs = Math.ceil(Number(rateLimitBody.retry_after ?? 1) * 1000) + 50;
      } catch {
        retryAfterMs = 1000;
      }

      console.warn(`Discord API rate limited ${endpoint}; retrying in ${retryAfterMs}ms.`);
      await sleep(retryAfterMs);
      continue;
    }

    throw new Error(`Discord API ${response.status}: ${text}`);
  }

  throw new Error('Discord API request failed after retry.');
}

export async function installCommands(appId, commands, guildId = undefined) {
  if (!appId) {
    throw new Error('APP_ID is required to register commands.');
  }

  const endpoint = guildId
    ? `applications/${appId}/guilds/${guildId}/commands`
    : `applications/${appId}/commands`;

  return DiscordRequest(endpoint, {
    method: 'PUT',
    body: commands,
  });
}

export async function postChannelMessage(channelId, message) {
  if (!channelId) {
    return { sent: false, reason: 'missing_channel' };
  }

  await DiscordRequest(`channels/${channelId}/messages`, {
    method: 'POST',
    body: {
      allowed_mentions: { parse: [] },
      ...message,
    },
  });

  return { sent: true };
}

export async function addMessageReaction(channelId, messageId, emoji) {
  if (!channelId || !messageId || !emoji) {
    return { sent: false, reason: 'missing_reaction_target' };
  }

  await DiscordRequest(
    `channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: 'PUT' },
  );

  return { sent: true };
}

export async function listGuildEmojis(guildId) {
  if (!guildId) {
    return [];
  }

  const response = await DiscordRequest(`guilds/${guildId}/emojis`, {
    method: 'GET',
  });

  return response.json();
}
