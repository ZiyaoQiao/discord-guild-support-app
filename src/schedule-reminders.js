import {
  createThreadFromMessage,
  getChannelMessage,
  listReactionUsers,
  postChannelMessage,
} from './discord.js';
import { listScheduleMessages, updateScheduleMessage } from './storage.js';

export const REMINDER_LEAD_MS = 15 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;
const MENTIONS_PER_MESSAGE = 75;

function reactionIdentifier(reaction) {
  const { emoji = {} } = reaction;
  return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

export async function collectReactionParticipantIds(
  channelId,
  messageId,
  reactions = [],
  fetchReactionUsers = listReactionUsers,
) {
  const participants = new Set();

  for (const reaction of reactions) {
    const emoji = reactionIdentifier(reaction);
    if (!emoji) continue;
    const types = [];
    if ((reaction.count_details?.normal ?? reaction.count ?? 0) > 0) types.push(0);
    if ((reaction.count_details?.burst ?? 0) > 0) types.push(1);

    for (const type of types) {
      let users;
      try {
        users = await fetchReactionUsers(channelId, messageId, emoji, type);
      } catch (error) {
        if (discordNotFound(error)) continue;
        throw error;
      }
      for (const user of users) {
        if (user?.id && !user.bot) participants.add(user.id);
      }
    }
  }

  return [...participants];
}

export function buildReminderMessages(participantIds) {
  const uniqueIds = [...new Set(participantIds.filter(Boolean))];
  const payloads = [];
  for (let index = 0; index < uniqueIds.length; index += MENTIONS_PER_MESSAGE) {
    const ids = uniqueIds.slice(index, index + MENTIONS_PER_MESSAGE);
    const prefix = index === 0 ? '时间差不多咯！' : '其他参与者：';
    payloads.push({
      content: `${prefix}${ids.map((id) => `<@${id}>`).join(' ')}`,
      allowed_mentions: { parse: [], users: ids },
    });
  }
  return payloads;
}

function threadAlreadyExists(error) {
  const message = String(error?.message || error);
  return message.includes('160004') || /thread has already been created/i.test(message);
}

function discordNotFound(error) {
  return String(error?.message || error).includes('Discord API 404');
}

export async function processScheduleReminders(options = {}) {
  const now = options.now ?? new Date();
  const dependencies = {
    listSchedules: listScheduleMessages,
    updateSchedule: updateScheduleMessage,
    getMessage: getChannelMessage,
    getReactionUsers: listReactionUsers,
    createThread: createThreadFromMessage,
    postMessage: postChannelMessage,
    ...options.dependencies,
  };
  const schedules = await dependencies.listSchedules();
  const results = [];

  for (const schedule of schedules) {
    if (!schedule.eventAt || ['sent', 'expired', 'source_missing'].includes(schedule.reminderStatus)) continue;
    const eventTime = Date.parse(schedule.eventAt);
    if (!Number.isFinite(eventTime)) continue;
    if (schedule.reminderNextAttemptAt && Date.parse(schedule.reminderNextAttemptAt) > now.getTime()) continue;

    if (eventTime <= now.getTime()) {
      await dependencies.updateSchedule(schedule.guildId, schedule.messageId, {
        reminderStatus: 'expired',
      });
      results.push({ messageId: schedule.messageId, status: 'expired' });
      continue;
    }
    if (eventTime - REMINDER_LEAD_MS > now.getTime()) continue;

    let sourceMessage;
    try {
      sourceMessage = await dependencies.getMessage(schedule.channelId, schedule.messageId);
    } catch (error) {
      if (discordNotFound(error)) {
        await dependencies.updateSchedule(schedule.guildId, schedule.messageId, {
          reminderStatus: 'source_missing',
        });
        results.push({ messageId: schedule.messageId, status: 'source_missing' });
        continue;
      }
      await dependencies.updateSchedule(schedule.guildId, schedule.messageId, {
        reminderStatus: 'pending',
        reminderNextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS).toISOString(),
        reminderLastError: String(error?.message || error).slice(0, 500),
      });
      console.error(`Failed to read scheduled message ${schedule.messageId}`, error);
      results.push({ messageId: schedule.messageId, status: 'retry' });
      continue;
    }

    try {
      const reactedIds = await collectReactionParticipantIds(
        schedule.channelId,
        schedule.messageId,
        sourceMessage.reactions,
        dependencies.getReactionUsers,
      );
      const participantIds = [schedule.ownerId, ...reactedIds];
      let threadId = schedule.threadId || sourceMessage.thread?.id;

      if (!threadId) {
        try {
          const thread = await dependencies.createThread(
            schedule.channelId,
            schedule.messageId,
            `活动提醒｜${schedule.activity}`,
          );
          threadId = thread.id;
        } catch (error) {
          if (!threadAlreadyExists(error)) throw error;
          threadId = schedule.messageId;
        }
        await dependencies.updateSchedule(schedule.guildId, schedule.messageId, {
          threadId,
          reminderStatus: 'sending',
        });
      }

      const payloads = buildReminderMessages(participantIds);
      for (const payload of payloads) {
        await dependencies.postMessage(threadId, payload);
      }
      await dependencies.updateSchedule(schedule.guildId, schedule.messageId, {
        threadId,
        reminderStatus: 'sent',
        reminderSentAt: now.toISOString(),
        reminderNextAttemptAt: null,
        reminderLastError: null,
      });
      results.push({ messageId: schedule.messageId, status: 'sent', threadId });
    } catch (error) {
      await dependencies.updateSchedule(schedule.guildId, schedule.messageId, {
        reminderStatus: 'pending',
        reminderNextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS).toISOString(),
        reminderLastError: String(error?.message || error).slice(0, 500),
      });
      console.error(`Failed to send schedule reminder for message ${schedule.messageId}`, error);
      results.push({ messageId: schedule.messageId, status: 'retry' });
    }
  }

  return results;
}

export function startScheduleReminderWorker(options = {}) {
  if (!process.env.DISCORD_TOKEN) return () => {};
  const intervalMs = options.intervalMs ?? 30_000;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processScheduleReminders(options);
    } catch (error) {
      console.error('Schedule reminder worker failed', error);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
