const { getSOPMemory, ensureEmbeddingsForDocs } = require('./sopMemory');
const { getEmbedding, cosineSimilarity, hasEmbeddingConfig } = require('./embeddingService');
const { logEvent } = require('../utils/logger');
const TTLCache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { buildRecommendation } = require('./recommendationService');
const {
  getNote,
  registerFieldNote,
  registerRecommendation
} = require('./fieldOpsState');

const cache = new TTLCache(5 * 60 * 1000);

const normalize = (s) => s?.toLowerCase().trim();

function tokenize(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function lexicalSimilarity(a, b) {
  const left = new Set(tokenize(a).filter(word => word.length > 3));
  const right = new Set(tokenize(b));

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let matches = 0;
  left.forEach(word => {
    if (right.has(word)) {
      matches += 1;
    }
  });

  return matches / left.size;
}

function extractEvidenceSnippet(observation, text) {
  const sourceText = String(text || '');
  const sentences = [...sourceText.matchAll(/[^.!?]+[.!?]?/g)];
  const observationTokens = new Set(tokenize(observation).filter(word => word.length >= 4));

  let bestSpan = null;
  let bestScore = -1;

  for (const sentenceMatch of sentences) {
    let start = sentenceMatch.index ?? 0;
    let end = start + sentenceMatch[0].length;

    while (start < end && /\s/.test(sourceText[start])) {
      start += 1;
    }

    while (end > start && /\s/.test(sourceText[end - 1])) {
      end -= 1;
    }

    const sentence = sourceText.slice(start, end);
    const sentenceTokens = new Set(tokenize(sentence).filter(word => word.length >= 4));

    let score = 0;
    for (const token of observationTokens) {
      if (sentenceTokens.has(token)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSpan = { snippet: sentence, char_start: start, char_end: end };
    }
  }

  if (bestSpan && bestScore > 0) {
    return bestSpan;
  }

  return {
    snippet: sourceText.substring(0, Math.min(120, sourceText.length)),
    char_start: 0,
    char_end: Math.min(120, sourceText.length)
  };
}

function scoreSimilarity(similarity, useEmbeddingScore) {
  if (!Number.isFinite(similarity)) {
    return 0;
  }

  const normalized = useEmbeddingScore
    ? (similarity + 1) / 2
    : similarity;

  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

// ==============================
// POST /field-note
// ==============================
async function handleFieldNote(req, res) {
  const correlation_id = req.correlation_id || 'none';
  logEvent('field-note:start', correlation_id, { body: req.body });

  try {
    const { observation, region, crop_type } = req.body;

    if (!observation || typeof observation !== 'string' || observation.length > 500) {
      return res.status(400).json({ error: 'Invalid observation', correlation_id });
    }
    if (!region || !crop_type) {
      return res.status(400).json({ error: 'region and crop_type required', correlation_id });
    }

    const sops = getSOPMemory();

    let filtered = sops.filter(doc =>
      normalize(doc.metadata.region) === normalize(region) &&
      normalize(doc.metadata.crop_or_forest_type) === normalize(crop_type)
    );

    if (filtered.length === 0) {
      filtered = sops.filter(doc =>
        normalize(doc.metadata.region) === normalize(region)
      );
    }

    if (filtered.length === 0) {
      filtered = [...sops];
    }

    const embeddingsAvailable = hasEmbeddingConfig();
    let obsEmbedding = null;
    let canUseEmbeddings = embeddingsAvailable;

    if (embeddingsAvailable) {
      try {
        obsEmbedding = await getEmbedding(observation);
      } catch (err) {
        canUseEmbeddings = false;
        logEvent('field-note:embedding-fallback', correlation_id, { error: err.message });
      }
    }

    if (canUseEmbeddings) {
      await ensureEmbeddingsForDocs(filtered);
    }

    const scored = filtered.map(doc => {
      const keywordText = Array.isArray(doc.metadata.keywords) ? doc.metadata.keywords.join(' ') : '';
      const searchableText = [doc.text, doc.metadata.title, doc.metadata.category, keywordText].join(' ');
      const lexicalScore = Math.max(
        lexicalSimilarity(observation, searchableText),
        lexicalSimilarity(observation, keywordText)
      );
      const filterBoost = [
        normalize(doc.metadata.region) === normalize(region) ? 0.18 : 0,
        normalize(doc.metadata.crop_or_forest_type) === normalize(crop_type) ? 0.18 : 0
      ].reduce((sum, value) => sum + value, 0);

      const similarity = obsEmbedding
        ? (doc.embedding ? cosineSimilarity(obsEmbedding, doc.embedding) : 0)
        : Math.min(1, lexicalScore + filterBoost);

      return { ...doc, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);

    const top = scored.slice(0, 5).map(doc => {
      const normScore = scoreSimilarity(doc.similarity, Boolean(obsEmbedding && doc.embedding));
      const evidence = extractEvidenceSnippet(observation, doc.text);

      return {
        id: doc.id,
        title: doc.metadata.title,
        domain: doc.metadata.domain,
        category: doc.metadata.category,
        region: doc.metadata.region,
        crop_or_forest_type: doc.metadata.crop_or_forest_type,
        relevance_score: normScore,
        evidence_snippet: evidence.snippet,
        char_start: evidence.char_start,
        char_end: evidence.char_end
      };
    });

    const note = {
      id: `note-${uuidv4().slice(0, 8)}`,
      observation,
      region,
      crop_type,
      matches: top,
      created: Date.now()
    };

    registerFieldNote(note);

    logEvent('field-note:success', correlation_id, { note });

    return res.json({
      note_id: note.id,
      matches: top
    });
  } catch (err) {
    logEvent('field-note:error', correlation_id, { error: err.message });
    return res.status(500).json({ error: 'Internal server error', correlation_id });
  }
}

// ==============================
// GET /recommendation
// ==============================
async function handleRecommendation(req, res) {
  const correlation_id = req.correlation_id || 'none';
  logEvent('recommendation:start', correlation_id, { query: req.query });

  try {
    const { note_id, doc_id } = req.query;

    if (!note_id || !doc_id) {
      return res.status(400).json({ error: 'Missing note_id or doc_id', correlation_id });
    }

    const note = getNote(note_id);
    const sops = getSOPMemory();
    const doc = sops.find(d => d.id == doc_id);

    if (!note || !doc) {
      return res.status(404).json({ error: 'Note or SOP not found', correlation_id });
    }

    const cacheKey = `${note_id}:${doc_id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      logEvent('recommendation:cache-hit', correlation_id, {});
      return res.json(cached);
    }

    const recommendation = await buildRecommendation(note, doc, correlation_id);

    const response = recommendation;

    registerRecommendation(note, doc, response);
    cache.set(cacheKey, response);

    logEvent('recommendation:success', correlation_id, {
      fallback_used: response.fallback_used,
      bullet_count: response.bullets.length
    });

    return res.json(response);
  } catch (err) {
    logEvent('recommendation:error', correlation_id, { error: err.message });
    return res.status(500).json({ error: 'Internal server error', correlation_id });
  }
}

module.exports = { handleFieldNote, handleRecommendation };
