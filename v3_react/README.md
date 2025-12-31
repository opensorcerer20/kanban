# Kanban v3_react

A minimal Express server serving a static Kanban UI and JSON data.

## Run

```bash
# In v3_react directory
npm install
npm start
# Open the app
open http://localhost:3000/index.html
```

## API

- `GET /api/columns` → JSON array of columns `{ id, title }`
- `GET /api/cards` → JSON array of cards including `columnId`
- `PUT /api/columns/:columnId/order` → Persist order for a column
  - Request body: `{ "cardIds": ["1","6","7", ...] }`
  - Moves listed cards into `:columnId` and sets `columnSortOrder` ascending.
  - Send a second request for the source column to re-number remaining cards.

Static files are served from `web/`. JSON files are read from `private/`.
