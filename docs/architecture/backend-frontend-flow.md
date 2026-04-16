# Flujo seguro Back -> Front (sin exponer modelo interno)

## Objetivo

El frontend nunca debe depender de tablas ni entidades internas del backend.
Solo consume respuestas controladas (contratos de salida), equivalentes a un DTO.

## Flujo recomendado

1. El frontend llama un endpoint REST (ejemplo: `GET /api/v1/accounts/{id}`).
2. El router delega en un caso de uso de la capa `application`.
3. El caso de uso obtiene entidades del dominio por medio de repositorios.
4. Antes de responder, se construye un **Response Contract** (vista segura).
5. Se omiten campos sensibles o internos.
6. Ese contrato es el unico objeto que viaja al frontend.

## Reglas de seguridad de datos

- No enviar `document_number`, email completo ni datos de auditoria interna.
- Enmascarar campos sensibles (ejemplo: numero de cuenta parcial).
- Exponer solo estados y montos necesarios para la pantalla.
- Versionar contratos bajo `presentation/api/v1/schemas`.

## Donde vive cada parte

- Modelo interno: `backend/src/domain/entities`
- Casos de uso: `backend/src/application/use_cases`
- Contratos de salida (tipo DTO): `backend/src/presentation/api/v1/schemas`
- Persistencia PostgreSQL: `backend/src/infrastructure/db`
