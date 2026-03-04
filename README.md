# Lista del Super - Mobile (MVP Gratis)

Base inicial para app colaborativa de supermercado en iOS/Android usando `Expo + React Native + Firebase`.

## 1) Requisitos

- Node.js 20+
- npm 10+
- Cuenta Firebase
- App Expo Go en tu celular (Android/iOS)

Verifica:

```bash
node -v
npm -v
```

## 2) Instalar dependencias

Desde `mobile/`:

```bash
npm install
```

## 3) Configurar Firebase

1. Crea un proyecto en Firebase.
2. Habilita Authentication -> Email/Password.
3. Crea Firestore Database.
4. Crea una app Web dentro del proyecto (solo para obtener credenciales SDK).
5. Copia `mobile/.env.example` a `mobile/.env` y rellena valores.

```bash
cp .env.example .env
```

## 4) Ejecutar en desarrollo

```bash
npm run start
```

Opciones:

- `a`: abrir Android emulator.
- `i`: abrir iOS simulator (macOS).
- Escanear QR con Expo Go para probar en celular.

## 5) Estructura del MVP

- `src/config/firebase.ts`: init Firebase/Auth/Firestore.
- `src/features/auth/`: login y registro.
- `src/features/list/`: lista compartida y surtido.
- `src/features/reports/`: reportes básicos.
- `src/features/admin/`: aprobación de usuarios.
- `src/types/`: tipos de dominio.

## 6) Modelo Firestore (v1)

Colecciones principales:

- `households/{householdId}`
- `users/{uid}`
- `households/{householdId}/list_items/{itemId}`
- `households/{householdId}/purchases/{purchaseId}`
- `households/{householdId}/products_catalog/{productId}`
- `households/{householdId}/stores_catalog/{storeId}`
- `households/{householdId}/seasons/{seasonId}`

Detalles completos en `mobile/docs/firestore-model.md`.

## 7) Reglas e índices

- Reglas base: `mobile/firebase/firestore.rules`
- Índices iniciales: `mobile/firebase/firestore.indexes.json`

Puedes desplegarlas con Firebase CLI cuando la instales:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 8) Alcance MVP (sin costo)

- Registro/login con correo y contraseña.
- Admin aprueba miembros.
- Lista compartida en tiempo real.
- Marcar como surtido con precio y tienda.
- Historial de compras.
- Reportes básicos: faltantes, surtidos, gasto por tienda y periodo.

