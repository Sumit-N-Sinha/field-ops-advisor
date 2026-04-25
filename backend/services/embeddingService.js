const axios = require('axios');
require('dotenv').config();

function resolveEmbeddingConfig() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const embeddingDeployment =
    process.env.AZURE_EMBEDDING_DEPLOYMENT ||
    process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

  if (!endpoint || !apiKey || !embeddingDeployment) {
    return null;
  }

  return { endpoint, apiKey, embeddingDeployment, apiVersion };
}

function hasEmbeddingConfig() {
  return Boolean(resolveEmbeddingConfig());
}

async function getEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Invalid text passed to getEmbedding');
  }

  const config = resolveEmbeddingConfig();
  if (!config) {
    throw new Error(
      'Azure OpenAI embedding config is missing. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, and AZURE_EMBEDDING_DEPLOYMENT.'
    );
  }

  const { endpoint, apiKey, embeddingDeployment, apiVersion } = config;
  const url = `${endpoint}/openai/deployments/${embeddingDeployment}/embeddings?api-version=${apiVersion}`;

  try {
    console.log('Calling embedding API...');
    console.log('Deployment:', embeddingDeployment);
    console.log('Text length:', text.length);

    const response = await axios.post(
      url,
      {
        input: text
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    const embedding = response.data?.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error('No embedding returned from API');
    }

    return embedding;
  } catch (err) {
    console.error('Embedding API error:', err.response?.data || err.message);
    throw err;
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function generateEmbeddingsForSOPs(sops) {
  console.log('Generating embeddings for SOPs...');

  for (const sop of sops) {
    try {
      sop.embedding = await getEmbedding(sop.text);
      console.log(`Embedded: ${sop.id}`);
    } catch (err) {
      console.error(`Failed for SOP: ${sop.id}`);
      sop.embedding = null;
    }
  }

  console.log('Embedding generation complete');
  return sops;
}

module.exports = {
  getEmbedding,
  cosineSimilarity,
  generateEmbeddingsForSOPs,
  hasEmbeddingConfig
};
