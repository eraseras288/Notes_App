# Notes App (PostgreSQL + Express/TS + Vue 3/TS)

## Запуск
```bash
docker compose up -d                          # 1.2 PostgreSQL + схема (db/init.sql)
cd backend  && npm install && npm run dev     # API:     http://localhost:3000
                                              # Swagger: http://localhost:3000/api-docs
cd frontend && npm install && npm run dev     # UI:      http://localhost:5173
```

## Модель БД (1.3)
Скриншот модели: `docs/db-model.png` (положите сюда исходное изображение диаграммы).

## API
`GET/POST /api/notes`, `GET/PUT/DELETE /api/notes/:id`, `GET /api/folders`, `GET /api/tags`.
Фильтры списка: `folder_id`, `tag_id`, `search`. Подробности — в Swagger.
