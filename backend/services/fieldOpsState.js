const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const initialPlots = [
  {
    plot_id: 'plot-001',
    name: 'North Block A',
    region: 'India',
    crop_type: 'Pine plantation',
    coordinates: {
      latitude: 18.5204,
      longitude: 73.8567
    },
    hectares: 45.2,
    last_observation: {
      note_id: 'note-xyz123',
      text: 'Brown spots on pine needles, some yellowing at base',
      timestamp: '2025-02-10T14:20:00Z'
    },
    active_recommendation: {
      doc_id: 'SOP-0001',
      title: 'Storm Damage Assessment Protocol',
      severity: 'high',
      bullets: ['Update hazard signage', 'Escalate for replant assessment']
    }
  },
  {
    plot_id: 'plot-002',
    name: 'South Block C',
    region: 'Brazil',
    crop_type: 'Eucalyptus',
    coordinates: {
      latitude: -15.7939,
      longitude: -47.8828
    },
    hectares: 28.4,
    last_observation: null,
    active_recommendation: null
  },
  {
    plot_id: 'plot-003',
    name: 'Delta West',
    region: 'Indonesia',
    crop_type: 'Rubber plantation',
    coordinates: {
      latitude: -6.2088,
      longitude: 106.8456
    },
    hectares: 33.1,
    last_observation: null,
    active_recommendation: null
  }
];

const plots = new Map(initialPlots.map((plot) => [plot.plot_id, clone(plot)]));
const notesById = new Map();
const recommendationsByKey = new Map();
const noteToPlotId = new Map();
const assignmentByRegionCrop = new Map();

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function keyFor(region, cropType) {
  return `${normalize(region)}::${normalize(cropType)}`;
}

function stripSopTitle(title) {
  return String(title ?? '')
    .replace(/\s*[—-]\s*.*$/, '')
    .trim();
}

function deriveSeverity(score) {
  if (!Number.isFinite(score)) {
    return 'low';
  }

  if (score >= 85) {
    return 'high';
  }

  if (score >= 60) {
    return 'medium';
  }

  return 'low';
}

for (const plot of plots.values()) {
  assignmentByRegionCrop.set(keyFor(plot.region, plot.crop_type), plot.plot_id);
}

function getPlotForNote(note) {
  if (!note) {
    return null;
  }

  const mappedPlotId = noteToPlotId.get(note.id);
  if (mappedPlotId && plots.has(mappedPlotId)) {
    return plots.get(mappedPlotId);
  }

  const assignmentKey = keyFor(note.region, note.crop_type);
  const assignedPlotId = assignmentByRegionCrop.get(assignmentKey);
  if (assignedPlotId && plots.has(assignedPlotId)) {
    return plots.get(assignedPlotId);
  }

  for (const plot of plots.values()) {
    if (keyFor(plot.region, plot.crop_type) === assignmentKey) {
      assignmentByRegionCrop.set(assignmentKey, plot.plot_id);
      return plot;
    }
  }

  return plots.values().next().value ?? null;
}

function registerFieldNote(note) {
  if (!note) {
    return null;
  }

  const storedNote = clone(note);
  notesById.set(storedNote.id, storedNote);

  const plot = getPlotForNote(storedNote);
  if (plot) {
    noteToPlotId.set(storedNote.id, plot.plot_id);
    plot.last_observation = {
      note_id: storedNote.id,
      text: storedNote.observation,
      timestamp: new Date(storedNote.created || Date.now()).toISOString()
    };
  }

  return clone(storedNote);
}

function registerRecommendation(note, doc, recommendation) {
  if (!note || !doc || !recommendation) {
    return null;
  }

  const key = `${note.id}:${doc.id}`;
  recommendationsByKey.set(key, clone(recommendation));

  const plot = getPlotForNote(note);
  if (plot) {
    const matchingDoc = Array.isArray(note.matches)
      ? note.matches.find((match) => match.id === doc.id)
      : null;

    plot.active_recommendation = {
      doc_id: doc.id,
      title: stripSopTitle(doc.metadata?.title || doc.title || doc.id),
      severity: deriveSeverity(matchingDoc?.relevance_score),
      bullets: Array.isArray(recommendation.bullets)
        ? recommendation.bullets.slice(0, 3)
        : []
    };
  }

  return clone(recommendation);
}

function getNote(noteId) {
  if (!noteId || !notesById.has(noteId)) {
    return null;
  }

  return clone(notesById.get(noteId));
}

function getRecommendationRecord(noteId, docId) {
  if (!noteId || !docId) {
    return null;
  }

  const key = `${noteId}:${docId}`;
  if (!recommendationsByKey.has(key)) {
    return null;
  }

  return clone(recommendationsByKey.get(key));
}

function listPlots(plotId) {
  const items = plotId
    ? plots.has(plotId)
      ? [plots.get(plotId)]
      : []
    : [...plots.values()];

  return items
    .filter(Boolean)
    .map((plot) => clone(plot))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

module.exports = {
  getNote,
  getRecommendationRecord,
  listPlots,
  registerFieldNote,
  registerRecommendation
};
