export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
};

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
};

export const MessageFlags = {
  EPHEMERAL: 1 << 6,
};

export const CommandType = {
  CHAT_INPUT: 1,
};

export const CommandOptionType = {
  SUB_COMMAND: 1,
  STRING: 3,
  BOOLEAN: 5,
};

export const ComponentType = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
};

export const ButtonStyle = {
  PRIMARY: 1,
  SECONDARY: 2,
  SUCCESS: 3,
  DANGER: 4,
  LINK: 5,
};

export const TextInputStyle = {
  SHORT: 1,
  PARAGRAPH: 2,
};

export const InstallationContext = {
  GUILD_INSTALL: 0,
};

export const InteractionContext = {
  GUILD: 0,
};
