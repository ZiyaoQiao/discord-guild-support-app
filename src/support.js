import { getCategoryLabel, getUrgencyLabel } from './where-winds-meet.js';

export function getInteractionUser(interaction) {
  return interaction.member?.user ?? interaction.user ?? {};
}

export function getOption(options = [], name, fallback = undefined) {
  const option = options.find((item) => item.name === name);
  return option?.value ?? fallback;
}

export function createTicketId(now = new Date()) {
  const timestamp = now instanceof Date ? now : new Date(now);
  const date = timestamp.toISOString().slice(0, 10).replaceAll('-', '');
  const entropy = timestamp.getTime().toString(36).slice(-5).toUpperCase();
  return `WWM-${date}-${entropy}`;
}

export function buildSupportTicket(interaction, fields) {
  const user = getInteractionUser(interaction);
  const category = fields.category ?? 'other';
  const urgency = fields.urgency ?? 'normal';

  return {
    id: createTicketId(),
    guildId: interaction.guild_id,
    channelId: interaction.channel_id,
    userId: user.id,
    username: user.global_name || user.username || '未知用户',
    category,
    categoryLabel: getCategoryLabel(category),
    urgency,
    urgencyLabel: getUrgencyLabel(urgency),
    details: fields.details?.trim() || '未提供细节。',
    createdAt: new Date().toISOString(),
  };
}

export function buildSupportLogMessage(ticket) {
  return {
    content: [
      `**${ticket.id}** | **${ticket.categoryLabel}** | **${ticket.urgencyLabel}**`,
      `提交人：<@${ticket.userId}> (${ticket.username})`,
      ticket.channelId ? `来源：<#${ticket.channelId}>` : undefined,
      '',
      ticket.details,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function extractModalValues(components = []) {
  const values = {};

  for (const component of components) {
    if (component.custom_id && Object.hasOwn(component, 'value')) {
      values[component.custom_id] = component.value;
    }

    if (Array.isArray(component.components)) {
      Object.assign(values, extractModalValues(component.components));
    }
  }

  return values;
}
