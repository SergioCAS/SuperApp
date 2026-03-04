# Manual de Usuario - Super App

## 1. Objetivo
Super App ayuda a gestionar compras del hogar en tiempo real:
- Crear y compartir una lista de artículos pendientes.
- Marcar artículos como surtidos con tienda y precio real.
- Consultar reportes de gasto y precios.
- Administrar usuarios (solo perfil admin).

## 2. Requisitos para usar la app
- Tener una cuenta registrada con correo y contraseña.
- Estar asignado a un hogar (`householdId`) en el perfil.
- En caso de usuarios nuevos: esperar aprobación de un administrador.

## 3. Inicio de sesión y registro
Pantalla: `Acceso`

### Registro
1. Toca `Registrarme`.
2. Captura `Nombre`, `Correo` y `Contraseña`.
3. Toca `Crear cuenta`.
4. La cuenta queda creada con estado pendiente de aprobación.

### Inicio de sesión
1. Toca `Iniciar sesión`.
2. Captura correo y contraseña.
3. Toca `Entrar`.

### Cerrar sesión
- En la misma pantalla `Acceso`, usa `Cerrar sesión`.

## 4. Estado pendiente de aprobación
Pantalla: `Pendiente de aprobación`

Si aparece este mensaje, significa que tu cuenta existe pero un admin aún no la habilita.
- Cuando el admin active `approved = true`, tendrás acceso automáticamente.
- Puedes usar el botón `Cerrar sesión`.

## 5. Pantalla Inicio
Pantalla: `Inicio`

Desde aquí se accede a:
- `Lista`
- `Acceso`
- `Tiendas`
- `Épocas`
- `Reportes`
- `Administrar usuarios` (solo si eres admin)
- `Estado Firebase`

## 6. Lista compartida (uso diario)
Pantalla: `Lista de compras`

### Agregar artículo
1. En `Agregar artículo`, captura:
- Nombre del artículo.
- Cantidad.
- Precio estimado (opcional).
2. Toca `Agregar`.

### Sugerencias y prevención de duplicados
- Al escribir, se muestran sugerencias de artículos pendientes y ya surtidos.
- Si detecta duplicado, muestra opciones:
- `Editar pendiente`
- `Surtir ahora`

### Editar artículo pendiente
- Puedes editar de dos formas:
- Botón `Editar` en cada tarjeta.
- Desde la alerta de duplicado.
- La app te desplaza al formulario para ver claramente la edición.
- Guarda con `Guardar cambios` o cancela con `Cancelar edición`.

### Surtir artículo
1. Toca `Surtir` en el artículo.
2. En modal `Registrar surtido`:
- Selecciona tienda.
- Captura precio pagado.
3. Toca `Confirmar`.

Al surtir:
- El artículo sale de pendientes.
- Se registra en historial de compras.
- Se calcula precio unitario.
- Se asigna época automáticamente según fecha y catálogo de épocas.

### Actividad reciente
- Muestra eventos de artículos agregados/surtidos por usuarios del hogar.
- Usa `Ver más` para ampliar historial.

## 7. Tiendas
Pantalla: `Tiendas`

### Qué puedes hacer
- Agregar tiendas al catálogo del hogar.
- Detectar nombres duplicados o muy parecidos.
- Resaltar y reutilizar tienda existente (`Usar existente`).

### Permisos
- Miembro: puede agregar.
- Admin: puede agregar, editar y eliminar.

## 8. Épocas
Pantalla: `Épocas recurrentes`

Las épocas permiten segmentar compras por temporada (ejemplo: Navidad).

### Crear época
1. Captura nombre.
2. Define mes/día de inicio y fin.
3. Marca activa o inactiva.
4. Guarda con `Guardar época`.

### Notas importantes
- Puede cruzar año (ejemplo: 15/12 a 02/02).
- Detecta nombres similares para evitar duplicados.

### Permisos
- Solo admin puede crear, activar/desactivar o eliminar.

## 9. Reportes
Pantalla: `Reportes`

Incluye cinco bloques:
1. Artículos pendientes de surtir.
2. Artículos surtidos (filtros por fecha, tienda, época y artículo).
3. Tendencia de precios por artículo.
4. Tienda más barata (por compra más reciente).
5. Gasto por tienda y periodo.

### Funciones clave
- Filtros por rango de fecha (`AAAA-MM-DD`).
- Autocompletado de artículos.
- Chips para filtrar por tienda y época.
- Resúmenes automáticos: totales, ticket promedio, participación por tienda.

## 10. Administración de usuarios (solo admin)
Pantalla: `Administrar usuarios`

### Funciones
- Crear hogares.
- Aprobar/revocar usuarios.
- Cambiar rol (`member`/`admin`).
- Asignar o actualizar `householdId` por usuario.

### Requisito para entrar
- Tu perfil debe tener:
- `role = admin`
- `approved = true`

## 11. Estado Firebase
Pantalla: `Estado Firebase`

Permite validar:
- Variables públicas de Firebase.
- Instancia de Firestore.

Si algo está pendiente, corrige configuración antes de continuar.

## 12. Recomendaciones de uso
- Usa nombres claros y consistentes para artículos.
- Captura precio estimado para mejorar planeación.
- Registra surtidos en el momento para mantener reportes correctos.
- Evita duplicar tiendas y épocas con nombres casi iguales.
- Revisa reportes semanalmente para detectar variaciones de precio.

## 13. Problemas frecuentes
### No puedo ver artículos ni reportes
- Verifica que tu usuario tenga `householdId` asignado.

### Me sale "Cuenta pendiente de aprobación"
- Solicita a un admin que cambie `approved` a `true`.

### No puedo editar/eliminar tiendas o épocas
- Esa acción requiere rol admin.

### Un botón no responde al primer toque
- Cierra teclado y vuelve a intentar.
- Si persiste, reinicia la app.

## 14. Glosario rápido
- `Pendiente`: artículo aún no comprado.
- `Surtido`: artículo ya comprado y registrado.
- `Hogar`: grupo compartido de usuarios y datos.
- `Época`: temporada recurrente para clasificar compras.

