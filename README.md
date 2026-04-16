# Habicapital Prueba Tecnica

Proyecto base fullstack con:

- Backend: `FastAPI`
- Frontend web: `React` con `Next.js`

## Estructura

```txt
backend/
  app/main.py
  requirements.txt
frontend/
  app/page.js
  package.json
```

## Requisitos

- Python 3.10+ (recomendado)
- Node.js 18+ y npm

## Levantar backend (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend disponible en `http://127.0.0.1:8000`.

Endpoints de prueba:

- `GET /`
- `GET /health`

## Levantar frontend web (React + Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend web disponible en `http://localhost:3000`.

## Nota de conexion Front-Back

En `frontend/app/page.js` se consulta `http://127.0.0.1:8000/health`.
