# Contratos de respuesta (equivalente a DTO)

Estos contratos definen exactamente que datos recibe el frontend.
No son tablas de base de datos ni entidades internas.

## Ejemplo: AccountSummaryResponse

- `accountId`: UUID
- `maskedAccountNumber`: string (ejemplo `****1234`)
- `accountType`: `SAVINGS | CHECKING`
- `currency`: `USD | EUR | ...`
- `availableBalance`: number
- `status`: `ACTIVE | BLOCKED | CLOSED`

## Ejemplo: TransactionItemResponse

- `transactionId`: UUID
- `type`: `DEPOSIT | WITHDRAWAL | TRANSFER_IN | TRANSFER_OUT`
- `amount`: number
- `description`: string
- `createdAt`: ISO datetime

## Regla clave

Si un campo no es estrictamente necesario para el caso de uso del frontend,
no debe salir en la respuesta.
