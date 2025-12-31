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

Static files are served from `web/`. JSON files are read from `private/`.
