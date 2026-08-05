export const supportCategories = [
  {
    name: 'Bug 或崩溃',
    value: 'bug',
    description: '客户端问题、任务卡住、界面异常或闪退',
  },
  {
    name: '配装求助',
    value: 'build',
    description: '武器、心法、奇术、属性或输出手法问题',
  },
  {
    name: '活动协助',
    value: 'event',
    description: '帮会活动时间、报名、身份分工或出勤',
  },
  {
    name: '成员纠纷',
    value: 'conflict',
    description: '举报行为问题，或请求管理组私下协调',
  },
  {
    name: '招募入会',
    value: 'recruiting',
    description: '邀请、申请、试用期或新人引导问题',
  },
  {
    name: '其他',
    value: 'other',
    description: '不属于以上分类的事项',
  },
];

export const urgencyChoices = [
  { name: '普通', value: 'normal' },
  { name: '较急', value: 'high' },
  { name: '影响游玩', value: 'blocking' },
];

export const guideTopics = {
  daily: {
    title: '每日帮会清单',
    lines: [
      '先查看公告与置顶活动时间。',
      '长时间单排前，优先在组队频道问有没有同伴。',
      '遇到卡点时说明地区、任务或玩法名称，并附截图链接。',
      '发现有用信息时，发到对应攻略频道，方便后续检索。',
    ],
  },
  build: {
    title: '配装诊所',
    lines: [
      '说明你的武器组合、定位目标、当前痛点和主要玩法。',
      '每套配装使用一个帖子，方便沉淀和搜索。',
      '补充截图或具体属性后再艾特导师。',
      'PvE、PvP、休闲探索的目标要分开讨论。',
    ],
  },
  events: {
    title: '活动规划',
    lines: [
      '活动草案需要包含玩法、时间、预计时长和语音频道。',
      '列出需要的职责：指挥、带队、记录、替补负责人。',
      '用报名反应或帖子统计报名。',
      '活动后补一条复盘：掉落、卡点和下次改进。',
    ],
  },
  conduct: {
    title: '帮会规范',
    lines: [
      '纠纷和举报走工单，不在公共频道争吵。',
      '举报时附消息链接、截图、时间线和期望处理结果。',
      '管理组应私下确认收到，并把敏感细节移出公开频道。',
      '重复问题要保留文字记录，确保处理标准一致。',
    ],
  },
};

export const eventActivityChoices = [
  { name: '教学车', value: 'teaching' },
  { name: '开荒队', value: 'progression' },
  { name: 'PVP 练习', value: 'pvp' },
  { name: '探索队', value: 'exploration' },
  { name: '休闲社交', value: 'social' },
];

export const roleChoices = [
  { name: '输出', value: 'dps' },
  { name: '治疗', value: 'healer' },
  { name: '坦克', value: 'tank' },
  { name: '指挥', value: 'shotcaller' },
  { name: '导师', value: 'mentor' },
  { name: '休闲', value: 'casual' },
];

export const buildRoleChoices = [
  { name: 'PVE 输出', value: 'pve-dps' },
  { name: 'PVE 治疗', value: 'pve-healer' },
  { name: 'PVE 坦克', value: 'pve-tank' },
  { name: 'PVP 爆发', value: 'pvp-burst' },
  { name: 'PVP 控制', value: 'pvp-control' },
  { name: '探索/日常', value: 'exploration' },
];

export const lfgActivityChoices = [
  { name: '英雄试炼', value: 'hero-trial' },
  { name: '剑试', value: 'sword-trial' },
  { name: '世界首领', value: 'world-boss' },
  { name: '帮会战', value: 'guild-war' },
  { name: '竞技场', value: 'arena' },
  { name: '探索', value: 'exploration' },
  { name: '其他', value: 'other' },
];

export const futureUseCases = [
  {
    title: '引导式支援队列',
    value: '把 `/support` 做成私密工单流程，向管理频道输出结构化报告。',
  },
  {
    title: '配装诊所',
    value: '收集武器、心法、奇术、属性与玩法目标，并路由给导师。',
  },
  {
    title: '活动规划器',
    value: '创建活动、报名按钮、职责名额、提醒和复盘提示。',
  },
  {
    title: '新人引导',
    value: '为新人提供规则、时区、玩法身份、自我介绍和首场活动清单。',
  },
  {
    title: '知识库搜索',
    value: '从帮会整理的攻略、百科和置顶资料里回答常见问题。',
  },
  {
    title: '管理组处理台',
    value: '汇总纠纷报告、分派负责人，并把处理记录留在非公开频道。',
  },
  {
    title: '名册与身份同步',
    value: '让成员自助填写 PvP、PvE、导师、指挥、工匠、时区等身份。',
  },
  {
    title: '每周摘要',
    value: '汇总活动、开放工单、新攻略、招募事项和待办任务。',
  },
];

export function getCategoryLabel(value) {
  return supportCategories.find((category) => category.value === value)?.name ?? '其他';
}

export function getUrgencyLabel(value) {
  return urgencyChoices.find((urgency) => urgency.value === value)?.name ?? '普通';
}

export function getRoleLabel(value) {
  return roleChoices.find((role) => role.value === value)?.name ?? '未填写';
}

export function getLfgActivityLabel(value) {
  return lfgActivityChoices.find((activity) => activity.value === value)?.name ?? '其他';
}

export function getBuildRoleLabel(value) {
  return buildRoleChoices.find((role) => role.value === value)?.name ?? value;
}
