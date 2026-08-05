import {
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  MessageFlags,
  TextInputStyle,
} from './constants.js';
import {
  futureUseCases,
  getBuildRoleLabel,
  getCategoryLabel,
  getLfgActivityLabel,
  getRoleLabel,
  getUrgencyLabel,
  guideTopics,
} from './where-winds-meet.js';

function trimText(value, limit = 300) {
  if (!value) {
    return '';
  }
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

export function ephemeral(content, components = [], embeds = []) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      components,
      embeds,
      flags: MessageFlags.EPHEMERAL,
      allowed_mentions: { parse: [] },
    },
  };
}

export function publicMessage(content, components = [], embeds = []) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      components,
      embeds,
      allowed_mentions: { parse: [] },
    },
  };
}

export function updateMessage(content, components = [], embeds = []) {
  return {
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content,
      components,
      embeds,
      allowed_mentions: { parse: [] },
    },
  };
}

export function guideMessage(topicKey = 'daily') {
  const topic = guideTopics[topicKey] ?? guideTopics.daily;
  return [
    `**${topic.title}**`,
    ...topic.lines.map((line) => `- ${line}`),
  ].join('\n');
}

export function guideButtons(activeTopic = 'daily') {
  return [
    {
      type: ComponentType.ACTION_ROW,
      components: Object.entries(guideTopics).map(([key, topic]) => ({
        type: ComponentType.BUTTON,
        custom_id: `guide:${key}`,
        label: topic.title.replace('帮会', ''),
        style: key === activeTopic ? ButtonStyle.PRIMARY : ButtonStyle.SECONDARY,
      })),
    },
  ];
}

export function supportSubmittedMessage(ticket, supportPostingEnabled) {
  const destination = supportPostingEnabled
    ? '已投递到管理组支援频道。'
    : '支援频道投递尚未配置，所以这次只确认了提交流程。';

  return [
    `**支援请求 ${ticket.id} 已收到**`,
    `分类：${ticket.categoryLabel}`,
    `紧急度：${ticket.urgencyLabel}`,
    destination,
  ].join('\n');
}

export function supportNeedsDetailsMessage(category, urgency) {
  return ephemeral(
    [
      '**支援请求草稿**',
      `分类：${getCategoryLabel(category)}`,
      `紧急度：${getUrgencyLabel(urgency)}`,
      '请补充细节，方便管理组不用反复追问基础信息。',
    ].join('\n'),
    [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            custom_id: `support_details:${category}:${urgency}`,
            label: '补充细节',
            style: ButtonStyle.PRIMARY,
          },
        ],
      },
    ],
  );
}

export function supportDetailsModal(category, urgency) {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `support_submit:${category}:${urgency}`,
      title: '燕云十六声帮会支援',
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.TEXT_INPUT,
              custom_id: 'details',
              label: '发生了什么？',
              style: TextInputStyle.PARAGRAPH,
              min_length: 10,
              max_length: 1200,
              required: true,
              placeholder: '请包含玩法、频道、成员名、截图链接，以及你希望管理组怎么处理。',
            },
          ],
        },
      ],
    },
  };
}

export function useCasesMessage() {
  const preview = futureUseCases
    .slice(0, 8)
    .map((item, index) => `${index + 1}. **${item.title}** - ${item.value}`);

  return [
    '**燕云十六声 Discord 应用功能方向**',
    ...preview,
    '',
    '更完整的功能清单在 `docs/use-cases.md`。',
  ].join('\n');
}

export function eventDraftMessage({ activity, startsAt, note }) {
  const labels = {
    teaching: '教学车',
    progression: '开荒队',
    pvp: 'PVP 练习',
    exploration: '探索队',
    social: '休闲社交',
  };

  return [
    `**${labels[activity] ?? '帮会活动'}**`,
    `时间：${startsAt || '待定'}`,
    '需要确认：负责人、替补负责人、语音频道、报名帖子、复盘负责人。',
    note ? `备注：${note}` : undefined,
    '',
    '管理组检查项：时区、预计时长、入队要求、迟到/替补规则。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function newsMessage(items) {
  if (!items.length) {
    return '暂时没有解析到官方新闻。可以检查 `WWM_OFFICIAL_NEWS_URL` 或稍后重试。';
  }

  return [
    '**官方新闻 / 更新监控**',
    ...items.map((item, index) => (
      `${index + 1}. **${item.date} ${item.type}**\n${trimText(item.title, 180)}\n${item.url}`
    )),
  ].join('\n\n');
}

export function steamStatusMessage(playerCount) {
  const count = Number.isFinite(playerCount) ? playerCount.toLocaleString('zh-CN') : '暂不可用';
  return [
    '**Steam 状态**',
    `当前 Steam 在线人数：${count}`,
    '说明：这只覆盖 Steam 侧数据，不包含官方启动器、移动端或 PlayStation 玩家。',
  ].join('\n');
}

export function steamAchievementsMessage(achievements) {
  if (!achievements.length) {
    return 'Steam 暂时没有返回成就百分比数据。';
  }

  return [
    '**Steam 全局成就完成率（前几项）**',
    ...achievements.map((achievement, index) => (
      `${index + 1}. ${achievement.name} - ${achievement.percent.toFixed(1)}%`
    )),
  ].join('\n');
}

export function wikiSearchMessage(query, results) {
  const searchResult = Array.isArray(results)
    ? { sourceLabel: 'Fandom 百科', normalizedQuery: query, results, fallbackLinks: [] }
    : results;
  const normalizedNote = searchResult.normalizedQuery && searchResult.normalizedQuery !== query
    ? `已按简体关键词「${searchResult.normalizedQuery}」搜索。`
    : '';
  const warningNote = searchResult.warning ? `部分来源暂不可用：${searchResult.warning}` : '';
  const fallbackLines = (searchResult.fallbackLinks || []).map((link, index) => (
    `${index + 1}. ${link.title}\n${link.url}`
  ));

  if (!searchResult.results.length) {
    return [
      `没有在 ${searchResult.sourceLabel} 找到「${query}」的结果。`,
      normalizedNote,
      warningNote,
      fallbackLines.length ? '可以手动打开这些中文资料入口：' : undefined,
      ...fallbackLines,
    ].filter(Boolean).join('\n\n');
  }

  return [
    `**百科搜索：${query}**`,
    `来源：${searchResult.sourceLabel}`,
    normalizedNote,
    warningNote,
    ...searchResult.results.map((result, index) => (
      `${index + 1}. ${result.sourceLabel ? `【${result.sourceLabel}】 ` : ''}**${result.title}**\n${trimText(result.description, 150)}\n${result.url}`
    )),
  ].filter(Boolean).join('\n\n');
}

export function memeSearchMessage(query, searchResult) {
  if (!searchResult.results.length) {
    return [
      `没有找到「${query}」相关的表情包候选。`,
      `可以手动打开来源继续找：${searchResult.sourceUrl}`,
    ].join('\n');
  }

  return '';
}

export function memeSearchEmbeds(searchResult) {
  return searchResult.results.slice(0, 4).map((result) => ({
    image: { url: result.imageUrl },
  }));
}

export function memePostButtons(selections) {
  const buttons = selections.slice(0, 4).map((selection) => ({
    type: ComponentType.BUTTON,
    custom_id: `meme_post:${selection.id}`,
    label: `${selection.index + 1}`,
    style: ButtonStyle.PRIMARY,
  }));

  return buttons.length
    ? [{ type: ComponentType.ACTION_ROW, components: buttons }]
    : [];
}

export function memeCandidateEmbed(candidate) {
  return {
    image: { url: candidate.imageUrl },
  };
}

export function translateMessage({ text, result }) {
  const sourceLabel = result.source === 'zh' ? '中文' : '英文';
  const targetLabel = result.target === 'zh' ? '中文' : '英文';

  return [
    `**翻译结果（${sourceLabel} → ${targetLabel}）**`,
    `原文：${trimText(text, 900)}`,
    `译文：${trimText(result.translatedText, 1200)}`,
  ].join('\n');
}

export function profileSavedMessage(profile) {
  return [
    '**成员档案已保存**',
    `角色名：${profile.characterName}`,
    `定位：${getRoleLabel(profile.role)}`,
    profile.weapons ? `武器：${profile.weapons}` : undefined,
    profile.sect ? `门派：${profile.sect}` : undefined,
  ].filter(Boolean).join('\n');
}

export function profileViewMessage(userId, profile) {
  if (!profile) {
    return `暂时没有 <@${userId}> 的档案。可以使用 \`/profile set\` 创建。`;
  }

  return [
    `**<@${userId}> 的成员档案**`,
    `角色名：${profile.characterName}`,
    `定位：${getRoleLabel(profile.role)}`,
    profile.weapons ? `武器：${profile.weapons}` : undefined,
    profile.innerWays ? `心法：${profile.innerWays}` : undefined,
    profile.sect ? `门派：${profile.sect}` : undefined,
    profile.server ? `服务器：${profile.server}` : undefined,
    profile.timezone ? `时区：${profile.timezone}` : undefined,
    profile.updatedAt ? `更新：${new Date(profile.updatedAt).toLocaleString('zh-CN')}` : undefined,
  ].filter(Boolean).join('\n');
}

export function lfgCreatedMessage(entry) {
  return [
    `**组队已创建：${entry.id}**`,
    `玩法：${getLfgActivityLabel(entry.activity)}`,
    `时间：${entry.startsAt}`,
    `发起人：<@${entry.ownerId}>`,
    entry.note ? `备注：${entry.note}` : undefined,
  ].filter(Boolean).join('\n');
}

export function lfgButtons(entry) {
  return [
    {
      type: ComponentType.ACTION_ROW,
      components: [
        {
          type: ComponentType.BUTTON,
          custom_id: `lfg_join:${entry.id}`,
          label: '加入队伍',
          style: ButtonStyle.SUCCESS,
        },
      ],
    },
  ];
}

export function lfgListMessage(entries) {
  if (!entries.length) {
    return '当前没有开放的组队。可以使用 `/lfg create` 发起一个。';
  }

  return [
    '**开放组队列表**',
    ...entries.map((entry, index) => (
      `${index + 1}. **${entry.id}** | ${getLfgActivityLabel(entry.activity)} | ${entry.startsAt}\n发起人：<@${entry.ownerId}> | 已报名：${entry.participants.length}`
    )),
  ].join('\n\n');
}

export function lfgJoinedMessage(entry, userId) {
  return [
    `已加入 **${entry.id}**。`,
    `玩法：${getLfgActivityLabel(entry.activity)}`,
    `时间：${entry.startsAt}`,
    entry.note ? `备注：${entry.note}` : undefined,
    `当前报名：${entry.participants.map((id) => `<@${id}>`).join(' ')}`,
    userId === entry.ownerId ? '你是发起人。' : undefined,
  ].filter(Boolean).join('\n');
}

export function buildSavedMessage(build) {
  return [
    `**配装已保存：${build.name}**`,
    `武器：${build.weapon}`,
    `定位：${getBuildRoleLabel(build.role)}`,
    build.innerWays ? `心法：${build.innerWays}` : undefined,
    build.notes ? `备注：${build.notes}` : undefined,
  ].filter(Boolean).join('\n');
}

export function buildSearchMessage(query, builds) {
  if (!builds.length) {
    return query ? `没有找到匹配「${query}」的配装。` : '当前还没有配装记录。';
  }

  return [
    query ? `**配装搜索：${query}**` : '**最新配装**',
    ...builds.map((build, index) => (
      `${index + 1}. **${build.name}** | ${build.weapon} | ${getBuildRoleLabel(build.role)} | 赞：${build.votes?.length ?? 0}\n作者：<@${build.authorId}> | ID：${build.id}\n${trimText(build.notes, 160)}`
    )),
  ].join('\n\n');
}

export function buildVoteButtons(builds) {
  const buttons = builds.slice(0, 5).map((build, index) => ({
    type: ComponentType.BUTTON,
    custom_id: `build_vote:${build.id}`,
    label: `赞 ${index + 1}`,
    style: ButtonStyle.SECONDARY,
  }));

  return buttons.length
    ? [{ type: ComponentType.ACTION_ROW, components: buttons }]
    : [];
}

export function buildVotedMessage(build) {
  return `已给 **${build.name}** 点赞。当前赞数：${build.votes?.length ?? 0}`;
}

export function autoReactionAccessDeniedMessage(adminRoleId) {
  if (!adminRoleId) {
    return '自动反应编辑角色尚未配置，请先设置 `MESSAGE_REACTION_ADMIN_ROLE_ID`。';
  }

  return `只有 <@&${adminRoleId}> 可以修改自动反应设置。`;
}

export function autoReactionRulesMessage(rules = []) {
  if (!rules.length) {
    return '当前没有启用自动消息反应规则。';
  }

  return [
    '**当前自动消息反应规则**',
    ...rules.map((rule, index) => [
      `${index + 1}. 用户：<@${rule.userId}>`,
      `表情：${rule.emojiName ?? rule.emoji?.split(':')[0] ?? rule.emoji}`,
      rule.channelIds?.length ? `频道：${rule.channelIds.map((id) => `<#${id}>`).join('、')}` : '频道：全部可见频道',
      rule.updatedBy ? `最后编辑：<@${rule.updatedBy}>` : undefined,
    ].filter(Boolean).join('\n')),
  ].join('\n\n');
}

export function autoReactionRuleSavedMessage(rule) {
  return [
    '**自动消息反应已更新**',
    `目标用户：<@${rule.userId}>`,
    `自动表情：${rule.emojiName ?? rule.emoji?.split(':')[0] ?? rule.emoji}`,
    rule.channelIds?.length ? `限定频道：${rule.channelIds.map((id) => `<#${id}>`).join('、')}` : '限定频道：全部可见频道',
    '设置后无需重新注册命令，下一条匹配消息会自动生效。',
  ].join('\n');
}

export function autoReactionRuleClearedMessage(rule) {
  return [
    '**自动消息反应已清除**',
    `目标用户：<@${rule.userId}>`,
    `自动表情：${rule.emojiName ?? rule.emoji?.split(':')[0] ?? rule.emoji}`,
    rule.channelIds?.length ? `限定频道：${rule.channelIds.map((id) => `<#${id}>`).join('、')}` : '限定频道：全部可见频道',
  ].join('\n');
}

export function autoReactionRuleNotFoundMessage() {
  return '没有找到匹配的自动消息反应规则；请用 `/auto-reaction view` 查看当前规则后再清除。';
}

export function resourcesMessage() {
  return [
    '**安全数据来源与集成方式**',
    '1. 官方网站：新闻、补丁、封禁公告和活动信息。',
    '2. Steam：在线人数、全局成就比例、公开用户成就。',
    '3. 游民星空攻略：中文攻略搜索和跳转。',
    '4. GameKee 中文 Wiki：中文词条搜索和攻略跳转。',
    '5. Fandom 百科：英文页面搜索和攻略跳转。',
    '6. 斗图啦：表情包搜索候选和图片跳转。',
    '7. wherewindsmeet.gg：交互地图、武学、心法等社区资料；建议先取得授权或只做链接跳转。',
    '8. Discord Gateway：指定用户消息的自动表情反应。',
    '9. Discord 服务器数据：成员档案、组队、配装、活动与管理流程。',
    '',
    '不建议接入：逆向客户端、抓取认证流量、读内存、宏、脚本、外挂、自动操作或任何可能违反服务条款的方式。',
  ].join('\n');
}

export function presenceInfoMessage() {
  return [
    '**在线状态跟踪说明**',
    '这个功能需要 Discord 网关 bot 和 `GUILD_PRESENCES` 特权意图。',
    '可实现：检测成员是否展示正在玩燕云十六声、生成在线成员列表、提示发起组队。',
    '限制：取决于成员隐私设置、Discord 审核和网关连接；当前仅使用 webhook 的服务不会自动收到在线状态事件。',
    '建议下一步：新增独立网关工作进程，与当前交互服务共享同一个数据存储。',
  ].join('\n');
}

export function commandErrorMessage(error) {
  return [
    '**操作失败**',
    error.message || '发生未知错误。',
  ].join('\n');
}
