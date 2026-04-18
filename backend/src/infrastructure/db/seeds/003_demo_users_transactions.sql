-- Seed: tres cuentas demo con movimientos en distintas fechas (relativas a NOW()).
-- Moneda de cuenta: solo COP o USD (alineado con backend _allowed_currency_codes / create_account).
-- Contrasena de login para los tres usuarios: Demo123!
-- Hash SHA-256 (hex) igual que backend app _hash_password:
--   588c55f3ce2b8569b153c5abbf13f9f74308b88a20017cc699b835cc93195d16
--
-- Ejecutar con Docker (PowerShell, raiz del repo):
--   docker cp backend/src/infrastructure/db/seeds/003_demo_users_transactions.sql simple-bank-postgres:/tmp/seed.sql
--   docker exec -i simple-bank-postgres psql -U postgres -d simple_bank -f /tmp/seed.sql
-- O en una linea (pipe):
--   Get-Content backend/src/infrastructure/db/seeds/003_demo_users_transactions.sql -Raw | docker exec -i simple-bank-postgres psql -U postgres -d simple_bank
--
-- Sin Docker (psql en PATH, misma URL que el backend por defecto):
--   psql "postgresql://postgres:postgres@127.0.0.1:5432/simple_bank" -f backend/src/infrastructure/db/seeds/003_demo_users_transactions.sql

BEGIN;

DELETE FROM bank.transactions
WHERE account_id IN (
    SELECT a.id
    FROM bank.accounts a
    WHERE a.account_number IN ('1000500001', '1000500002', '1000500003')
);

DELETE FROM bank.accounts
WHERE account_number IN ('1000500001', '1000500002', '1000500003');

DELETE FROM bank.customers
WHERE document_number IN ('seed-demo-1', 'seed-demo-2', 'seed-demo-3');

INSERT INTO bank.customers (id, full_name, email, document_number, phone, password_hash)
VALUES
    (
        '11111111-1111-1111-1111-111111111101'::uuid,
        'Maria Demo',
        'maria.demo@seed.habi',
        'seed-demo-1',
        '3001110001',
        '588c55f3ce2b8569b153c5abbf13f9f74308b88a20017cc699b835cc93195d16'
    ),
    (
        '11111111-1111-1111-1111-111111111102'::uuid,
        'Carlos Demo',
        'carlos.demo@seed.habi',
        'seed-demo-2',
        '3001110002',
        '588c55f3ce2b8569b153c5abbf13f9f74308b88a20017cc699b835cc93195d16'
    ),
    (
        '11111111-1111-1111-1111-111111111103'::uuid,
        'Ana Demo',
        'ana.demo@seed.habi',
        'seed-demo-3',
        '3001110003',
        '588c55f3ce2b8569b153c5abbf13f9f74308b88a20017cc699b835cc93195d16'
    );

INSERT INTO bank.accounts (
    id,
    customer_id,
    account_number,
    account_type,
    currency_code,
    available_balance,
    security_hash
)
VALUES
    (
        '22222222-2222-2222-2222-222222222201'::uuid,
        '11111111-1111-1111-1111-111111111101'::uuid,
        '1000500001',
        'SAVINGS',
        'USD',
        0,
        'a6027d6e7d667c6ba93a77f0cf10b865cd215afe7727663e5c1490d8a92c9bf6'
    ),
    (
        '22222222-2222-2222-2222-222222222202'::uuid,
        '11111111-1111-1111-1111-111111111102'::uuid,
        '1000500002',
        'CHECKING',
        'USD',
        0,
        'd85173120a16e4171a1f185ca32ef9ac52223c830833ca44ac851e72031d7492'
    ),
    (
        '22222222-2222-2222-2222-222222222203'::uuid,
        '11111111-1111-1111-1111-111111111103'::uuid,
        '1000500003',
        'SAVINGS',
        'COP',
        0,
        'b6cf029d240d20a5b184e6af3578e191c09d100a2f34c042ef50acd39acdb95b'
    );

-- Maria: ingresos y egresos variados (palabras clave de transactionInsights.js)
INSERT INTO bank.transactions (id, account_id, transaction_type, amount, description, reference_code, created_at)
VALUES
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'DEPOSIT', 600.00, 'Recarga carga de saldo cuenta demo', '1000500001', NOW() - INTERVAL '43 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'DEPOSIT', 1100.00, 'Nomina empresa ACME quincena', '1000500001', NOW() - INTERVAL '40 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'TRANSFER_IN', 280.00, 'Pago honorarios freelance proyecto web', '1000500002', NOW() - INTERVAL '35 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'TRANSFER_OUT', 160.00, 'Pago recibo luz y gas servicios', '1000500003', NOW() - INTERVAL '32 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'DEPOSIT', 70.00, 'Regalo familia cumpleanos', '1000500001', NOW() - INTERVAL '27 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'WITHDRAWAL', 92.00, 'Comida restaurante plaza', 'CAJERO', NOW() - INTERVAL '23 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'WITHDRAWAL', 48.00, 'Uber viaje cena', 'CAJERO', NOW() - INTERVAL '19 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'DEPOSIT', 340.00, 'Interes rendimiento CDT trimestral', '1000500001', NOW() - INTERVAL '16 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'TRANSFER_OUT', 520.00, 'Arriendo cuarto mensual apartamento', '1000500003', NOW() - INTERVAL '13 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'TRANSFER_IN', 130.00, 'Transferencia prestamo devolucion Carlos', '1000500002', NOW() - INTERVAL '9 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'DEPOSIT', 90.00, 'Cobro venta factura cliente 55', '1000500001', NOW() - INTERVAL '4 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201'::uuid, 'TRANSFER_IN', 300.00, 'Devolucion prestamo personal Ana', '1000500003', NOW() - INTERVAL '10 days');

-- Parejas de transferencia: Carlos OUT / Ana IN donde aplica
INSERT INTO bank.transactions (id, account_id, transaction_type, amount, description, reference_code, created_at)
VALUES
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202'::uuid, 'TRANSFER_OUT', 280.00, 'Pago honorarios freelance proyecto web', '1000500001', NOW() - INTERVAL '35 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202'::uuid, 'TRANSFER_OUT', 400.00, 'Pago internet wifi hogar mensual', '1000500003', NOW() - INTERVAL '28 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202'::uuid, 'WITHDRAWAL', 95.00, 'Netflix Spotify entretenimiento', 'WEB', NOW() - INTERVAL '20 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202'::uuid, 'DEPOSIT', 650.00, 'Cobro venta mercado libre pedido 12', '1000500002', NOW() - INTERVAL '17 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202'::uuid, 'TRANSFER_OUT', 130.00, 'Transferencia prestamo devolucion Carlos', '1000500001', NOW() - INTERVAL '9 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202'::uuid, 'TRANSFER_OUT', 85.00, 'Pago servicios recibo acueducto agua', '1000500003', NOW() - INTERVAL '6 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202'::uuid, 'WITHDRAWAL', 310.00, 'Gasolina vehiculo combustible semana', 'ESTACION', NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202'::uuid, 'DEPOSIT', 15000.00, 'Deposito inicial negocio cuenta principal', '1000500002', NOW() - INTERVAL '44 days');

INSERT INTO bank.transactions (id, account_id, transaction_type, amount, description, reference_code, created_at)
VALUES
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222203'::uuid, 'DEPOSIT', 2500.00, 'Apertura cuenta recarga inicial', '1000500003', NOW() - INTERVAL '42 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222203'::uuid, 'TRANSFER_IN', 160.00, 'Pago recibo luz y gas servicios', '1000500001', NOW() - INTERVAL '32 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222203'::uuid, 'TRANSFER_IN', 520.00, 'Arriendo cuarto mensual apartamento', '1000500001', NOW() - INTERVAL '13 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222203'::uuid, 'TRANSFER_IN', 400.00, 'Pago internet wifi hogar mensual', '1000500002', NOW() - INTERVAL '28 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222203'::uuid, 'TRANSFER_IN', 85.00, 'Pago servicios recibo acueducto agua', '1000500002', NOW() - INTERVAL '6 days'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222203'::uuid, 'TRANSFER_OUT', 300.00, 'Devolucion prestamo personal Ana', '1000500001', NOW() - INTERVAL '10 days');

UPDATE bank.accounts SET available_balance = 2090.00, updated_at = NOW()
WHERE id = '22222222-2222-2222-2222-222222222201'::uuid;

UPDATE bank.accounts SET available_balance = 14350.00, updated_at = NOW()
WHERE id = '22222222-2222-2222-2222-222222222202'::uuid;

UPDATE bank.accounts SET available_balance = 3365.00, updated_at = NOW()
WHERE id = '22222222-2222-2222-2222-222222222203'::uuid;

COMMIT;
