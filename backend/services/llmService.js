const axios = require('axios');
require('dotenv').config();

function resolveChatConfig() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment =
    process.env.AZURE_OPENAI_DEPLOYMENT ||
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

  if (!endpoint || !apiKey || !deployment) {
    return null;
  }

  return { endpoint, apiKey, deployment, apiVersion };
}

function hasChatConfig() {
  return Boolean(resolveChatConfig());
}

async function getRecommendation(observation, sopText, correlationId = 'none', timeoutMs = 3000) {
  const config = resolveChatConfig();
  if (!config) {
    console.warn(`[${correlationId}] Azure OpenAI chat config missing. Using fallback.`);
    return null;
  }

  const { endpoint, apiKey, deployment, apiVersion } = config;
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000;

  const prompt = `
You are a field operations advisor.

Observation:
${observation}

SOP:
${sopText}

Return ONLY 3-5 bullet points.

STRICT RULES:
- Only use exact info from SOP
- Do not invent anything
- Keep bullets short
`;

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), safeTimeoutMs);

  try {
    const response = await axios.post(
      url,
      {
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 200
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }
    );

    return response.data.choices[0].message.content;
  } catch (err) {
    console.error(`[${correlationId}] LLM failed -> fallback will be used`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { getRecommendation, hasChatConfig };
