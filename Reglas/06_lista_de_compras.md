# Lista de Compras Pendientes (List Items)

## Concepto

La **lista de compras** es una lista compartida de artículos que el hogar necesita comprar. Cualquier miembro puede agregar, editar, eliminar y surtir artículos.

## Campos de un artículo pendiente

| Campo               | Tipo      | Obligatorio | Descripción                                    |
|---------------------|-----------|:-----------:|------------------------------------------------|
| `name`              | string    | SI          | Nombre del artículo (ej. "Leche")              |
| `normalizedName`    | string    | SI          | Nombre normalizado (minúsculas, sin acentos)   |
| `quantity`          | number    | SI          | Cantidad a comprar (debe ser > 0)              |
| `estimatedPrice`    | number    | NO          | Precio estimado total (debe ser >= 0)          |
| `estimatedUnitPrice`| number    | NO          | Precio estimado por unidad (= estimatedPrice / quantity) |
| `preferredStoreId`  | string    | NO          | ID de la tienda preferida para este artículo   |
| `preferredStoreName`| string    | NO          | Nombre de la tienda preferida                  |
| `addedByUid`        | string    | SI          | UID del usuario que agregó el artículo         |
| `createdAt`         | Timestamp | SI          | Fecha de creación                              |
| `updatedAt`         | Timestamp | SI          | Fecha de última modificación                   |

## Validaciones al agregar

- El nombre no puede estar vacío.
- La cantidad debe ser un número finito mayor que 0.
- El precio estimado, si se proporciona, debe ser un número finito >= 0.
- **No se permiten artículos duplicados**: no se puede agregar un artículo con el mismo `normalizedName` que uno ya existente en la lista.
- Si se selecciona un artículo existente de las sugerencias, en lugar de agregar uno nuevo, se marca como conflicto y no se puede guardar.

## Validaciones al editar

- Mismas reglas de nombre, cantidad y precio.
- Al editar se **conserva el `addedByUid` original** (no se cambia el autor aunque edite otro usuario).
- Si el precio estimado se deja vacío al editar, se elimina el campo `estimatedPrice` y `estimatedUnitPrice` del documento.
- Si la tienda preferida se deja vacía al editar, se eliminan los campos `preferredStoreId` y `preferredStoreName`.

## Sugerencias de autocompletado

Al escribir el nombre de un artículo, se muestran sugerencias de:
1. Artículos ya existentes en la lista (fuente: `pending`).
2. Artículos del historial de compras anteriores (fuente: `supplied`).

Las sugerencias del historial pre-rellenan la cantidad, precio y tienda de la última compra de ese artículo.

## Eliminar artículo (Quitar)

- Cualquier usuario puede eliminar un artículo de la lista.
- La eliminación es permanente; el artículo no pasa a ningún historial.

## Ordenamiento

Los artículos se muestran ordenados por `createdAt` de más reciente a más antiguo.

## Reposición masiva

La función de **reposición** permite agregar varios artículos a la lista de una vez, seleccionándolos del historial de compras anteriores:
- Se filtran los candidatos por nombre (búsqueda de texto).
- Los artículos que ya están pendientes en la lista **no se agregan** (se omiten silenciosamente).
- El usuario elige si quiere incluir o no el último precio pagado como precio estimado.
- Si se usa el último precio, también se pre-asigna la tienda preferida de la última compra.
- Se usa un `writeBatch` para escribir todos los artículos en una sola operación.
