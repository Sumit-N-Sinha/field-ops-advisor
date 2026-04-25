const { getRecommendation: requestLLM } = require('./llmService');

function normalize(text) {
  return String(text ?? '').toLowerCase();
}

function tokenize(text) {
  return normalize(text).match(/[a-z0-9]+/g) || [];
}

function parseLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-\d.\s]+/, '').trim())
    .filter(Boolean);
}

function firstClause(segment) {
  const trimmed = String(segment ?? '').trim();
  if (!trimmed) {
    return null;
  }

  let cutIndex = trimmed.length;
  for (const separator of [';', '.']) {
    const index = trimmed.indexOf(separator);
    if (index !== -1 && index < cutIndex) {
      cutIndex = index;
    }
  }

  const clause = trimmed.slice(0, cutIndex).trim().replace(/\s+/g, ' ');
  return clause || null;
}

function sentenceSpans(text) {
  const sourceText = String(text ?? '');
  const spans = [];
  const matches = sourceText.matchAll(/[^.!?]+[.!?]?/g);

  for (const match of matches) {
    let start = match.index ?? 0;
    let end = start + match[0].length;

    while (start < end && /\s/.test(sourceText[start])) {
      start += 1;
    }

    while (end > start && /\s/.test(sourceText[end - 1])) {
      end -= 1;
    }

    if (end > start) {
      spans.push({
        text: sourceText.slice(start, end),
        start,
        end
      });
    }
  }

  return spans;
}

function scoreOverlap(left, right) {
  const leftTokens = new Set(tokenize(left).filter((token) => token.length > 3));
  const rightTokens = new Set(tokenize(right).filter((token) => token.length > 3));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function extractSourceBullets(text, maxBullets = 5) {
  const sourceText = String(text ?? '');
  const stepMatches = [...sourceText.matchAll(/Step\s+\d+\s*:\s*/gi)];
  const bullets = [];

  if (stepMatches.length > 0) {
    for (let index = 0; index < stepMatches.length; index += 1) {
      const start = (stepMatches[index].index ?? 0) + stepMatches[index][0].length;
      const end = index + 1 < stepMatches.length ? stepMatches[index + 1].index ?? sourceText.length : sourceText.length;
      const segment = sourceText.slice(start, end);
      const clause = firstClause(segment);

      if (!clause) {
        continue;
      }

      const clauseStart = sourceText.indexOf(clause, start);
      if (clauseStart === -1) {
        continue;
      }

      bullets.push({
        bullet: clause,
        quoted_text: sourceText.slice(clauseStart, clauseStart + clause.length),
        source_char_range: [clauseStart, clauseStart + clause.length],
        confidence: 'high'
      });

      if (bullets.length >= maxBullets) {
        break;
      }
    }
  }

  if (bullets.length >= 3) {
    return {
      bullets,
      fallback_used: false
    };
  }

  const fallbackBullets = [];
  for (const sentence of sentenceSpans(sourceText)) {
    const clause = firstClause(sentence.text);
    if (!clause) {
      continue;
    }

    fallbackBullets.push({
      bullet: clause,
      quoted_text: clause,
      source_char_range: [sentence.start, sentence.start + clause.length],
      confidence: 'medium'
    });

    if (fallbackBullets.length >= maxBullets) {
      break;
    }
  }

  return {
    bullets: fallbackBullets,
    fallback_used: true
  };
}

async function buildRecommendation(note, sop, correlationId = 'none') {
  let llmOutput = null;

  try {
    llmOutput = await requestLLM(note.observation, sop.text, correlationId, 3000);
  } catch (err) {
    llmOutput = null;
  }

  const sourceBullets = extractSourceBullets(sop.text, 5);
  const bulletItems = sourceBullets.bullets.slice(0, 5);
  const citations = bulletItems.map((item, index) => ({
    bullet_index: index,
    quoted_text: item.quoted_text,
    source_char_range: item.source_char_range,
    confidence: item.confidence
  }));

  return {
    recommendation_id: `rec-${Date.now()}`,
    doc_id: sop.id,
    bullets: bulletItems.map((item) => item.bullet),
    citations,
    fallback_used: sourceBullets.fallback_used || !llmOutput,
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  buildRecommendation,
  extractSourceBullets,
  parseLines,
  scoreOverlap
};
