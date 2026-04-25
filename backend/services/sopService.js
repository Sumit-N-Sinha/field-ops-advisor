const { getSOPMemory } = require('./sopMemory');

const normalize = (value) => value?.toLowerCase().trim();

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function truncatePreview(text, limit = 180) {
  const content = String(text ?? '').trim();
  if (content.length <= limit) {
    return content;
  }

  return `${content.slice(0, limit).trimEnd()}...`;
}

function getAllDocs() {
  return Array.isArray(getSOPMemory()) ? [...getSOPMemory()] : [];
}

function handleGetSops(req, res) {
  try {
    const {
      region,
      domain,
      category,
      crop_type,
      crop_or_forest_type,
      limit = 10
    } = req.query;

    const maxResults = Math.max(1, Math.min(Number.parseInt(limit, 10) || 10, 100));
    const allDocs = getAllDocs();
    let sops = [...allDocs];

    if (region) {
      sops = sops.filter(doc => normalize(doc.metadata.region) === normalize(region));
    }
    if (domain) {
      sops = sops.filter(doc => normalize(doc.metadata.domain) === normalize(domain));
    }
    if (category) {
      sops = sops.filter(doc => normalize(doc.metadata.category) === normalize(category));
    }
    if (crop_type || crop_or_forest_type) {
      const targetCrop = crop_type || crop_or_forest_type;
      sops = sops.filter(doc => normalize(doc.metadata.crop_or_forest_type) === normalize(targetCrop));
    }

    return res.json({
      total: sops.length,
      sops: sops.slice(0, maxResults).map(doc => ({
        id: doc.id,
        title: doc.metadata.title,
        region: doc.metadata.region,
        domain: doc.metadata.domain,
        category: doc.metadata.category,
        crop_or_forest_type: doc.metadata.crop_or_forest_type,
        keywords: Array.isArray(doc.metadata.keywords) ? doc.metadata.keywords : [],
        preview: truncatePreview(doc.text)
      })),
      filters_available: {
        regions: unique(allDocs.map(doc => doc.metadata.region)),
        domains: unique(allDocs.map(doc => doc.metadata.domain)),
        categories: unique(allDocs.map(doc => doc.metadata.category)),
        crop_or_forest_types: unique(allDocs.map(doc => doc.metadata.crop_or_forest_type))
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' });
  }
}

module.exports = { handleGetSops };
