# Notes App

**Stack:** Vue 3, TypeScript, Express, PostgreSQL (Neon).

- **Frontend:** [Open App]([FRONTEND_URL](https://notes-app-yalr.vercel.app/))
- **Backend:** [API](https://notes-app-tan-beta-10.vercel.app/)
- **Database:** Neon PostgreSQL

## Database Model

See `docs/db-model.png`.

## API

`GET/POST /api/notes`, `GET/PUT/DELETE /api/notes/:id`, `GET /api/folders`, `GET /api/tags`.

Filters: `folder_id`, `tag_id`, `search`.
