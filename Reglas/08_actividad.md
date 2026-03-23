# Registro de Actividad (Activity Feed)

## Concepto

El **feed de actividad** muestra en tiempo real las acciones recientes del hogar: quién agregó o surtió qué artículo. Está diseñado para ambientes colaborativos donde varios miembros usan la app simultáneamente.

## Eventos registrados

| Tipo       | Cuándo se genera                             |
|------------|----------------------------------------------|
| `added`    | Cuando un usuario agrega un artículo nuevo a la lista |
| `supplied` | Cuando un usuario surte (compra) un artículo |

## Campos del evento

| Campo       | Tipo      | Descripción                              |
|-------------|-----------|------------------------------------------|
| `type`      | string    | `"added"` o `"supplied"`                 |
| `itemName`  | string    | Nombre del artículo afectado             |
| `actorUid`  | string    | UID del usuario que realizó la acción    |
| `actorName` | string    | Nombre visible del usuario               |
| `createdAt` | Timestamp | Fecha y hora del evento                  |

## Reglas de notificación

- Solo se muestra la notificación de eventos **generados por otros usuarios**. Las propias acciones del usuario conectado no generan aviso.
- La notificación se muestra durante **4,500 ms** y luego desaparece.
- El texto de la notificación tiene la forma: `"[Nombre] agregó/surtió: [Artículo]"`.

## Carga de datos

- Se cargan los últimos **12 eventos** ordenados por fecha descendente.
- El listener es en tiempo real (`onSnapshot`), por lo que las actualizaciones llegan inmediatamente.

## No bloqueante

Si el registro de actividad falla (error de red u otro), la operación principal (agregar o surtir el artículo) **no se revierte**. El error se registra solo como advertencia en consola.

## Expansión del historial

En la pantalla de Lista, el usuario puede expandir/contraer el panel de actividad para ver los últimos eventos del hogar.
