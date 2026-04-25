# Backend README

This is the backend service for the project.

## Structure
- **index.js**: Entry point for the backend server.
- **routes/**: API route handlers (fieldNote, mapState, recommendation, sop).
- **services/**: Business logic and service layer (embedding, field notes, LLM, map state, recommendations, SOP memory/service).
- **middleware/**: Middleware functions (e.g., validation).
- **utils/**: Utility functions (cache, logger, field note utils).
- **data/**: Data files (e.g., sops.json).
- **embedding-cache.json**: Embedding cache for fast retrieval.
- **seed_docs.json**: Seed documents for initial data population.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   node index.js
   ```

## Notes
- Ensure Node.js is installed.
- Configure environment variables as needed.
