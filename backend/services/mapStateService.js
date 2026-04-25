const { listPlots } = require('./fieldOpsState');

function handleGetMapState(req, res) {
  const plotId = String(req.query.plot_id ?? '').trim();
  const plots = listPlots(plotId || undefined);

  res.json({ plots });
}

module.exports = { handleGetMapState };
