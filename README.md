# AutoWiring Studio
Редактор электросхем для авто и мотоциклов. React + TypeScript + Vite, без сервера и регистрации.

## Запуск
`npm install && npm run dev` · сборка `npm run build` · тесты `npm test`

## Публикация
- **GitHub Pages**: Settings → Pages → Source: GitHub Actions; workflow `.github/workflows/deploy.yml` соберёт сайт при push в `main`.
- **Cloudflare Pages**: build command `npm run build`, output directory `dist`.
Пути относительные (`base: './'`), приложение одностраничное без маршрутов — обновление страницы безопасно.

## Горячие клавиши
Ctrl+Z / Ctrl+Y, Ctrl+C / Ctrl+V, Ctrl+S, Delete, Shift — множественное выделение.
