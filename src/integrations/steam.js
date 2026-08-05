export const WWM_STEAM_APP_ID = '3564740';

export async function fetchSteamCurrentPlayers(appId = WWM_STEAM_APP_ID) {
  const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Steam 在线人数请求失败：${response.status}`);
  }

  const data = await response.json();
  return data.response?.player_count ?? null;
}

export async function fetchSteamAchievementPercentages(appId = WWM_STEAM_APP_ID, limit = 8) {
  const url = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}&format=json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Steam 成就请求失败：${response.status}`);
  }

  const data = await response.json();
  return (data.achievementpercentages?.achievements ?? [])
    .map((achievement) => ({
      name: achievement.name,
      percent: Number(achievement.percent),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, limit);
}
