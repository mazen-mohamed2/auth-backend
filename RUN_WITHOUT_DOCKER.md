# Backend: Run Without Docker

This project already supports running the backend without Docker.

## Prereqs
- Node.js 18+
- MongoDB running locally (default: `mongodb://localhost:27017`)

## Steps

```bash
cd backend
cp .env.example .env
# Edit .env if needed (especially MONGODB_URI and JWT_* secrets)
npm install
npm run start:dev
```

### Notes
- Swagger: `http://localhost:${PORT:-4000}/docs` (default `4000`).
- For production, build and run with:
  ```bash
  npm run build
  node dist/main.js
  ```
- If MongoDB is on another host/port, update `MONGODB_URI` in `.env`.
