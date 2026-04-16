-- Base de datos
-- separar datos internos del contrato expuesto al frontend.

CREATE SCHEMA IF NOT EXISTS bank;

CREATE TABLE IF NOT EXISTS bank.customers (
    id UUID PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    document_number VARCHAR(30) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank.accounts (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES bank.customers(id),
    account_number VARCHAR(20) NOT NULL UNIQUE,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('SAVINGS', 'CHECKING')),
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank.transactions (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES bank.accounts(id),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    description VARCHAR(255),
    reference_code VARCHAR(60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank.audit_logs (
    id UUID PRIMARY KEY,
    actor_id UUID,
    action VARCHAR(80) NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer_id ON bank.accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON bank.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON bank.transactions(created_at DESC);
