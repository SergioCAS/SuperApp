# Modelo de Datos en Firestore

## Estructura general

```
users/
  {uid}/                        -> Perfil del usuario

households/
  {householdId}/                -> Datos del hogar
    seasons/
      {seasonId}/               -> Época recurrente
    stores_catalog/
      {storeId}/                -> Tienda del catálogo
    list_items/
      {itemId}/                 -> Artículo pendiente de compra
    purchases/
      {purchaseId}/             -> Compra realizada
    activity/
      {eventId}/                -> Evento de actividad reciente
```

---

## `users/{uid}`

```
uid:          string    UID de Firebase Auth
email:        string    Correo electrónico
displayName:  string    Nombre visible
role:         string    "admin" | "member"
approved:     boolean   true si puede acceder a la app
householdId:  string    ID del hogar al que pertenece
createdAt:    Timestamp Fecha de creación del perfil
```

---

## `households/{householdId}`

```
name:          string    Nombre del hogar
createdByUid:  string    UID del admin que lo creó
createdAt:     Timestamp Fecha de creación
```

---

## `households/{householdId}/seasons/{seasonId}`

```
name:        string    Nombre de la época
startMonth:  number    Mes de inicio (1-12)
startDay:    number    Día de inicio (1-31)
endMonth:    number    Mes de fin (1-12)
endDay:      number    Día de fin (1-31)
active:      boolean   Si está activa para asignación automática
```

---

## `households/{householdId}/stores_catalog/{storeId}`

```
name:           string    Nombre de la tienda
normalizedName: string    Nombre en minúsculas (para orden y búsqueda)
createdAt:      Timestamp Fecha de alta en el catálogo
lastUsedAt:     Timestamp Última vez usada en una compra
```

---

## `households/{householdId}/list_items/{itemId}`

```
name:               string    Nombre del artículo
normalizedName:     string    Nombre normalizado
quantity:           number    Cantidad a comprar (> 0)
estimatedPrice:     number?   Precio estimado total (opcional)
estimatedUnitPrice: number?   Precio estimado por unidad (opcional)
preferredStoreId:   string?   ID tienda preferida (opcional)
preferredStoreName: string?   Nombre tienda preferida (opcional)
addedByUid:         string    UID del usuario que agregó el artículo
createdAt:          Timestamp Fecha de creación
updatedAt:          Timestamp Fecha de última modificación
```

---

## `households/{householdId}/purchases/{purchaseId}`

```
listItemId:      string    ID del artículo pendiente que se surtió
name:            string    Nombre del artículo
normalizedName:  string    Nombre normalizado
quantity:        number    Cantidad comprada
pricePaid:       number    Precio total pagado (>= 0)
unitPricePaid:   number    Precio por unidad (= pricePaid / quantity)
storeId:         string    ID de la tienda
storeName:       string    Nombre de la tienda
purchasedByUid:  string    UID del usuario que realizó la compra
purchasedAt:     Timestamp Fecha y hora de la compra
seasonId:        string?   ID de la época vigente (opcional, asignado automáticamente)
```

---

## `households/{householdId}/activity/{eventId}`

```
type:       string    "added" | "supplied"
itemName:   string    Nombre del artículo afectado
actorUid:   string    UID del usuario que realizó la acción
actorName:  string    Nombre visible del usuario
createdAt:  Timestamp Fecha y hora del evento
```

---

## Límites de consulta

| Colección   | Límite de documentos cargados |
|-------------|-------------------------------|
| `purchases` | 250 más recientes             |
| `activity`  | 12 más recientes              |
