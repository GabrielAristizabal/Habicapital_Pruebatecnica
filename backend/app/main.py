import hashlib
import os
import uuid
from decimal import Decimal

import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(
    title="Habicapital API",
    version="0.1.0",
    description="API base con FastAPI para proyecto fullstack.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Backend FastAPI funcionando"}


def _database_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@127.0.0.1:5432/simple_bank",
    )


def _ensure_schema_updates() -> None:
    # Mantiene compatibilidad cuando la base ya existia antes
    # de agregar nuevos campos de autenticacion.
    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                ALTER TABLE bank.customers
                ADD COLUMN IF NOT EXISTS phone VARCHAR(25),
                ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';
                """
            )
            cursor.execute(
                """
                ALTER TABLE bank.accounts
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
                """
            )


def _hash_password(password: str) -> str:
    # Hash simple para entorno de prueba.
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _mask_account_number(account_number: str) -> str:
    return f"****{account_number[-4:]}" if len(account_number) >= 4 else "****"


def _generate_account_number() -> str:
    return f"1000{uuid.uuid4().int % 10_000_000:07d}"


class CreateAccountRequest(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    document_number: str = Field(min_length=5, max_length=30)
    email: str = Field(min_length=5, max_length=120)
    phone: str = Field(min_length=7, max_length=25)
    password: str = Field(min_length=6, max_length=100)
    initial_balance: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    account_type: str = Field(default="SAVINGS", pattern="^(SAVINGS|CHECKING)$")
    currency_code: str = Field(default="USD", min_length=3, max_length=3)


class LoginRequest(BaseModel):
    document_number: str = Field(min_length=5, max_length=30)
    password: str = Field(min_length=6, max_length=100)


class ResetPasswordRequest(BaseModel):
    document_number: str = Field(min_length=5, max_length=30)
    new_password: str = Field(min_length=6, max_length=100)


@app.on_event("startup")
def on_startup() -> None:
    _ensure_schema_updates()


@app.post("/api/v1/accounts")
def create_account(payload: CreateAccountRequest) -> dict:
    customer_id = str(uuid.uuid4())
    account_id = str(uuid.uuid4())
    account_number = _generate_account_number()
    password_hash = _hash_password(payload.password)

    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                FROM bank.customers
                WHERE document_number = %s OR email = %s
                """,
                (payload.document_number, payload.email),
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail="Ya existe un usuario con esa cedula o correo.",
                )

            cursor.execute(
                """
                INSERT INTO bank.customers (
                    id, full_name, email, document_number, phone, password_hash
                ) VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    customer_id,
                    payload.full_name,
                    payload.email,
                    payload.document_number,
                    payload.phone,
                    password_hash,
                ),
            )

            cursor.execute(
                """
                INSERT INTO bank.accounts (
                    id, customer_id, account_number, account_type, currency_code, available_balance
                ) VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    account_id,
                    customer_id,
                    account_number,
                    payload.account_type,
                    payload.currency_code.upper(),
                    payload.initial_balance,
                ),
            )

            cursor.execute(
                """
                INSERT INTO bank.audit_logs (id, actor_id, action, entity_name, entity_id, metadata)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    str(uuid.uuid4()),
                    customer_id,
                    "CREATE_ACCOUNT",
                    "customers",
                    customer_id,
                    '{"origin":"api"}',
                ),
            )

    return {
        "customerId": customer_id,
        "fullName": payload.full_name,
        "accountId": account_id,
        "accountNumber": _mask_account_number(account_number),
        "accountType": payload.account_type,
        "currencyCode": payload.currency_code.upper(),
        "availableBalance": str(payload.initial_balance),
    }


@app.post("/api/v1/auth/login")
def login(payload: LoginRequest) -> dict:
    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.id, c.full_name, c.password_hash, a.account_number
                FROM bank.customers c
                JOIN bank.accounts a ON a.customer_id = c.id
                WHERE c.document_number = %s
                LIMIT 1
                """,
                (payload.document_number,),
            )
            row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Credenciales invalidas.")

    customer_id, full_name, password_hash, account_number = row
    if _hash_password(payload.password) != password_hash:
        raise HTTPException(status_code=401, detail="Credenciales invalidas.")

    # Token de ejemplo para prototipo.
    fake_token = str(uuid.uuid4())
    return {
        "accessToken": fake_token,
        "tokenType": "bearer",
        "user": {
            "customerId": str(customer_id),
            "fullName": full_name,
            "accountNumber": _mask_account_number(account_number),
        },
    }


@app.post("/api/v1/auth/reset-password")
def reset_password(payload: ResetPasswordRequest) -> dict[str, str]:
    new_hash = _hash_password(payload.new_password)

    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE bank.customers
                SET password_hash = %s
                WHERE document_number = %s
                RETURNING id
                """,
                (new_hash, payload.document_number),
            )
            row = cursor.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Usuario no encontrado.")

            cursor.execute(
                """
                INSERT INTO bank.audit_logs (id, actor_id, action, entity_name, entity_id, metadata)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    str(uuid.uuid4()),
                    row[0],
                    "RESET_PASSWORD",
                    "customers",
                    row[0],
                    '{"origin":"api"}',
                ),
            )

    return {"message": "Contrasena actualizada correctamente."}
