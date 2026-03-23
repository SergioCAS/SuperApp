# Reportes

## Concepto

La pantalla de reportes permite analizar los datos de compras y artículos pendientes del hogar. Los filtros se aplican localmente sobre los datos ya cargados desde Firestore.

## Tipos de reporte

### 1. Pendientes
Muestra los artículos que están actualmente en la lista de compras.

**Filtros disponibles:**
- Rango de fechas (fecha de creación del artículo): Desde / Hasta.
- Búsqueda por nombre de artículo (coincidencia parcial, normalizada).

**Datos mostrados:** nombre, cantidad, precio estimado, fecha de creación.

---

### 2. Surtidos
Muestra el historial de compras realizadas.

**Filtros disponibles:**
- Rango de fechas (fecha de compra): Desde / Hasta.
- Tienda (selección de una tienda del catálogo).
- Época (selección de una época configurada).
- Búsqueda por nombre de artículo (coincidencia parcial, normalizada).

**Datos mostrados:** nombre, cantidad, precio total, precio unitario, tienda, época, fecha.

---

### 3. Tendencia de precio
Muestra cómo ha variado el precio promedio por unidad de un artículo a lo largo del tiempo, agrupado por mes.

**Filtros disponibles:**
- Nombre del artículo (búsqueda por coincidencia parcial; se debe seleccionar uno de las sugerencias).
- Una o varias tiendas (filtro multi-selección).

**Datos mostrados:** gráfica de puntos con promedio de precio unitario por mes (`YYYY-MM`).

**Cálculo:** Para cada mes se promedia el `unitPricePaid` de todas las compras del artículo seleccionado que correspondan a las tiendas seleccionadas.

---

### 4. Mejor precio
Muestra en qué tienda se ha encontrado el menor precio unitario para un artículo dado.

**Filtros disponibles:**
- Nombre del artículo (búsqueda por coincidencia parcial; se debe seleccionar uno).

**Datos mostrados por tienda:** precio unitario más bajo registrado, precio total correspondiente, cantidad, fecha de la compra.

**Ordenamiento:** de menor a mayor precio unitario.

---

### 5. Gasto por tienda
Muestra el gasto total acumulado por tienda en un periodo determinado.

**Filtros disponibles:**
- Rango de fechas: Desde / Hasta.
- Época (selección de una época).

**Datos mostrados por tienda:** total gastado, número de compras, cantidad total de artículos.

**Ordenamiento:** de mayor a menor gasto total.

---

## Filtros de fechas

- Las fechas se ingresan en formato `YYYY-MM-DD`.
- Hay un selector de calendario integrado para elegir la fecha.
- El rango "Desde" usa el inicio del día (00:00:00) y "Hasta" usa el fin del día (23:59:59).
- Si la fecha ingresada no es válida o está vacía, no se aplica ese límite del rango.

## Autocompletado de artículo

Los campos de búsqueda de artículo en los reportes de Tendencia y Mejor precio ofrecen sugerencias de autocompletado basadas en los nombres únicos de artículos encontrados tanto en pendientes como en el historial de compras.
