# Minimal Kanban Board

A simple Kanban-style web app backed by an Express server. Columns and cards are stored in JSON files (private folder), rendered on the client, and updated via a small JSON API.

## Features

- Dynamic columns and cards loaded via API
- HTML5 drag-and-drop between columns
- Sorted by freshness
  - Ready column: ascending `updatedAt` (oldest first)
  - Other columns: descending `updatedAt` (newest first)
- Staleness indicator: four dots turn orange based on weeks since `updatedAt`
- Card content: `[ticketId]: title`, 50-char description snippet, tags list
- Toolbar with navigation; active page highlighting
- Bulk add page to append cards by titles
- Locking
  - Cards have `locked` (boolean) property
  - Lock icon (bottom-right) shows 🔒/🔓; opacity 1.0 when locked, 0.5 when unlocked
  - Moving a card to the Posted column sets `locked` to `true`
  - Locked cards cannot be moved (client and server enforce)

## Project Structure

- [public](public): Client assets
  - [index.html](public/index.html): Kanban board UI
  - [add.html](public/add.html): Bulk add cards
  - [styles.css](public/styles.css): Global styles, card/column/toolbar/staleness/lock icon
  - [app.js](public/app.js): Fetch + render board, DnD, lock icon behavior
  - [nav.js](public/nav.js): Active nav link highlighting
- [private](private): JSON data (not statically served)
  - [columns.json](private/columns.json): Column list with `id` and `title`
  - [cards.json](private/cards.json): Cards data
- [server.js](server.js): Express server + JSON APIs
- [package.json](package.json): Node ESM config and scripts

## Requirements

- Node.js 18+ recommended

## Setup & Run

```bash
npm install
npm start
# Open http://localhost:3000/
```

Set `PORT` via environment variable to change the port.

## Data Model

### Column
```json
{
  "id": "col-ready",
  "title": "Ready"
}
```

### Card
```json
{
  "id": "1",
  "title": "Draft outline",
  "ticketId": "PROJ-001",
  "description": "…",
  "tags": ["one", "two"],
  "columnId": "col-ready",
  "updatedAt": "2025-12-25T19:15:02.443Z",
  "locked": false
}
```

## API

Base URL: `http://localhost:3000`

- GET [/api/board](server.js#L1): Returns `{ columns, cards }`
- POST [/api/cards/move](server.js#L1): Body `{ id, columnId }`
  - Validates `columnId` exists in columns
  - Updates card `columnId` and `updatedAt`
  - If `columnId` is the Posted column, sets `locked: true`
  - Rejects when the card is locked
- POST [/api/cards/addTitles](server.js#L1): Body `{ titles: [string, ...] }`
  - Adds new cards to Ready; auto-increment id and `ticketId`
  - Sets `updatedAt` and `locked: false`
- POST [/api/cards/lock](server.js#L1): Body `{ id, locked }`
  - Updates card `locked` state only

## UI Behavior Notes

- Drag-and-drop is disabled for locked cards (and moves are rejected server-side)
- Lock icon toggles via `/api/cards/lock` and re-renders the board
- Sorting updates immediately on move due to optimistic `updatedAt` change (server response then syncs)

## Development Tips

- Private JSON files are the source of truth and persisted by the server
- Non-API routes serve [index.html](public/index.html) (SPA-style fallback)
- Keep `columns.json` IDs consistent with `cards.json.columnId`

## License

ISC
