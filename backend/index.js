const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { loadSOPMemory } = require('./services/sopMemory');
const { logEvent } = require('./utils/logger');
const fieldNoteRoutes = require('./routes/fieldNote');
const recommendationRoutes = require('./routes/recommendation');
const sopRoutes = require('./routes/sop');
const mapStateRoutes = require('./routes/mapState');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const seedPath = path.join(__dirname, 'seed_docs.json');

app.use(cors());
app.use(bodyParser.json());

async function startServer() {
  try {
    logEvent('startup', 'system', { msg: 'Loading SOPs...' });
    await loadSOPMemory(seedPath);
    logEvent('startup', 'system', { msg: 'SOPs loaded.' });

    app.use('/field-note', fieldNoteRoutes);
    app.use('/recommendation', recommendationRoutes);
    app.use('/sops', sopRoutes);
    app.use('/map-state', mapStateRoutes);

    app.get('/', (req, res) => {
      res.send('Field Operations API running.');
    });

    app.listen(PORT, () => {
      logEvent('startup', 'system', { msg: `Server running on port ${PORT}` });
    });
  } catch (err) {
    logEvent('startup', 'system', { error: err.message || err });
    process.exit(1);
  }
}

startServer();
