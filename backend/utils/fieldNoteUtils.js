const fs = require('fs');
const path = require('path');

// Load SOP docs from JSON file
function getSopDocs(sopsPath) {
  try {
    const data = fs.readFileSync(sopsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load SOP docs:', err);
    return [];
  }
}

// Embedding using @xenova/transformers
let pipeline = null;
async function getEmbeddings(text) {
  if (!pipeline) {
    const { pipeline: loadPipeline } = await import('@xenova/transformers');
    pipeline = await loadPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const output = await pipeline(text, { pooling: 'mean', normalize: true });
  return output.data;
}

// Cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Extract a real substring from SOP text as evidence
function extractEvidenceSnippet(sopText, observation) {
  // Find the longest common substring
  let maxLen = 0, start = 0;
  for (let i = 0; i < sopText.length; i++) {
    for (let j = 0; j < observation.length; j++) {
      let k = 0;
      while (
        i + k < sopText.length &&
        j + k < observation.length &&
        sopText[i + k] === observation[j + k]
      ) {
        k++;
      }
      if (k > maxLen) {
        maxLen = k;
        start = i;
      }
    }
  }
  const snippet = sopText.substr(start, Math.max(maxLen, 10));
  return {
    snippet,
    char_start: start,
    char_end: start + Math.max(maxLen, 10)
  };
}

// Validate substring indices
function validateIndices(text, snippet, start, end) {
  return text.substring(start, end) === snippet;
}

module.exports = {
  getSopDocs,
  getEmbeddings,
  cosineSimilarity,
  extractEvidenceSnippet,
  validateIndices
};
