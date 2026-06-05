# Inmersia

Plataforma de lectura literaria. Permite a los usuarios gestionar su biblioteca personal, leer libros, tomar notas, explorar una cartelera de personajes y lugares, y participar en foros y chats por libro.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| Estilos | Tailwind CSS + CSS propio por vista |
| Backend / Auth / DB | Supabase |
| Animaciones | Lottie React |
| Clases condicionales | clsx |

## Vistas

| Vista | Descripción |
|---|---|
| **Auth** | Login y registro con carnet de acceso |
| **Biblioteca** | Colección personal del usuario, organizada por categorías en estanterías |
| **Tienda** | Catálogo de libros disponibles, con fachada de calle y panel de detalle |
| **Lector** | Lector paginado con cuaderno de notas, subrayados y predicciones |
| **Cartelera** | Tablero visual por libro: personajes, lugares, hechos, datos y notas |
| **Foro** | Comentarios y chat en tiempo real por libro |
| **Perfil** | Carnet de socio con datos personales y cambio de contraseña |

## Configuración

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd inmersia
npm install
```

### 2. Variables de entorno

Copia el archivo de ejemplo y rellena tus claves de Supabase:

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

Las claves se encuentran en tu proyecto de Supabase → **Settings → API**.

### 3. Arrancar en desarrollo

```bash
npm run dev
```

### 4. Build de producción

```bash
npm run build
```

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Previsualizar el build |
| `npm run security-check` | Linter de seguridad + escáner de secretos + auditoría de dependencias |

## Seguridad

Antes de cualquier commit relevante conviene ejecutar:

```bash
npm run security-check
```

El script valida tres cosas en secuencia y falla si alguna encuentra un problema:

1. **ESLint** (`eslint-plugin-security`) — detecta patrones peligrosos en el código fuente.
2. **Secret scanner** (`scripts/scan-secrets.mjs`) — busca credenciales hardcodeadas y variables de entorno cliente-expuestas con nombres peligrosos.
3. **npm audit** — solo falla ante vulnerabilidades de severidad `high` o `critical`.

## Estructura del proyecto

```
src/
├── components/
│   ├── Auth.jsx
│   ├── Biblioteca.jsx
│   ├── Cartelera.jsx
│   ├── Foro.jsx
│   ├── Lector.jsx
│   ├── Perfil.jsx
│   ├── Tienda.jsx
│   ├── biblioteca/       # Componentes internos de la Biblioteca
│   ├── cartelera/        # Tableros y helpers de la Cartelera
│   ├── foro/             # Comentarios, chat y utilidades del Foro
│   ├── lector/           # BookReader, Notebook, RecorderPlayer, etc.
│   └── tienda/           # CalleEscena, CatalogoInterior, PanelLibro, etc.
├── hooks/
│   └── useLocalStorage.js
├── lib/
│   ├── supabase.js       # Cliente de Supabase (lee de .env.local)
│   └── bibliotecaLayout.js
├── styles/               # CSS por vista
├── utils/
│   └── lectorPagination.js
└── App.jsx
scripts/
└── scan-secrets.mjs      # Escáner de secretos para el CI local
```

## Funcionalidades en progreso

- **Perfil → Transacciones**: UI preparada, pendiente de conectar tabla de pagos en Supabase.
- **Perfil → Historial de lectura**: UI preparada, pendiente de conectar `progreso_lectura`.
- **Perfil → Foto de perfil**: preview local funcionando, pendiente de subir a Supabase Storage.
- **Biblioteca → Progreso de lectura**: campo `progress` reservado, pendiente de columna en Supabase.
