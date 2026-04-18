import hashlib
import hmac
import os
import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal, Optional

import psycopg2
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator


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
            cursor.execute(
                """
                ALTER TABLE bank.accounts
                ADD COLUMN IF NOT EXISTS security_hash VARCHAR(128);
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS bank.security_config (
                    key VARCHAR(100) PRIMARY KEY,
                    value VARCHAR(255) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS bank.transfer_handshakes (
                    id UUID PRIMARY KEY,
                    source_account_id UUID NOT NULL REFERENCES bank.accounts(id),
                    target_account_id UUID NOT NULL REFERENCES bank.accounts(id),
                    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
                    description VARCHAR(255) NOT NULL,
                    nonce VARCHAR(80) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    completed_at TIMESTAMPTZ
                );
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_transfer_handshakes_status
                ON bank.transfer_handshakes(status, created_at DESC);
                """
            )
            cursor.execute(
                """
                ALTER TABLE bank.transfer_handshakes
                ADD COLUMN IF NOT EXISTS challenge_nonce VARCHAR(80),
                ADD COLUMN IF NOT EXISTS bank_ack_signature VARCHAR(128),
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
                """
            )

            cursor.execute(
                """
                UPDATE bank.accounts
                SET currency_code = 'USD'
                WHERE currency_code IS NULL OR currency_code NOT IN ('COP', 'USD');
                """
            )

            cursor.execute("SELECT id FROM bank.accounts WHERE security_hash IS NULL")
            account_rows = cursor.fetchall()
            for account_row in account_rows:
                cursor.execute(
                    "UPDATE bank.accounts SET security_hash = %s WHERE id = %s",
                    (_generate_security_hash(), account_row[0]),
                )

            cursor.execute(
                """
                INSERT INTO bank.security_config (key, value)
                VALUES ('BANK_SECURITY_HASH', %s)
                ON CONFLICT (key) DO NOTHING
                """,
                (_generate_security_hash(),),
            )


def _hash_password(password: str) -> str:
    # Hash simple para entorno de prueba.
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _mask_account_number(account_number: str) -> str:
    return f"****{account_number[-4:]}" if len(account_number) >= 4 else "****"


def _generate_account_number() -> str:
    return f"1000{uuid.uuid4().int % 10_000_000:07d}"


def _generate_security_hash() -> str:
    return hashlib.sha256(f"{uuid.uuid4()}-{uuid.uuid4()}".encode("utf-8")).hexdigest()


def _sign_values(values: list[str], secret: str) -> str:
    payload = "|".join(values).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _bank_master_secret() -> str:
    # Nunca se expone al frontend.
    return os.getenv("BANK_MASTER_SECRET", "dev-bank-secret-change-me")


def _usd_cop_rate() -> Decimal:
    raw = os.getenv("USD_COP_RATE", "4000").strip()
    try:
        rate = Decimal(raw)
    except Exception:
        rate = Decimal("4000")
    if rate <= 0:
        return Decimal("4000")
    return rate


def _allowed_currency_codes() -> tuple[str, str]:
    return ("COP", "USD")


def _normalize_currency(code: str) -> str:
    return (code or "").strip().upper()


def _require_cop_usd(currency_code: str, field_name: str = "moneda") -> str:
    normalized = _normalize_currency(currency_code)
    if normalized not in _allowed_currency_codes():
        raise HTTPException(
            status_code=400,
            detail=f"Solo se permiten COP y USD en {field_name}. Valor recibido: {currency_code!r}.",
        )
    return normalized


def _credit_amount_after_fx(
    amount_debit_source: Decimal, source_curr: str, target_curr: str
) -> Decimal:
    s = _normalize_currency(source_curr)
    t = _normalize_currency(target_curr)
    _require_cop_usd(s, "cuenta origen")
    _require_cop_usd(t, "cuenta destino")
    if s == t:
        return amount_debit_source
    rate = _usd_cop_rate()
    if s == "USD" and t == "COP":
        return (amount_debit_source * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if s == "COP" and t == "USD":
        return (amount_debit_source / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    raise HTTPException(
        status_code=400,
        detail="Combinacion de monedas no soportada.",
    )


def _get_bank_security_hash(cursor) -> str:
    cursor.execute(
        "SELECT value FROM bank.security_config WHERE key = 'BANK_SECURITY_HASH' LIMIT 1"
    )
    row = cursor.fetchone()
    if row:
        return row[0]

    bank_hash = _generate_security_hash()
    cursor.execute(
        """
        INSERT INTO bank.security_config (key, value)
        VALUES ('BANK_SECURITY_HASH', %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """,
        (bank_hash,),
    )
    return bank_hash


class CreateAccountRequest(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    document_number: str = Field(min_length=5, max_length=30)
    email: str = Field(min_length=5, max_length=120)
    phone: str = Field(min_length=7, max_length=25)
    password: str = Field(min_length=6, max_length=100)
    initial_balance: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    account_type: str = Field(default="SAVINGS", pattern="^(SAVINGS|CHECKING)$")
    currency_code: str = Field(default="USD", pattern="^(COP|USD)$")

    @field_validator("currency_code", mode="before")
    @classmethod
    def normalize_currency_code(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value


class LoginRequest(BaseModel):
    document_number: str = Field(min_length=5, max_length=30)
    password: str = Field(min_length=6, max_length=100)


class ResetPasswordRequest(BaseModel):
    document_number: str = Field(min_length=5, max_length=30)
    new_password: str = Field(min_length=6, max_length=100)


class TopUpRequest(BaseModel):
    account_number: str = Field(min_length=8, max_length=20)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    description: str = Field(default="Recarga de saldo", max_length=255)


class TransferHandshakeInitRequest(BaseModel):
    document_number: str = Field(min_length=5, max_length=30)
    target_account_number: str = Field(min_length=8, max_length=20)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    description: str = Field(min_length=3, max_length=255)
    nonce: str = Field(min_length=6, max_length=80)
    client_signature: str = Field(min_length=20, max_length=128)


class TransferExecuteRequest(BaseModel):
    handshake_id: str = Field(min_length=36, max_length=36)
    document_number: str = Field(min_length=5, max_length=30)
    challenge_nonce: str = Field(min_length=6, max_length=80)
    client_final_signature: str = Field(min_length=20, max_length=128)


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
                    id, customer_id, account_number, account_type, currency_code, available_balance, security_hash
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    account_id,
                    customer_id,
                    account_number,
                    payload.account_type,
                    payload.currency_code.upper(),
                    payload.initial_balance,
                    _generate_security_hash(),
                ),
            )

            if payload.initial_balance > 0:
                cursor.execute(
                    """
                    INSERT INTO bank.transactions (
                        id, account_id, transaction_type, amount, description, reference_code
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        account_id,
                        "DEPOSIT",
                        payload.initial_balance,
                        "Deposito inicial de apertura",
                        "APERTURA",
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
            "fullAccountNumber": account_number,
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


@app.post("/api/v1/accounts/top-up")
def top_up_account(payload: TopUpRequest) -> dict:
    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE bank.accounts
                SET
                    available_balance = available_balance + %s,
                    updated_at = NOW()
                WHERE account_number = %s
                RETURNING id, customer_id, account_number, currency_code, available_balance
                """,
                (payload.amount, payload.account_number),
            )
            account_row = cursor.fetchone()

            if not account_row:
                raise HTTPException(status_code=404, detail="Numero de cuenta no encontrado.")

            account_id, customer_id, account_number, currency_code, available_balance = account_row

            cursor.execute(
                """
                INSERT INTO bank.transactions (
                    id, account_id, transaction_type, amount, description, reference_code
                ) VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    str(uuid.uuid4()),
                    account_id,
                    "DEPOSIT",
                    payload.amount,
                    payload.description,
                    account_number,
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
                    "TOP_UP",
                    "accounts",
                    account_id,
                    '{"origin":"api"}',
                ),
            )

    return {
        "message": "Saldo cargado correctamente.",
        "accountNumber": account_number,
        "currencyCode": currency_code,
        "availableBalance": str(available_balance),
    }


@app.post("/api/v1/transfers/handshake/init")
def transfer_handshake_init(payload: TransferHandshakeInitRequest) -> dict:
    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT a.id, a.account_number, c.password_hash, a.currency_code
                FROM bank.customers c
                JOIN bank.accounts a ON a.customer_id = c.id
                WHERE c.document_number = %s
                LIMIT 1
                """,
                (payload.document_number,),
            )
            source = cursor.fetchone()
            if not source:
                raise HTTPException(status_code=404, detail="Cuenta origen no encontrada.")

            source_account_id, source_account_number, source_password_hash, source_currency = (
                source
            )
            source_currency = _require_cop_usd(source_currency, "cuenta origen")

            cursor.execute(
                "SELECT id, currency_code FROM bank.accounts WHERE account_number = %s LIMIT 1",
                (payload.target_account_number,),
            )
            target = cursor.fetchone()
            if not target:
                raise HTTPException(status_code=404, detail="Cuenta destino no encontrada.")
            target_account_id, target_currency = target
            target_currency = _require_cop_usd(target_currency, "cuenta destino")

            if payload.target_account_number == source_account_number:
                raise HTTPException(
                    status_code=400, detail="No puedes transferir a la misma cuenta."
                )

            expected_client_signature = _sign_values(
                [
                    payload.document_number,
                    payload.target_account_number,
                    str(payload.amount),
                    payload.description,
                    payload.nonce,
                ],
                source_password_hash,
            )
            if payload.client_signature != expected_client_signature:
                raise HTTPException(status_code=401, detail="Firma de cliente invalida.")

            handshake_id = str(uuid.uuid4())
            challenge_nonce = str(uuid.uuid4())
            bank_ack_signature = _sign_values(
                [handshake_id, challenge_nonce, payload.nonce, "ACK"],
                _bank_master_secret(),
            )
            cursor.execute(
                """
                INSERT INTO bank.transfer_handshakes (
                    id, source_account_id, target_account_id, amount, description, nonce, challenge_nonce, bank_ack_signature, expires_at, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW() + INTERVAL '5 minutes', 'PENDING')
                """,
                (
                    handshake_id,
                    source_account_id,
                    target_account_id,
                    payload.amount,
                    payload.description,
                    payload.nonce,
                    challenge_nonce,
                    bank_ack_signature,
                ),
            )

            credit_preview = _credit_amount_after_fx(
                payload.amount, source_currency, target_currency
            )

    return {
        "handshakeId": handshake_id,
        "challengeNonce": challenge_nonce,
        "bankAckSignature": bank_ack_signature,
        "message": "Handshake completado.",
        "sourceCurrency": source_currency,
        "targetCurrency": target_currency,
        "amountDebitedInSourceCurrency": str(payload.amount),
        "amountCreditedInTargetCurrency": str(credit_preview),
        "fxRateUsdCop": str(_usd_cop_rate()),
    }


@app.post("/api/v1/transfers/execute")
def transfer_execute(payload: TransferExecuteRequest) -> dict:
    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    h.id,
                    h.source_account_id,
                    h.target_account_id,
                    h.amount,
                    h.description,
                    h.status,
                    h.nonce,
                    h.challenge_nonce,
                    h.bank_ack_signature,
                    h.expires_at,
                    src.account_number,
                    src.available_balance,
                    src.currency_code,
                    c.password_hash,
                    tgt.account_number,
                    tgt.currency_code
                FROM bank.transfer_handshakes h
                JOIN bank.accounts src ON src.id = h.source_account_id
                JOIN bank.accounts tgt ON tgt.id = h.target_account_id
                JOIN bank.customers c ON c.id = src.customer_id
                WHERE h.id = %s AND c.document_number = %s
                LIMIT 1
                """,
                (payload.handshake_id, payload.document_number),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Handshake no encontrado.")

            (
                handshake_id,
                source_account_id,
                target_account_id,
                amount,
                description,
                status,
                client_nonce,
                stored_challenge_nonce,
                stored_bank_ack_signature,
                expires_at,
                source_account_number,
                source_available_balance,
                source_currency,
                source_password_hash,
                target_account_number,
                target_currency,
            ) = row

            if status != "PENDING":
                raise HTTPException(status_code=409, detail="Handshake ya procesado.")

            source_currency = _require_cop_usd(source_currency, "cuenta origen")
            target_currency = _require_cop_usd(target_currency, "cuenta destino")
            credit_amount = _credit_amount_after_fx(amount, source_currency, target_currency)
            if credit_amount <= 0:
                cursor.execute(
                    "UPDATE bank.transfer_handshakes SET status = 'FAILED' WHERE id = %s",
                    (handshake_id,),
                )
                raise HTTPException(
                    status_code=400,
                    detail="Monto acreditado en destino invalido tras conversion.",
                )

            if stored_challenge_nonce != payload.challenge_nonce:
                cursor.execute(
                    "UPDATE bank.transfer_handshakes SET status = 'FAILED' WHERE id = %s",
                    (handshake_id,),
                )
                raise HTTPException(status_code=401, detail="Challenge invalido.")

            cursor.execute("SELECT NOW()")
            now_value = cursor.fetchone()[0]
            if not expires_at or expires_at <= now_value:
                cursor.execute(
                    "UPDATE bank.transfer_handshakes SET status = 'FAILED' WHERE id = %s",
                    (handshake_id,),
                )
                raise HTTPException(status_code=401, detail="Handshake expirado.")

            expected_bank_ack = _sign_values(
                [handshake_id, stored_challenge_nonce, client_nonce, "ACK"],
                _bank_master_secret(),
            )
            if stored_bank_ack_signature != expected_bank_ack:
                cursor.execute(
                    "UPDATE bank.transfer_handshakes SET status = 'FAILED' WHERE id = %s",
                    (handshake_id,),
                )
                raise HTTPException(status_code=401, detail="ACK del banco invalido.")

            expected_final_signature = _sign_values(
                [handshake_id, stored_challenge_nonce, "EXECUTE"],
                source_password_hash,
            )
            if payload.client_final_signature != expected_final_signature:
                cursor.execute(
                    "UPDATE bank.transfer_handshakes SET status = 'FAILED' WHERE id = %s",
                    (handshake_id,),
                )
                raise HTTPException(status_code=401, detail="Firma final invalida.")

            if source_available_balance < amount:
                cursor.execute(
                    "UPDATE bank.transfer_handshakes SET status = 'FAILED' WHERE id = %s",
                    (handshake_id,),
                )
                raise HTTPException(status_code=400, detail="Saldo insuficiente.")

            fx_note = ""
            if source_currency != target_currency:
                fx_note = (
                    f" (TC 1 USD = {_usd_cop_rate()} COP; "
                    f"-{amount} {source_currency} / +{credit_amount} {target_currency})"
                )
            description_out = f"{description}{fx_note}"
            description_in = description_out

            # Primero acreditamos cuenta destino y confirmamos el nuevo saldo.
            cursor.execute(
                """
                UPDATE bank.accounts
                SET available_balance = available_balance + %s, updated_at = NOW()
                WHERE id = %s
                RETURNING available_balance
                """,
                (credit_amount, target_account_id),
            )
            target_balance_after = cursor.fetchone()
            if not target_balance_after:
                cursor.execute(
                    "UPDATE bank.transfer_handshakes SET status = 'FAILED' WHERE id = %s",
                    (handshake_id,),
                )
                raise HTTPException(
                    status_code=500,
                    detail="No fue posible acreditar la cuenta destino.",
                )

            # Solo despues de confirmar el credito, debitamos origen.
            cursor.execute(
                """
                UPDATE bank.accounts
                SET available_balance = available_balance - %s, updated_at = NOW()
                WHERE id = %s AND available_balance >= %s
                RETURNING available_balance
                """,
                (amount, source_account_id, amount),
            )
            source_balance_after = cursor.fetchone()
            if not source_balance_after:
                cursor.execute(
                    "UPDATE bank.transfer_handshakes SET status = 'FAILED' WHERE id = %s",
                    (handshake_id,),
                )
                raise HTTPException(
                    status_code=400,
                    detail="Saldo insuficiente al confirmar la transferencia.",
                )

            cursor.execute(
                """
                INSERT INTO bank.transactions (
                    id, account_id, transaction_type, amount, description, reference_code
                ) VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    str(uuid.uuid4()),
                    source_account_id,
                    "TRANSFER_OUT",
                    amount,
                    description_out,
                    target_account_number,
                ),
            )
            cursor.execute(
                """
                INSERT INTO bank.transactions (
                    id, account_id, transaction_type, amount, description, reference_code
                ) VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    str(uuid.uuid4()),
                    target_account_id,
                    "TRANSFER_IN",
                    credit_amount,
                    description_in,
                    source_account_number,
                ),
            )

            cursor.execute(
                """
                UPDATE bank.transfer_handshakes
                SET status = 'COMPLETED', completed_at = NOW()
                WHERE id = %s
                """,
                (handshake_id,),
            )

            cursor.execute(
                """
                INSERT INTO bank.audit_logs (id, actor_id, action, entity_name, entity_id, metadata)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    str(uuid.uuid4()),
                    source_account_id,
                    "TRANSFER_EXECUTED",
                    "transfer_handshakes",
                    handshake_id,
                    '{"origin":"api"}',
                ),
            )

            new_balance = source_balance_after[0]

    return {
        "message": "Transferencia realizada correctamente.",
        "currencyCode": source_currency,
        "availableBalance": str(new_balance),
    }


@app.get("/api/v1/accounts/summary")
def account_summary(document_number: str) -> dict:
    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    c.full_name,
                    a.account_number,
                    a.currency_code,
                    a.available_balance
                FROM bank.customers c
                JOIN bank.accounts a ON a.customer_id = c.id
                WHERE c.document_number = %s
                LIMIT 1
                """,
                (document_number,),
            )
            row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")

    full_name, account_number, currency_code, available_balance = row
    return {
        "fullName": full_name,
        "accountNumber": account_number,
        "maskedAccountNumber": _mask_account_number(account_number),
        "currencyCode": currency_code,
        "availableBalance": str(available_balance),
    }


@app.get("/api/v1/transactions/history")
def transaction_history(
    document_number: str,
    range_type: Literal["all", "30d", "15d", "ytd"] = "all",
    page: Optional[int] = Query(default=None, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
) -> dict:
    filters = ""
    params: list = [document_number]
    if range_type == "30d":
        filters = "AND t.created_at >= NOW() - INTERVAL '30 days'"
    elif range_type == "15d":
        filters = "AND t.created_at >= NOW() - INTERVAL '15 days'"
    elif range_type == "ytd":
        filters = "AND t.created_at >= date_trunc('year', CURRENT_TIMESTAMP)"

    base_from = """
                FROM bank.transactions t
                JOIN bank.accounts a ON a.id = t.account_id
                JOIN bank.customers c ON c.id = a.customer_id
                WHERE c.document_number = %s
                """

    select_fields = """
                SELECT
                    t.created_at,
                    COALESCE(t.reference_code, 'N/A') AS target_account,
                    t.amount,
                    COALESCE(t.description, 'Sin descripcion') AS description,
                    t.transaction_type
                """

    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cursor:
            if page is None:
                cursor.execute(
                    f"""
                    {select_fields}
                    {base_from}
                    {filters}
                    ORDER BY t.created_at DESC
                    """,
                    params,
                )
                rows = cursor.fetchall()
            else:
                cursor.execute(
                    f"""
                    SELECT COUNT(*)
                    {base_from}
                    {filters}
                    """,
                    params,
                )
                total = int(cursor.fetchone()[0])
                offset = (page - 1) * page_size
                cursor.execute(
                    f"""
                    {select_fields}
                    {base_from}
                    {filters}
                    ORDER BY t.created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (*params, page_size, offset),
                )
                rows = cursor.fetchall()

    items = [
        {
            "date": row[0].isoformat(),
            "targetAccount": row[1],
            "amount": str(row[2]),
            "description": row[3],
            "transactionType": row[4],
        }
        for row in rows
    ]
    if page is None:
        return {"items": items}
    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
