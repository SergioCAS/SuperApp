# Surtido y Registro de Compras (Purchases)

## Concepto

**Surtir** un artículo significa que fue comprado. Al surtirlo se registra la compra en el historial y el artículo desaparece de la lista de pendientes. Esta operación es **atómica** (usa una transacción de Firestore).

## Flujo al surtir un artículo

1. El usuario selecciona un artículo pendiente y presiona "Surtir".
2. Se abre un modal con:
   - La tienda seleccionada (pre-selecciona la tienda preferida del artículo si existe, o la primera del catálogo).
   - El precio pagado (pre-rellena con el precio estimado del artículo si existe).
3. El usuario confirma con tienda y precio.
4. Se ejecuta una **transacción** que:
   a. Verifica que el artículo todavía existe en la lista.
   b. Crea un documento en `purchases/` con los datos de la compra.
   c. Elimina el artículo de `list_items/`.
   d. Actualiza `lastUsedAt` de la tienda.
5. Se registra un evento de actividad ("supplied") de forma no bloqueante.

## Validaciones para surtir

- Debe seleccionarse una tienda válida (que exista en el catálogo).
- El precio pagado debe ser un número finito >= 0.
- No se puede surtir si hay una operación en curso (`busy`).

## Campos del registro de compra

| Campo           | Tipo      | Descripción                                          |
|-----------------|-----------|------------------------------------------------------|
| `listItemId`    | string    | ID del artículo pendiente que se surtió              |
| `name`          | string    | Nombre del artículo                                  |
| `normalizedName`| string    | Nombre normalizado                                   |
| `quantity`      | number    | Cantidad comprada                                    |
| `pricePaid`     | number    | Precio total pagado                                  |
| `unitPricePaid` | number    | Precio por unidad (= pricePaid / quantity)           |
| `storeId`       | string    | ID de la tienda donde se compró                      |
| `storeName`     | string    | Nombre de la tienda                                  |
| `purchasedByUid`| string    | UID del usuario que realizó la compra                |
| `purchasedAt`   | Timestamp | Fecha y hora de la compra                            |
| `seasonId`      | string    | ID de la época vigente al momento de comprar (opcional) |

## Asignación automática de época

Al registrar la compra, el sistema evalúa si la fecha actual cae dentro de alguna época activa. Si sí, asigna el `seasonId` correspondiente. Solo se considera la **primera** época activa que coincida con la fecha.

## Precio unitario

`unitPricePaid = pricePaid / quantity`

Este campo se calcula automáticamente y se usa en los reportes de tendencia y mejor precio.

## Datos leídos en la transacción

Los valores de `name`, `normalizedName` y `quantity` se toman del snapshot actual del artículo en Firestore (no del estado local de la app), para garantizar consistencia.
