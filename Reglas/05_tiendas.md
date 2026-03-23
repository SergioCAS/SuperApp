# Catálogo de Tiendas (Stores)

## Concepto

El **catálogo de tiendas** es una lista de los establecimientos donde el hogar realiza sus compras. Al surtir un artículo se debe seleccionar una tienda de este catálogo.

## Campos

| Campo          | Tipo      | Descripción                              |
|----------------|-----------|------------------------------------------|
| `name`         | string    | Nombre de la tienda (ej. "Soriana")      |
| `normalizedName` | string  | Nombre en minúsculas (para búsqueda/orden)|
| `createdAt`    | Timestamp | Fecha de alta en el catálogo             |
| `lastUsedAt`   | Timestamp | Última vez que se surtió en esta tienda  |

## Validaciones al crear

- El nombre no puede estar vacío.
- **No se permiten nombres duplicados**: se detecta similitud mediante:
  1. Normalización de texto (minúsculas, sin acentos).
  2. Comparación exacta del nombre normalizado.
  3. Comparación exacta de nombre sin espacios.
  4. Si uno contiene al otro y el nombre más corto tiene ≥ 5 caracteres → duplicado.
  5. Distancia Levenshtein ≤ 1 si longitud ≤ 6, o ≤ 2 si longitud > 6.
- Si se detecta un posible duplicado, se advierte y se ofrece "Usar existente".

## Validaciones al editar

- Mismas reglas de duplicado, excluyendo la tienda que se está editando.

## Permisos

| Acción    | member | admin |
|-----------|:------:|:-----:|
| Ver       |   SI   |  SI   |
| Agregar   |   SI   |  SI   |
| Editar    |   NO   |  SI   |
| Eliminar  |   NO   |  SI   |

## Ordenamiento

Las tiendas se ordenan alfabéticamente por `normalizedName`.

## Relación con compras

Al confirmar una compra (surtir), se actualiza automáticamente el campo `lastUsedAt` de la tienda seleccionada.
