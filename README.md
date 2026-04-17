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
docs/
  architecture/
  contracts/
```

## Estructura backend propuesta (sin logica aun)

```txt
backend/src/
  domain/                # entidades del negocio (internas)
  application/           # casos de uso y puertos
  infrastructure/        # postgres, repositorios, migraciones
  presentation/api/v1/   # endpoints y contratos de respuesta
  shared/                # seguridad y configuracion
```

El frontend debe consumir solo contratos de salida (tipo DTO), no entidades del dominio.

## Requisitos

- Python 3.10+ (recomendado)
- Node.js 18+ y npm
- Docker Desktop (opcional, recomendado para PostgreSQL)

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
- `POST /api/v1/accounts` (crear cuenta)
- `POST /api/v1/accounts/top-up` (cargar saldo simulado)
- `POST /api/v1/auth/login` (iniciar sesion)
- `POST /api/v1/auth/reset-password` (cambiar contrasena)
- `GET /api/v1/accounts/summary?document_number=...` (saldo y moneda)
- `GET /api/v1/transactions/history?document_number=...&range_type=all|30d|15d` (historial)

## Levantar frontend web (React + Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend web disponible en `http://localhost:3000`.

## Nota de conexion Front-Back

En `frontend/app/page.js` se consulta `http://127.0.0.1:8000/health`.

## Base de datos inicial (PostgreSQL)

Script creado en:

- `backend/src/infrastructure/db/migrations/001_init_bank.sql`

Incluye tablas:

- `bank.customers`
- `bank.accounts`
- `bank.transactions`
- `bank.audit_logs`

### Opcion recomendada: levantar PostgreSQL con Docker

1. Copia el archivo de variables:

```bash
copy .env.docker.example .env
```

2. Levanta PostgreSQL:

```bash
docker compose up -d postgres
```

3. Verifica estado:

```bash
docker compose ps
```

4. (Opcional) Ver logs:

```bash
docker compose logs -f postgres
```

Al primer arranque, Docker ejecuta automaticamente
`backend/src/infrastructure/db/migrations/001_init_bank.sql`.
Si el volumen ya existia, ese script no se vuelve a ejecutar.

Si ya habias levantado la base anteriormente, ejecuta tambien:

```bash
psql -U postgres -d simple_bank -f backend/src/infrastructure/db/migrations/002_auth_and_contact_fields.sql
```

Para reinicializar desde cero:

```bash
docker compose down -v
docker compose up -d postgres
```

### Crear la base y aplicar script manualmente

1. Crea una base de datos en PostgreSQL (ejemplo: `simple_bank`).
2. Ejecuta el script SQL sobre esa base.

Ejemplo con `psql`:

```bash
psql -U postgres -d simple_bank -f backend/src/infrastructure/db/migrations/001_init_bank.sql
```
