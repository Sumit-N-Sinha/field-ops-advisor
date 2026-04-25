const fs = require('fs');
const path = require('path');
const { getEmbedding } = require('./embeddingService');

let sopMemory = [];
let isLoaded = false;
let loadPromise = null;
let embeddingCache = {};

const CACHE_FILE = path.join(__dirname, '../embedding-cache.json');

function extractDocuments(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 1 && payload[0] && Array.isArray(payload[0].documents)) {
      return payload[0].documents;
    }

    if (payload.every(item => item && typeof item === 'object' && Array.isArray(item.documents))) {
      return payload.flatMap(item => item.documents);
    }

    return payload;
  }

  if (payload && Array.isArray(payload.documents)) {
    return payload.documents;
  }

  return [];
}

function loadEmbeddingCache() {
  if (!fs.existsSync(CACHE_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (err) {
    console.warn(`Failed to read embedding cache, starting fresh: ${err.message}`);
    return {};
  }
}

function persistEmbeddingCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(embeddingCache, null, 2));
}

function normalizeDoc(doc) {
  if (!doc || typeof doc !== 'object') {
    return null;
  }

  const id = String(doc.id ?? '').trim();
  const text = typeof doc.text === 'string' ? doc.text.trim() : '';

  if (!id || !text) {
    return null;
  }

  return {
    id,
    text,
    embedding: embeddingCache[id] || null,
    metadata: { ...doc, id }
  };
}

async function loadSOPMemory(seedPath) {
  if (isLoaded) {
    return sopMemory;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    console.log('Loading SOP dataset...');

    const raw = fs.readFileSync(seedPath, 'utf8');
    const json = JSON.parse(raw);
    const docs = extractDocuments(json);

    console.log(`Total documents: ${docs.length}`);

    embeddingCache = loadEmbeddingCache();
    const seenIds = new Set();
    const result = [];

    for (const doc of docs) {
      const normalized = normalizeDoc(doc);
      if (!normalized) {
        continue;
      }

      if (seenIds.has(normalized.id)) {
        continue;
      }

      seenIds.add(normalized.id);
      result.push(normalized);
    }

    sopMemory = result;
    isLoaded = true;

    console.log(`SOP memory loaded: ${sopMemory.length} documents`);
    return sopMemory;
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

function getSOPMemory() {
  return sopMemory;
}

async function ensureEmbeddingsForDocs(docs, batchSize = 4) {
  if (!Array.isArray(docs) || docs.length === 0) {
    return docs;
  }

  if (!isLoaded) {
    throw new Error('SOP memory has not been loaded yet');
  }

  let cacheUpdated = false;
  const targets = docs.filter(doc => doc && !doc.embedding && typeof doc.text === 'string' && doc.text.trim());

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);

    await Promise.all(batch.map(async (doc) => {
      const id = String(doc.id ?? '').trim();
      if (!id) {
        return;
      }

      if (embeddingCache[id]) {
        doc.embedding = embeddingCache[id];
        return;
      }

      try {
        const embedding = await getEmbedding(doc.text);
        doc.embedding = embedding;
        embeddingCache[id] = embedding;
        cacheUpdated = true;
        console.log(`Embedded on demand: ${id}`);
      } catch (err) {
        console.warn(`Embedding failed for ${id}: ${err.message}`);
      }
    }));
  }

  if (cacheUpdated) {
    try {
      persistEmbeddingCache();
    } catch (err) {
      console.warn(`Failed to persist embedding cache: ${err.message}`);
    }
  }

  return docs;
}

module.exports = { loadSOPMemory, getSOPMemory, ensureEmbeddingsForDocs };
