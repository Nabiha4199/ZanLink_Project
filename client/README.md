# Zanlink Client

React 19 client built with Vite.

## Source layout

- `src/pages/` contains page-level screens.
- `src/components/` contains reusable presentation and layout components.
- `src/services/` contains server communication.
- `src/config/` contains workflow constants.
- `src/utils/` contains shared formatting and authorization helpers.
- `src/styles/` contains client-owned foundational styles.

## Environment

```bash
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000
```

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```
