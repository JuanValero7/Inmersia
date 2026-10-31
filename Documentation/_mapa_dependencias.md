# Mapa de Dependencias — Inmersia

Árbol de quién llama a quién. Leer de arriba hacia abajo: el padre monta al hijo, el hijo usa las flechas para ir a Supabase o a otros módulos.

```
App.jsx
  └─ VistaBiblioteca  (src/components/Biblioteca.jsx)       [desktop]
  └─ BibliotecaMobile (src/components/mobile/BibliotecaMobile.jsx) [mobile]

VistaBiblioteca
  ├─ useBiblioteca(user, lastOpenedBookIds)    ──► Supabase: perfiles, categorias_usuario,
  │                                                          bibliotecas_usuarios ⋈ libros
  ├─ useLocalStorage('bv_notes')               ← ⚠️ DEAD CODE (declarado, nunca leído ni pasado a hijos)
  ├─ clay/HeaderSwimlane.jsx
  │   ├─ InmHeader  ──► onGoTienda, onGoPerfil, onSignOut (callbacks al App)
  │   └─ Swimlane (→ HeroFeatured)
  │       └─ clay/helpers.jsx → BookCover
  │           └─ coverHelpers.shared.js
  ├─ clay/Shelves.jsx
  │   ├─ FlatShelves  (lomos en posiciones absolutas, 3 cats/fila)
  │   │   ├─ ShSpine
  │   │   └─ CartoonPlank
  │   └─ CoverShelf  (portadas face-out, "Últimos abiertos")
  │       └─ clay/helpers.jsx → BookCover
  ├─ BibBookModal.jsx        ← montado cuando selectedBook ≠ null
  │   ├─ useResena(book, user) ──► Supabase: resenas_libros
  │   └─ callbacks: onOpenBook, onGoForo, onGoNotebook → App
  └─ ManageCategoriasModal.jsx ← montado cuando showManageCats = true
      └─ callbacks async: onCreate, onUpdate, onDelete → useBiblioteca → Supabase

BibliotecaMobile
  ├─ useBiblioteca(user, lastOpenedBookIds)    (mismo hook que desktop)
  ├─ mobile/biblioteca/bibmHelpers.jsx
  │   └─ coverHelpers.shared.js (re-exporta INK, inmTint, hashOf, lum, STORYBOOK, spineColor)
  ├─ mobile/biblioteca/BibShelvesMobile.jsx
  │   ├─ MobileShelves (lomos en scroll-H, cap 15/fila)
  │   └─ CoverCarousel ("Últimos abiertos")
  ├─ mobile/biblioteca/BibBookSheet.jsx        ← montado cuando selectedBook ≠ null
  │   ├─ useResena(book, user) ──► Supabase: resenas_libros
  │   └─ callbacks: onOpenBook, onGoForo, onGoNotebook → App
  └─ mobile/biblioteca/BibScreensMobile.jsx    ← montado cuando screen = 'filter' | 'manage'
      ├─ FilterScreen
      └─ ManageScreen

guidedTour.js ←── lo consultan tanto VistaBiblioteca como BibliotecaMobile
tutorial.js   ←── runGuidedBib1/Bib2 (desktop)
tutorial.mobile.js ←── runGuidedBib1Mobile/Bib2Mobile (mobile)

BookOpenTransition.jsx  ← ver doc propio; parece llamado desde App.jsx al navegar al Lector
```

---

## Módulo Lector

```
App.jsx
  └─ LectorRoute (src/components/LectorRoute.jsx)
      ├─ [user]    → usa currentBook ya cargado en App
      └─ [invitado]→ fetcha libro por slug desde `libros` (tabla pública)
          ├─ Lector.jsx (VistaLectura)             [desktop]
          └─ LectorMobile.jsx                      [mobile]

Lector.jsx / LectorMobile.jsx
  ├─ useLectorData(book, setChapterIndex, setPageIndex)
  │     ├─► Supabase: capitulos, parrafos, media_por_parrafo  (fetchChapter)
  │     ├─► Supabase: progreso_lectura                        (restaurar + guardar)
  │     ├─► Supabase: bibliotecas_usuarios                    (leido=true al 100%)
  │     ├─► Supabase: resenas_libros                         (load + upsert)
  │     ├─► Supabase: subrayados_usuario                     (insert)
  │     └─► Supabase: elementos_interactivos, biblioteca_media (superusuario)
  ├─ paginarParrafos (src/utils/lectorPagination.js)
  ├─ useAmbiente (en useLectorComun) + useAmbienteEnPagina ── ambiente por tramos (ficción, migración 080)
  ├─ useXrayItems(isOpen, bookId, chapterNum, seccion)
  │     └─► Supabase: cartelera_items
  ├─ useLocalStorage — inm_lector_fontSize / font / theme / ledColor / inm_auto_img
  ├─ guidedTour.js + tutorial.js / tutorial.mobile.js
  │
  ├─ [desktop]
  │   ├─ BookReader.jsx
  │   │   ├─ PageContent     ← párrafos + audio anclado (texto_ref)
  │   │   ├─ ChapterSelect   ← dropdown con portal
  │   │   ├─ TypographyControl ← fuente/tamaño/tema/LED con portal
  │   │   ├─ RecorderPlayer  ← audio de ambiente (ficción)
  │   │   │   └─ LupaIcon / ForoIcon / NotebookIcon (íconos reutilizados)
  │   │   └─ WhiteNoisePlayer ← ruido generativo (no ficción)
  │   │       └─ useWhiteNoise
  │   └─ PolaroidStack.jsx   ← imágenes del capítulo (portal para overlay)
  │
  ├─ [compartido desktop+mobile]
  │   ├─ Notebook.jsx
  │   │   └─► Supabase: predicciones_usuario, anotaciones_usuario, subrayados_usuario
  │   └─ SuperuserSoundsPanel.jsx
  │       └─► Supabase: biblioteca_media (SELECT catálogo al abrir)
  │
  ├─ [mobile]
  │   ├─ MobileBookPage       ← hoja única (src/components/mobile/lector/MobileBookPage.jsx)
  │   │   └─ readerHelpers.js (findPrefixAtEnd, findSuffixAtStart)
  │   └─ LectorSheets.jsx     ← sheets y overlays (src/components/mobile/lector/)
  │       ├─ ChapterSheet / TypoSheet / AudioSheet / WhiteNoiseSheet
  │       ├─ NavSheet / XraySheet / ImageOverlay
  │       ├─ ResenaSheet / ConfirmSubrayadoSheet
  │       └─ useWhiteNoise    ← ruido generativo (no ficción mobile)
  │
  └─ clay.jsx (tokens + ClayButton + getReaderPalette)
      └─ readerConstants.js (READING_FONTS)

Conexiones de salida del Lector a otros módulos:
  Cartelera ←── onGoCartelera(itemId) → setCartelaJumpId en App → /cartelera/:slug
  Foro      ←── onGoForo() → setForoSource='lectura' en App → /foro/:slug
  Biblioteca ←── onGoBack() → /biblioteca
```

## Tablas de Supabase que toca el Lector

| Tabla | Operaciones | Quién |
|---|---|---|
| `capitulos` | SELECT | useLectorData (fetchChapter) |
| `parrafos` | SELECT | useLectorData (fetchChapter) |
| `media_por_parrafo` | SELECT | useLectorData (fetchChapter) |
| `progreso_lectura` | SELECT, UPSERT, UPDATE | useLectorData + Lector.jsx + LectorMobile.jsx |
| `bibliotecas_usuarios` | UPDATE (`leido`) | useLectorData + Lector.jsx + LectorMobile.jsx |
| `resenas_libros` | SELECT, UPSERT | useLectorData |
| `subrayados_usuario` | INSERT, DELETE, SELECT | useLectorData + Notebook.jsx |
| `predicciones_usuario` | SELECT, UPSERT | Notebook.jsx |
| `anotaciones_usuario` | SELECT, INSERT, UPDATE | Notebook.jsx |
| `elementos_interactivos` | INSERT, DELETE | useLectorData (superusuario) |
| `biblioteca_media` | SELECT, UPDATE | useLectorData + SuperuserSoundsPanel.jsx |
| `cartelera_items` | SELECT | useXrayItems |
| `libros` | SELECT por slug | LectorRoute.jsx (solo invitados) |
| RPC `delete_parrafo_superuser` | — | useLectorData (superusuario) |

## Deuda técnica — Lector

| Issue | Severidad | Dónde |
|---|---|---|
| `progreso` no se sincroniza a `bibliotecas_usuarios` | Baja | `useLectorData.js` + `useBiblioteca.js:73` — barra de progreso en hero siempre vacía |
| `lectorPagination.js` sin tests | Baja | Lógica de fragmentación sutil y difícil de verificar |
| `FONT_WIDTH` duplicado en `Lector.jsx` y `LectorMobile.jsx` | Baja | Mover a `readerConstants.js` junto con `READING_FONTS` (pendiente hasta item 9/tests) |

---

## Archivos muertos o desconectados

| Archivo | Estado | Motivo |
|---|---|---|
| `src/lib/bibliotecaLayout.js` | **DEAD CODE** | Nadie lo importa en `src/`. Era un sistema de slots anterior a `FlatShelves`. |
| `notes` en `Biblioteca.jsx:33` | **DEAD CODE** | `useLocalStorage('bv_notes')` declarado pero nunca leído ni pasado a hijos. |

## Tablas de Supabase que toca Biblioteca

| Tabla | Operaciones | Quién |
|---|---|---|
| `perfiles` | SELECT nombre, apellido | useBiblioteca |
| `categorias_usuario` | SELECT, INSERT, UPDATE, DELETE | useBiblioteca |
| `bibliotecas_usuarios` | SELECT (+ join libros), UPDATE (categoria_id) | useBiblioteca |
| `libros` | SELECT (vía join) | useBiblioteca |
| `resenas_libros` | SELECT, INSERT, UPDATE (upsert) | useResena |
