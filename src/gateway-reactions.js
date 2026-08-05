import WebSocket from 'ws';
import { addMessageReaction, listGuildEmojis } from './discord.js';
import {
  getAllMessageReactionRules,
  getMessageReactionRules,
} from './storage.js';

const DISCORD_GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';
const RECONNECT_DELAY_MS = 5000;
const GatewayOpcode = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
};

const GatewayIntentBits = {
  GUILDS: 1 << 0,
  GUILD_MESSAGES: 1 << 9,
};

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeReactionEmoji(value) {
  const emoji = String(value || '').trim();
  const customEmojiMatch = emoji.match(/^<a?:([^:>\s]+):(\d+)>$/);

  if (customEmojiMatch) {
    return `${customEmojiMatch[1]}:${customEmojiMatch[2]}`;
  }

  return emoji;
}

export async function resolveReactionEmojiInput(input, guildId, listEmojis = listGuildEmojis) {
  const emoji = normalizeReactionEmoji(input);
  if (!emoji) {
    throw new Error('请提供要自动添加的表情。');
  }

  if (emoji.includes(':') || /[^\w]/u.test(emoji) || !guildId) {
    return emoji;
  }

  const guildEmojis = await listEmojis(guildId);
  const match = guildEmojis.find((item) => item.name === emoji || item.id === emoji);
  if (!match) {
    throw new Error(`没有找到服务器自定义表情：${emoji}`);
  }

  return `${match.name}:${match.id}`;
}

export async function resolveGuildEmojiName(name, guildId, listEmojis = listGuildEmojis) {
  const emojiName = String(name || '').trim();
  if (!emojiName) {
    throw new Error('请提供服务器自定义表情名称。');
  }

  if (!guildId) {
    throw new Error('只能在服务器内解析自定义表情名称。');
  }

  const guildEmojis = await listEmojis(guildId);
  const match = guildEmojis.find((item) => item.name === emojiName);
  if (!match) {
    throw new Error(`没有找到服务器自定义表情：${emojiName}`);
  }

  return {
    emojiName: match.name,
    emoji: `${match.name}:${match.id}`,
  };
}

export function parseMessageReactionRules(env = process.env) {
  const rules = [];

  if (env.MESSAGE_REACTION_RULES) {
    const parsedRules = JSON.parse(env.MESSAGE_REACTION_RULES);
    if (!Array.isArray(parsedRules)) {
      throw new Error('MESSAGE_REACTION_RULES 必须是 JSON 数组。');
    }

    for (const rule of parsedRules) {
      rules.push({
        userId: String(rule.userId || rule.user_id || '').trim(),
        emoji: normalizeReactionEmoji(rule.emoji),
        guildId: String(rule.guildId || rule.guild_id || env.MESSAGE_REACTION_GUILD_ID || env.GUILD_ID || '').trim(),
        channelIds: splitCsv(rule.channelIds || rule.channel_ids),
      });
    }
  }

  if (env.MESSAGE_REACTION_USER_ID || env.MESSAGE_REACTION_EMOJI) {
    rules.push({
      userId: String(env.MESSAGE_REACTION_USER_ID || '').trim(),
      emoji: normalizeReactionEmoji(env.MESSAGE_REACTION_EMOJI),
      guildId: String(env.MESSAGE_REACTION_GUILD_ID || env.GUILD_ID || '').trim(),
      channelIds: splitCsv(env.MESSAGE_REACTION_CHANNEL_IDS),
    });
  }

  const validRules = rules.filter((rule) => rule.userId && rule.emoji);
  if (rules.length && validRules.length !== rules.length) {
    throw new Error('MESSAGE_REACTION 规则需要同时配置 userId 和 emoji。');
  }

  return validRules;
}

export function findMessageReactionRule(message, rules) {
  return findMessageReactionRules(message, rules)[0] ?? null;
}

export function findMessageReactionRules(message, rules) {
  if (!message?.id || !message?.channel_id || !message?.author?.id) {
    return [];
  }

  return rules.filter((rule) => {
    if (rule.userId !== message.author.id) {
      return false;
    }

    if (rule.guildId && rule.guildId !== message.guild_id) {
      return false;
    }

    if (rule.channelIds?.length && !rule.channelIds.includes(message.channel_id)) {
      return false;
    }

    return true;
  });
}

export async function reactToConfiguredMessage(message, rules, react = addMessageReaction) {
  const matchingRules = findMessageReactionRules(message, rules);
  if (!matchingRules.length) {
    return { sent: false, reason: 'no_matching_rule' };
  }

  for (const rule of matchingRules) {
    await react(message.channel_id, message.id, rule.emoji);
  }

  return { sent: true, reactions: matchingRules.length };
}

export async function getEffectiveMessageReactionRules(guildId, env = process.env) {
  return [
    ...parseMessageReactionRules(env),
    ...await getMessageReactionRules(guildId),
  ];
}

function identifyPayload(token) {
  return {
    op: GatewayOpcode.IDENTIFY,
    d: {
      token,
      intents: GatewayIntentBits.GUILDS | GatewayIntentBits.GUILD_MESSAGES,
      properties: {
        $os: process.platform,
        $browser: 'discord-guild-support-app',
        $device: 'discord-guild-support-app',
      },
    },
  };
}

export function startMessageReactionGateway({
  token = process.env.DISCORD_TOKEN,
  rules = parseMessageReactionRules(),
  rulesProvider,
  gatewayUrl = DISCORD_GATEWAY_URL,
  reconnectDelayMs = RECONNECT_DELAY_MS,
  WebSocketImpl = WebSocket,
  react = addMessageReaction,
} = {}) {
  if (!token || (!rules.length && !rulesProvider)) {
    return null;
  }

  let socket;
  let heartbeatTimer;
  let reconnectTimer;
  let lastSequence = null;
  let stopped = false;

  function clearTimers() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function send(payload) {
    if (socket?.readyState === WebSocketImpl.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) {
      return;
    }

    clearTimers();
    reconnectTimer = setTimeout(connect, reconnectDelayMs);
  }

  function connect() {
    clearTimers();
    socket = new WebSocketImpl(gatewayUrl);

    socket.on('message', (rawMessage) => {
      let payload;
      try {
        payload = JSON.parse(rawMessage.toString());
      } catch (error) {
        console.error('Failed to parse Discord Gateway payload', error);
        return;
      }

      if (payload.s !== null && payload.s !== undefined) {
        lastSequence = payload.s;
      }

      if (payload.op === GatewayOpcode.HELLO) {
        heartbeatTimer = setInterval(() => {
          send({ op: GatewayOpcode.HEARTBEAT, d: lastSequence });
        }, payload.d.heartbeat_interval);
        send(identifyPayload(token));
        return;
      }

      if (payload.op === GatewayOpcode.HEARTBEAT) {
        send({ op: GatewayOpcode.HEARTBEAT, d: lastSequence });
        return;
      }

      if (payload.op === GatewayOpcode.RECONNECT || payload.op === GatewayOpcode.INVALID_SESSION) {
        console.warn(`Discord Gateway requested reconnect or invalidated the session: opcode=${payload.op}`);
        socket.close();
        scheduleReconnect();
        return;
      }

      if (payload.op === GatewayOpcode.DISPATCH && payload.t === 'MESSAGE_CREATE') {
        Promise.resolve(rulesProvider ? rulesProvider(payload.d) : rules)
          .then(async (messageRules) => {
            const matchingRules = findMessageReactionRules(payload.d, messageRules);
            if (!matchingRules.length) {
              return { sent: false, reason: 'no_matching_rule' };
            }

            console.log(`Auto-reaction matched message ${payload.d.id} from user ${payload.d.author.id} in channel ${payload.d.channel_id}; reactions=${matchingRules.length}`);
            const result = await reactToConfiguredMessage(payload.d, matchingRules, react);
            console.log(`Auto-reaction completed for message ${payload.d.id}; reactions=${result.reactions ?? 0}`);
            return result;
          })
          .catch((error) => {
            console.error('Failed to add configured message reaction', error);
          });
        return;
      }

      if (payload.op === GatewayOpcode.DISPATCH && payload.t === 'READY') {
        console.log(`Discord Gateway ready as ${payload.d.user?.username ?? 'unknown'} (${payload.d.user?.id ?? 'unknown'}).`);
      }
    });

    socket.on('close', (code, reason) => {
      console.warn(`Discord Gateway closed: code=${code} reason=${reason?.toString() || ''}`);
      scheduleReconnect();
    });

    socket.on('error', (error) => {
      console.error('Discord Gateway connection error', error);
      socket.close();
    });
  }

  connect();

  return {
    stop() {
      stopped = true;
      clearTimers();
      socket?.close();
    },
  };
}

export async function startMessageReactionGatewayFromEnv() {
  try {
    const envRules = parseMessageReactionRules();
    const storedRules = await getAllMessageReactionRules();
    if (!envRules.length && !storedRules.length) {
      return null;
    }

    console.log(`Starting message reaction gateway for ${envRules.length + storedRules.length} rule(s).`);
    return startMessageReactionGateway({
      rulesProvider: (message) => getEffectiveMessageReactionRules(message.guild_id),
    });
  } catch (error) {
    console.error('Message reaction gateway is not configured correctly', error);
    return null;
  }
}
