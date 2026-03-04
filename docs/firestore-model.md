# Firestore Model v1 (MVP)

Modelo simple para app familiar de lista de supermercado.

## Objetivo del modelo

- Colaboración en tiempo real.
- Historial de compras para reportes.
- Comparativa por tienda y por temporada.
- Control admin/miembros con aprobación.

## 1) Colección `users`

Ruta: `users/{uid}`

Campos sugeridos:

- `uid: string`
- `email: string`
- `displayName: string`
- `role: "admin" | "member"`
- `approved: boolean`
- `householdId: string`
- `createdAt: Timestamp`

## 2) Colección `households`

Ruta: `households/{householdId}`

Campos sugeridos:

- `name: string`
- `createdByUid: string`
- `createdAt: Timestamp`

## 3) Subcolección `list_items`

Ruta: `households/{householdId}/list_items/{itemId}`

Campos sugeridos:

- `name: string`
- `normalizedName: string`
- `quantity: number`
- `unit: string` (opcional)
- `estimatedPrice: number` (opcional)
- `addedByUid: string`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Notas:

- Solo representa pendientes.
- Al surtir, se elimina de aquí y se escribe en `purchases` en una transacción.

## 4) Subcolección `purchases`

Ruta: `households/{householdId}/purchases/{purchaseId}`

Campos sugeridos:

- `listItemId: string` (opcional)
- `name: string`
- `normalizedName: string`
- `quantity: number`
- `unit: string` (opcional)
- `pricePaid: number`
- `storeId: string`
- `storeName: string`
- `purchasedByUid: string`
- `purchasedAt: Timestamp`
- `seasonId: string` (opcional)

## 5) Subcolección `products_catalog`

Ruta: `households/{householdId}/products_catalog/{productId}`

Campos sugeridos:

- `name: string`
- `normalizedName: string`
- `lastUsedAt: Timestamp`

Uso:

- Autocompletado contextual al escribir producto.

## 6) Subcolección `stores_catalog`

Ruta: `households/{householdId}/stores_catalog/{storeId}`

Campos sugeridos:

- `name: string`
- `normalizedName: string`
- `createdAt: Timestamp`
- `lastUsedAt: Timestamp`

Uso:

- Selección de tienda al surtir.
- Permite agregar nuevas tiendas sobre la marcha.

## 7) Subcolección `seasons`

Ruta: `households/{householdId}/seasons/{seasonId}`

Campos sugeridos:

- `name: string` (ej. "Navidad 2026")
- `startsAt: Timestamp`
- `endsAt: Timestamp`
- `active: boolean`

Uso:

- Reportes por temporada (Navidad, Semana Santa, etc.).

## Flujo crítico: marcar como surtido

1. Usuario abre item pendiente.
2. Captura `pricePaid` y selecciona/crea `store`.
3. Transacción Firestore:
   - Crear documento en `purchases`.
   - Eliminar documento en `list_items`.
   - Upsert en `products_catalog` y `stores_catalog`.

## Reportes MVP

- `Faltantes`: suma de `estimatedPrice` en `list_items`.
- `Surtidos por periodo`: suma de `pricePaid` filtrando `purchasedAt`.
- `Tienda conveniente`: promedio `pricePaid` por `normalizedName + storeId`.
- `Tendencias por época`: comparar `pricePaid` por `seasonId`.
