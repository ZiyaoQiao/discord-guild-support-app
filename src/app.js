import 'dotenv/config';
import express from 'express';
import { verifyKeyMiddleware } from 'discord-interactions';
import { handleInteraction } from './interactions.js';
import { translateText } from './integrations/translate.js';
import { startMessageReactionGatewayFromEnv } from './gateway-reactions.js';
import { startScheduleReminderWorker } from './schedule-reminders.js';

const app = express();
const port = process.env.PORT || 3000;
const interactionVerifier = process.env.PUBLIC_KEY
  ? verifyKeyMiddleware(process.env.PUBLIC_KEY)
  : (_req, res) => res.status(503).json({
    error: 'discord_public_key_missing',
    message: 'Discord PUBLIC_KEY 未配置，无法校验 interactions 请求。',
  });

if (!process.env.PUBLIC_KEY) {
  console.warn('PUBLIC_KEY is not set; /interactions will return 503 until Discord signing is configured.');
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

async function handleTranslateRequest(req, res) {
  try {
    const result = await translateText({
      text: req.body?.text,
      target: req.body?.target,
      source: req.body?.source,
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'translate_failed' });
  }
}

app.post(['/translate', '/api/translate'], express.json({ limit: '32kb' }), handleTranslateRequest);

app.post('/interactions', interactionVerifier, async (req, res) => {
  try {
    const response = await handleInteraction(req.body);
    return res.send(response);
  } catch (error) {
    console.error('Interaction failed', error);
    return res.status(500).json({ error: 'interaction_failed' });
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
  startMessageReactionGatewayFromEnv();
  startScheduleReminderWorker();
});
