# Épocas Recurrentes (Seasons)

## Concepto

Las **épocas** son periodos del año con nombre propio (ej. Navidad, Verano, Quincena). Se usan para clasificar las compras realizadas durante ese periodo. Son recurrentes: se repiten cada año sin necesidad de recrearlas.

## Campos

| Campo        | Tipo    | Descripción                                   |
|--------------|---------|-----------------------------------------------|
| `name`       | string  | Nombre de la época (ej. "Navidad")             |
| `startMonth` | number  | Mes de inicio (1-12)                           |
| `startDay`   | number  | Día de inicio (1-31)                           |
| `endMonth`   | number  | Mes de fin (1-12)                              |
| `endDay`     | number  | Día de fin (1-31)                              |
| `active`     | boolean | Si la época está activa para asignación        |

## Validaciones

- El mes debe ser un entero entre 1 y 12.
- El día debe ser un entero entre 1 y 31.
- El nombre no puede estar vacío.
- **No se permiten nombres duplicados**: se detecta similitud usando normalización de texto + distancia Levenshtein:
  - Distancia ≤ 1 si la longitud máxima es ≤ 6 caracteres.
  - Distancia ≤ 2 si la longitud máxima es > 6 caracteres.
  - Si se detecta un posible duplicado, se ofrece la opción de "Usar existente".

## Épocas que cruzan el año

Las épocas pueden definirse cruzando el fin de año. Ejemplo: Navidad del 15/12 al 02/02. La lógica de detección maneja este caso correctamente:
- Si `inicio <= fin` (mismo año): el artículo está en época si `inicio <= hoy <= fin`.
- Si `inicio > fin` (cruza año): el artículo está en época si `hoy >= inicio` O `hoy <= fin`.

## Asignación automática de época en compras

Al registrar una compra (surtir un artículo), el sistema busca automáticamente si la fecha actual cae dentro de alguna época activa y válida. Si la encuentra, asigna su `seasonId` a la compra. Solo épocas con `active=true` y fechas válidas se consideran.

## Permisos

- **Solo admin** puede crear, eliminar, activar o desactivar épocas.
- Todos los usuarios pueden ver las épocas.

## Ordenamiento

Las épocas se ordenan por fecha de inicio (mes × 100 + día), de menor a mayor.
