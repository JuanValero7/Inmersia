# Contexto — Gamificación y tracción a la Cartelera (para arrancar sesión nueva)

Estado al 1 oct 2026. El plan se acordó el 28 sep. El 30 sep y el 1 oct se hizo y se subió a `main` todo lo de la sección «Hecho». **Lo que queda son C («La última vez…») y «Tu viaje por el libro»**: hay que pensarlos con mockups antes de programar (ver al final).

## Cómo trabajar con Juan
- Español de Venezuela, **tuteo** (nunca voseo) en toda la copy, también en los mockups.
- **Antes de un cambio estructural**, explicar la lógica y pedir el OK. **Antes de editar archivos existentes**, listarlos y copiarlos a `Documents\Inmersia_respaldos\<fecha>_<tema>\`; decirlo.
- Diseño: **primero mockup** (canvas de diseño publicado como artifact, con la paleta real: naranja `#F2792A`, tinta `#4a3622`, crema `#fffdf8`, papel `#FBF5EC`, Baloo 2 + Poppins; el texto del libro en Crimson Text). Juan lo aprueba y **después** se programa. Suele iterar varias veces sobre el mockup: cambiar solo lo que pide.
- Diagnosticar la causa antes de parchear. Al reemplazar algo, borrar lo viejo.
- **No sumar NADA al tiempo de carga del lector**: a Juan ya le parece lento. Todo lo nuevo va superpuesto y fuera del camino de carga.
- **No crear tablas/datos de poco valor**: Juan prefiere una solución sin tabla aunque sea menos exacta (ver «lo último desbloqueado»).
- Migraciones: las corre Juan en Supabase → SQL Editor ("Run without RLS" si sale el aviso). Siguiente número libre: **064**. La migración va SIEMPRE antes que el código que la usa.
- Verificar con `npx eslint <archivos>`, `npm run build` y `npm test`. En el navegador prueba Juan.
- **No abrir el lector con la cuenta de Juan en pruebas automáticas** sin avisar: crea sesiones de lectura y cambia su «último libro abierto» (pasó el 1 oct midiendo tiempos de carga).
- Commits separados por lo que hacen, a `main`, solo cuando Juan lo pida.
- Inmersia es ante todo la casa del libro de Juan: el cuidado de la obra manda sobre enganchar a toda costa.

## Hecho (en `main`)

### Sesiones con tiempo activo (migración 061)
`sesiones_lectura.segundos_activos`: `useSesionLectura` solo suma con la pestaña visible y con actividad (tocar, clic, tecla, scroll) en los últimos **3 min**; guarda cada ~60 s, al ocultarse y al salir (en móvil ya no se pierden sesiones). Retomar < 30 min sigue en la misma fila, pero la pausa no suma. `computeSesionStats` usa `segundos_activos`; las filas viejas (NULL) se calculan por marcas con **tope de 2 h** por sesión. `cohortes.sql` solo usa `started_at`: no le afecta.

### Hero de la Biblioteca
- **Escritorio** (`HeaderSwimlane.jsx`): chip «Llevas X aquí» bajo la barra (desde **5 min**), «Continuar» solo, nota de papel «Nuevo en la investigación» arriba a la derecha (baja al flujo si el hero mide < 760 px).
- **Móvil** (`BibliotecaMobile.jsx`): el hero NO crece (290 px); sin número de %, el chip «Llevas X» encima de la barra; la investigación es una **solapa** que asoma bajo el hero.
- **«Lo último desbloqueado», sin tabla**: son las fichas de la Cartelera del último capítulo terminado (`capitulo_numero = capítulo actual − 1`). No desaparece al visitar la Cartelera; cambia al terminar el siguiente capítulo. Se descartó una tabla `cartelera_vistas` por ser datos de poco valor.
- Datos en `useBiblioteca` (`featured.tiempoLeido`, `featured.investigacion`) con `useTiempoLibroQuery` y `useInvestigacionRecienteQuery` (`lib/queries.js`). La fórmula del capítulo actual vive en `capituloActualDesdePct` (`carteleraHelpers.js`), compartida con `useCartelera`.
- El álbum (barajitas sin pegar) quedó **sin sitio** en el hero.

### Lector: carga más rápida
- Medido el 1 oct (4G + móvil medio simulados): ~1 s del toque al texto. Lo más lento era `media_por_parrafo`.
- El texto ya **no espera a la media**: el capítulo se pinta con los párrafos y los sonidos se suman al llegar (`fetchChapter` en `useLectorData`).
- **Precarga del capítulo siguiente** en segundo plano (`precargarSiguiente`), sin pedidos duplicados.
- La precarga del código del lector desde la Biblioteca estaba rota (en móvil bajaba el lector de escritorio y no el CSS del móvil); arreglada con funciones de import compartidas en `App.jsx`. No precarga con ahorro de datos ni en 2G.
- **Migración 063**: `media_por_parrafo` recorría los 39.000 párrafos para devolver un capítulo (~350 ms). Se puso `libro_id, capitulo_id` al frente del `DISTINCT ON` (mismo resultado) para que el filtro use el índice, y un índice en `elementos_interactivos(parrafo_id)`. **Pendiente de que Juan la corra y confirme el EXPLAIN.**
- Idea no hecha: pedir capítulos + progreso + párrafos en una sola RPC (~0,2 s menos en 4G).

### Selector de progreso en Aa (migración 062)
- Tres modos en la hoja Texto (móvil) y el panel Aa (escritorio): **% del libro**, **% del capítulo**, **número de página** (por defecto, como antes). Muestras de las tarjetas: `%`, `%`, `#`. Se guarda en `localStorage` (`inm_lector_progreso`).
- Pie: «38 %», «Cap. 7 · 62 %» o el número. En doble página el % sale una vez, en la derecha.
- Se mide en **palabras**, no en páginas (no depende de letra ni pantalla). `capitulos.palabras` lo mantienen triggers sobre `parrafos`; la regla de conteo está duplicada en `contar_palabras()` (SQL) y `contarPalabras()` (`readerHelpers.js`). En muestra, el % es sobre el libro entero.
- **Sin páginas del libro entero** («pág. 143 de 380»): exigiría bajar y paginar todo el libro.

## Descartado (no volver a proponer)
Carnet con sellos · gato con accesorios · A tarjeta de cierre de capítulo · B marcas «nuevo»/contador en Investigación · rankings y puntos · **E resumen de sesión** (la gente sale de la plataforma, no del libro) · **G álbum ↔ ficha** (Juan quiere álbum e investigación separados) · **D silueta sin spoiler** · tabla de «qué vio en la Cartelera» · numerar páginas del libro entero.

## Lo que queda: C y «Tu viaje por el libro»
A Juan le parecen lo más divertido de la lista, pero **hay que pensarlos bien**: sesión de ideas con mockups antes de programar. Ninguno es difícil en código; lo difícil es qué cuentan.

### C · «La última vez…» (repaso al volver tras varios días sin leer)
- Cuándo: con `sesiones_lectura` ya se sabe cuántos días lleva sin leer ese libro. Falta decidir el umbral (¿3 días? ¿7?).
- Dónde: al abrir el lector, como capa superpuesta (nunca dentro del flujo del texto ni retrasando la carga).
- Qué mostrar, de más barato a más caro:
  1. Los últimos 1–2 párrafos que leyó (salen de `progreso_lectura.ultimo_parrafo_id`; sin contenido nuevo, sin spoiler).
  2. Lo del último capítulo según la Cartelera (hechos/personajes desbloqueados) como «recuerda que…».
  3. Un resumen escrito de lo leído: exige generar resúmenes por capítulo (pipeline de contenido nuevo).

### «Tu viaje por el libro» (al 100 %) + F (el viaje dentro de la Cartelera)
- Vive en `TableroDatos` de la Cartelera (ya carga stats desde el 90 %, `STATS_FROM_PCT` en `useCartelera`).
- Datos disponibles: tiempo total (ya fiable), días en que leyó, sesión más larga, fecha de inicio y de fin, subrayados, notas, barajitas pegadas, fichas descubiertas, predicciones.
- El % de acierto de predicciones está **bloqueado** (ver memoria del Álbum): queda fuera de entrada.
- Lo difícil es la pieza visual: que se sienta un viaje (mapa / línea de tiempo por capítulos con sus momentos), no una tabla de estadísticas.

## Lo que ya existe (dónde tocar)
- **Sesiones**: `sesiones_lectura` (024 + 061), `src/hooks/useSesionLectura.js`, `computeSesionStats`/`formatSeg` en `src/hooks/useReadingStats.js`.
- **Cartelera**: `src/hooks/useCartelera.js`, `src/components/cartelera/TableroDatos.jsx`, `carteleraHelpers.js` (secciones de ficción y no ficción).
- **Álbum**: `src/hooks/useAlbum.js` (`unlocked`, `pegada` en `album_barajitas_pegadas`, 029).
- **Progreso**: `progreso_lectura` (`ultimo_parrafo_id`, `ultimo_parrafo_offset`, `porcentaje` que solo sube, por capítulos).
- **Lector**: `Lector.jsx` / `LectorMobile.jsx` + `useLectorData.js`; capas superpuestas como `capa.renderHoja`. La paginación móvil (100svh) costó mucho: todo lo nuevo va **superpuesto**.
- **Analítica**: PostHog cookieless; datos solo desde el 2 sep 2026.

## Pendientes fuera de este plan (no mezclar)
Límite de intentos en códigos de invitación · regla 16+ del chat en la base · login con Google sin fecha de nacimiento (ver memoria) · limpiar las ~25 sesiones de prueba de *Robinson Crusoe* del 1 oct en la cuenta de Juan (consulta dada en la sesión; borrar solo si las confirma).
