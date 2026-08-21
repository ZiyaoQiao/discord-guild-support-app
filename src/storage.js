import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(projectRoot, '.data');

const emptyStore = {
  profiles: {},
  lfg: {},
  builds: {},
  messageReactionRules: {},
  schedules: {},
};

function currentStorePath() {
  const currentDataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : dataDir;
  return resolve(currentDataDir, 'guild-support-store.json');
}

function guildKey(guildId) {
  return guildId || 'dm';
}

function createId(prefix, now = new Date()) {
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = now.getTime().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

export async function readStore() {
  try {
    const raw = await readFile(currentStorePath(), 'utf8');
    return { ...emptyStore, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return structuredClone(emptyStore);
    }
    throw error;
  }
}

export async function writeStore(store) {
  const currentPath = currentStorePath();
  await mkdir(dirname(currentPath), { recursive: true });
  await writeFile(currentPath, `${JSON.stringify(store, null, 2)}\n`);
}

export async function saveScheduleMessage(guildId, schedule) {
  const store = await readStore();
  const key = guildKey(guildId);
  store.schedules[key] ??= {};
  store.schedules[key][schedule.messageId] = {
    ...schedule,
    createdAt: new Date().toISOString(),
  };
  const entries = Object.entries(store.schedules[key]);
  if (entries.length > 200) {
    store.schedules[key] = Object.fromEntries(entries.slice(-200));
  }
  await writeStore(store);
  return store.schedules[key][schedule.messageId];
}

export async function getScheduleMessage(guildId, messageId) {
  const store = await readStore();
  return store.schedules[guildKey(guildId)]?.[messageId] ?? null;
}

export async function listScheduleMessages() {
  const store = await readStore();
  return Object.entries(store.schedules).flatMap(([guildId, schedules]) => (
    Object.entries(schedules).map(([messageId, schedule]) => ({
      ...schedule,
      guildId,
      messageId,
    }))
  ));
}

export async function updateScheduleMessage(guildId, messageId, updates) {
  const store = await readStore();
  const key = guildKey(guildId);
  const schedule = store.schedules[key]?.[messageId];
  if (!schedule) return null;
  Object.assign(schedule, updates);
  await writeStore(store);
  return schedule;
}

export async function removeScheduleMessage(guildId, messageId) {
  const store = await readStore();
  const key = guildKey(guildId);
  const entry = store.schedules[key]?.[messageId];
  if (!entry) return null;
  delete store.schedules[key][messageId];
  if (Object.keys(store.schedules[key]).length === 0) delete store.schedules[key];
  await writeStore(store);
  return entry;
}

export async function saveProfile(guildId, userId, profile) {
  const store = await readStore();
  const key = guildKey(guildId);
  store.profiles[key] ??= {};
  store.profiles[key][userId] = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store.profiles[key][userId];
}

export async function getProfile(guildId, userId) {
  const store = await readStore();
  return store.profiles[guildKey(guildId)]?.[userId] ?? null;
}

export async function createLfg(guildId, userId, lfg) {
  const store = await readStore();
  const key = guildKey(guildId);
  store.lfg[key] ??= [];
  const entry = {
    id: createId('LFG'),
    ownerId: userId,
    participants: [userId],
    createdAt: new Date().toISOString(),
    status: 'open',
    ...lfg,
  };
  store.lfg[key].unshift(entry);
  store.lfg[key] = store.lfg[key].slice(0, 50);
  await writeStore(store);
  return entry;
}

export async function listOpenLfg(guildId, limit = 8) {
  const store = await readStore();
  return (store.lfg[guildKey(guildId)] ?? [])
    .filter((entry) => entry.status === 'open')
    .slice(0, limit);
}

export async function joinLfg(guildId, lfgId, userId) {
  const store = await readStore();
  const entries = store.lfg[guildKey(guildId)] ?? [];
  const entry = entries.find((item) => item.id === lfgId);
  if (!entry) {
    return null;
  }
  entry.participants ??= [];
  if (!entry.participants.includes(userId)) {
    entry.participants.push(userId);
  }
  await writeStore(store);
  return entry;
}

export async function saveBuild(guildId, userId, build) {
  const store = await readStore();
  const key = guildKey(guildId);
  store.builds[key] ??= [];
  const entry = {
    id: createId('BUILD'),
    authorId: userId,
    createdAt: new Date().toISOString(),
    votes: [],
    ...build,
  };
  store.builds[key].unshift(entry);
  store.builds[key] = store.builds[key].slice(0, 100);
  await writeStore(store);
  return entry;
}

export async function searchBuilds(guildId, query = '', limit = 8) {
  const store = await readStore();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const builds = store.builds[guildKey(guildId)] ?? [];

  if (terms.length === 0) {
    return builds.slice(0, limit);
  }

  return builds
    .filter((build) => {
      const haystack = [
        build.name,
        build.weapon,
        build.role,
        build.innerWays,
        build.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
}

export async function voteBuild(guildId, buildId, userId) {
  const store = await readStore();
  const builds = store.builds[guildKey(guildId)] ?? [];
  const build = builds.find((item) => item.id === buildId);
  if (!build) {
    return null;
  }
  build.votes ??= [];
  if (!build.votes.includes(userId)) {
    build.votes.push(userId);
  }
  await writeStore(store);
  return build;
}

export async function getMessageReactionRules(guildId) {
  const store = await readStore();
  return store.messageReactionRules[guildKey(guildId)] ?? [];
}

export async function getAllMessageReactionRules() {
  const store = await readStore();
  return Object.values(store.messageReactionRules)
    .flat()
    .filter(Boolean);
}

export async function saveMessageReactionRule(guildId, rule) {
  const store = await readStore();
  const key = guildKey(guildId);
  store.messageReactionRules[key] = [{
    ...rule,
    guildId: guildId || '',
    updatedAt: new Date().toISOString(),
  }];
  await writeStore(store);
  return store.messageReactionRules[key][0];
}

export async function addMessageReactionRule(guildId, rule) {
  const store = await readStore();
  const key = guildKey(guildId);
  store.messageReactionRules[key] ??= [];
  const channelKey = (rule.channelIds ?? []).join(',');
  const existing = store.messageReactionRules[key].find((item) => (
    item.userId === rule.userId
    && item.emoji === rule.emoji
    && (item.channelIds ?? []).join(',') === channelKey
  ));

  if (existing) {
    Object.assign(existing, {
      ...rule,
      guildId: guildId || '',
      updatedAt: new Date().toISOString(),
    });
    await writeStore(store);
    return existing;
  }

  const entry = {
    ...rule,
    guildId: guildId || '',
    updatedAt: new Date().toISOString(),
  };
  store.messageReactionRules[key].push(entry);
  await writeStore(store);
  return entry;
}

export async function removeMessageReactionRule(guildId, rule) {
  const store = await readStore();
  const key = guildKey(guildId);
  const rules = store.messageReactionRules[key] ?? [];
  const channelKey = (rule.channelIds ?? []).join(',');
  const index = rules.findIndex((item) => (
    item.userId === rule.userId
    && (
      item.emoji === rule.emoji
      || (
        rule.emojiName
        && (item.emojiName === rule.emojiName || item.emoji?.split(':')[0] === rule.emojiName)
      )
    )
    && (item.channelIds ?? []).join(',') === channelKey
  ));

  if (index === -1) {
    return null;
  }

  const [removed] = rules.splice(index, 1);
  if (rules.length) {
    store.messageReactionRules[key] = rules;
  } else {
    delete store.messageReactionRules[key];
  }

  await writeStore(store);
  return removed;
}

export async function clearMessageReactionRules(guildId) {
  const store = await readStore();
  const key = guildKey(guildId);
  const removed = store.messageReactionRules[key] ?? [];
  delete store.messageReactionRules[key];
  await writeStore(store);
  return removed;
}
