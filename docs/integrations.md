# 燕云十六声集成说明

## 已实现

### 官方新闻

`/news` 会读取 `WWM_OFFICIAL_NEWS_URL`，默认是繁体中文 HMT 官方新闻页，并解析日期、类型和标题摘要。

用途：

- 自动转发补丁说明。
- 提醒活动、封禁公告、交易风险公告。
- 每周摘要里引用最近更新。

注意：

- 官方站点没有稳定公开 API；当前实现是轻量 HTML 解析。
- 如果官方站点结构变化，需要调整 `src/integrations/official-news.js`。

### Steam

`/steam status` 使用 Steam 当前在线人数接口。

`/steam achievements` 使用 Steam 全局成就完成率接口。

限制：

- 只代表 Steam 平台。
- 不包含官方启动器、移动端或 PlayStation 玩家。
- 用户级 Steam 数据会受隐私设置影响；当前版本只做全局数据。

### 百科搜索

`/wiki query:<关键词>` 会按关键词语言选择资料源：

- 中文关键词：优先搜索游民星空攻略搜索页，再搜索 GameKee 燕云十六声 Wiki 的公开网页接口 `/v1/content/searchArticle`，请求头使用 `game-alias: yysls` 限定到燕云十六声专区。
- 英文关键词：使用 Where Winds Meet Fandom Wiki 的 MediaWiki `opensearch` 接口。

用途：

- 快速查攻略页。
- 给成员一个链接入口，而不是复制整页内容。

注意：

- 游民星空搜索和 GameKee 接口都属于网站前端正在使用的公开资料入口，适合轻量只读查询；如果站点改版，需要调整 `src/integrations/wiki.js`。
- 游民星空更适合攻略类问题，例如奇术获取、心法、武学、装备和新手玩法；GameKee 更适合直接词条跳转。
- Fandom 当前主要是英文资料，实测中文关键词如“奇术”“武学”“心法”“凌云踏”没有结果。
- Bilibili 燕云十六声WIKI 有中文入口，但没有找到稳定的游戏内词条搜索 API；当前作为手动 fallback 链接。
- 搜索结果应以跳转和摘要为主。
- 不建议批量搬运 Wiki 内容。

### 表情包搜索

`/meme query:<描述>` 使用斗图啦搜索页返回几个表情包候选，并在 Discord 中只展示候选图片和编号发送按钮。应用会从同一关键词的前若干候选中随机抽取展示结果，重复搜索时可能看到不同图片。

用途：

- 帮会聊天时快速找“猫猫无语”“笑死”“加班”等表情候选。
- 先私密预览多个候选，再点击按钮把选中的一张作为新的频道消息发送到当前频道。
- 管理组准备公告或活动提醒时找轻量氛围图。

注意：

- 当前实现只做公开页面轻量搜索，不下载、不缓存、不搬运图片。
- 随机展示只在原始关键词的结果池里进行，不会自动改写关键词。
- 点击编号后的正式发送不会引用候选预览消息，只发送图片本身。
- 候选按钮使用短期内存 token；服务重启或超过一段时间后，需要重新搜索。
- 表情包来源站内容可能随时变更，公开发送前应确认适合当前频道。
- 如果未来要做高稳定性或商业用途，可以考虑申请正式表情 API，例如闪萌这类有搜索接口的服务。

### 自动消息反应

配置 `MESSAGE_REACTION_USER_ID` 和 `MESSAGE_REACTION_EMOJI`，或由有权限的成员使用 `/auto-reaction set` 后，服务会连接 Discord Gateway，监听帮会消息创建事件。当目标用户发送消息时，bot 会给那条消息添加指定表情反应。

用途：

- 给会长、指挥或管理组成员的消息自动加固定标记。
- 给特定成员的发言自动加轻量互动表情。
- 在活动频道中突出某个用户的通知消息。

配置示例：

```sh
MESSAGE_REACTION_USER_ID=123456789012345678
MESSAGE_REACTION_EMOJI=🔥
MESSAGE_REACTION_CHANNEL_IDS=111111111111111111,222222222222222222
```

多个规则可以使用 JSON：

```sh
MESSAGE_REACTION_RULES='[{"userId":"123456789012345678","emoji":"👍"},{"userId":"234567890123456789","emoji":"<:wwm:123456789012345678>"}]'
```

Discord 内编辑：

```text
/auto-reaction set user_id:1017955151765573723 emoji_name:lubian
/auto-reaction add user_id:1017955151765573723 emoji_name:13421142546174839
/auto-reaction view
/auto-reaction clear user_id:1017955151765573723 emoji_name:lubian
```

注意：

- bot 需要目标频道的 `View Channel`、`Read Message History` 和 `Add Reactions` 权限。
- 当前实现只根据用户 ID、频道 ID 和服务器 ID 判断，不读取消息正文。
- 不需要开启 `MESSAGE_CONTENT` 特权 intent。
- `/auto-reaction set`、`/auto-reaction add` 和 `/auto-reaction clear` 需要成员拥有 `MESSAGE_REACTION_ADMIN_ROLE_ID` 对应身份组。
- Discord 命令里只需要填写 `emoji_name`；应用会查询服务器自定义表情并解析成 Discord API 需要的 `name:id`。
- `/auto-reaction set` 会替换当前规则；`/auto-reaction add` 会追加一条规则。同一用户可以触发多个表情反应。
- `/auto-reaction clear` 只清除与 `user_id`、`emoji_name` 和可选 `channel_ids` 完全匹配的一条规则，不会清空全部规则。
- 如果配置了 `GUILD_ID`，默认只会在该服务器内生效；也可以在 `MESSAGE_REACTION_RULES` 里为单条规则设置 `guildId`。

### 中英文翻译

Discord `/translate`、HTTP `POST /translate` 和 `POST /api/translate` 使用 `TRANSLATE_API_URL` 指向的兼容 LibreTranslate 服务。

HTTP 接口示例：

```http
POST /translate
Content-Type: application/json

{
  "text": "Need help with a build",
  "target": "zh"
}
```

用途：

- 帮会频道里快速处理中英文沟通。
- 管理组把英文补丁摘要转成中文草稿。
- 国际成员提交支援请求时降低沟通成本。

注意：

- 当前实现不会内置第三方翻译供应商；需要自行配置 `TRANSLATE_API_URL`。
- 支持 `zh`、`zh-cn`、`中文`、`en`、`english`、`英文` 这类输入。
- 同语言请求会直接返回原文，不调用外部服务。

### 成员档案、组队、配装

这些是本地数据，不依赖游戏官方接口：

- `/profile set/view`
- `/lfg create/list`
- `/build share/search`

早期使用 `.data/guild-support-store.json` 足够；正式运行建议迁移数据库。

## 已预留但未启用

### Discord Presence 跟踪

`/presence-info` 解释了接入方式。真正实现需要：

- 使用 Discord Gateway bot。
- 在 Developer Portal 开启或申请 `GUILD_PRESENCES` 特权 intent。
- 监听 presence update events。
- 与当前 interactions 服务共享数据库。

可做功能：

- 看到谁正在展示“正在玩 Where Winds Meet”。
- 自动生成在线帮会成员列表。
- 成员开始游戏时提示是否发起组队。

限制：

- 成员可能关闭活动展示。
- 大型 bot 可能需要 Discord 审核。
- presence 数据不能替代游戏内真实在线状态。

## 不建议做的集成

不要做以下方向：

- 逆向客户端协议。
- 读取游戏进程、内存或本地缓存。
- 抓取认证后的游戏 API。
- 宏、脚本、自动战斗、自动采集、自动交易。
- 模拟玩家输入。
- 与 RMT、黑市交易、账号共享相关的自动化。

这些方向有明显封号、条款和社区信任风险，也不适合帮会工具。
