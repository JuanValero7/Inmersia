# Cápsula del tiempo — preguntas por libro (no ficción)

Primer juego de no ficción (decisiones de Juan, 10 nov 2026). Maqueta aprobada:
`Documents/Inmersia_maquetas/colegios/maqueta-capsula-noficcion.html`.
Migración `098_capsula.sql`; en la app, `src/components/lector/Capsula.jsx`.

## Cómo funciona

- Al abrir el libro (antes de terminar el capítulo 1) el gato propone guardar lo que
  piensas hoy: **4 preguntas abiertas** que se responden en texto. Al responderlas se
  sella la cápsula con la fecha. Hay «Ahora no» (vuelve a ofrecerse mientras siga en el
  capítulo 1).
- Al pasar del último capítulo se abre: respondes las mismas preguntas **sin ver** lo de
  antes y luego ves tus dos respuestas lado a lado.
- Sin IA, sin ovillos, sin respuestas buenas ni malas, sin conteo de «cambió o no».
- El profe solo **lee** las dos respuestas de cada alumno.

Lo único difícil son las preguntas. Las escribe Claude leyendo el libro (nunca Gemini) y
las revisa Juan.

## Prompt (para el agente que las escribe)

```
Escribes las 4 preguntas de la «cápsula del tiempo» de «{LIBRO}» para Inmersia (app de
lectura; alumnos de 12 a 15 años, lectura media-baja). El alumno las responde ANTES de
leer el libro y otra vez al TERMINARLO, sin ver lo que puso antes; luego compara.

Reglas (todas obligatorias):
1. Abiertas: empiezan por «¿Quién crees que…?», «¿Por qué crees que…?» o
   «¿Cómo crees que…?» (también vale «¿Qué crees que…?» si no se responde con sí/no).
2. Tocan los temas centrales del libro, pero no adelantan ni explican nada de él.
3. Se pueden responder sin haberlo leído: con lo que sabe cualquier chico de 13 años.
4. Ninguna trae la respuesta dentro ni la insinúa («¿crees que lo inventó un rey?» NO).
5. Ninguna se responde con sí o no, ni con un número o un nombre suelto.
6. Pensadas para que, después de leer, la respuesta cambie o se haga más rica: apuntan
   a una idea que el libro discute de verdad, no a un dato.
7. Cortas (≤ 15 palabras), en llano, tuteo, nunca voseo. Sin tecnicismos del libro.
8. Las 4 tocan ideas distintas y siguen el orden del libro si se puede.

Lee el libro entero en UN comando (cat capitulo_*.txt). Escribe el JSON en
{CARPETA}/capsula/capsula.json y compruébalo con
PYTHONIOENCODING=utf-8 python verificar_capsula.py "<json>" (desde
Documents/scripts no ficcion/). Corrige hasta 0 errores.
Responde SOLO: las 4 preguntas y, para cada una, en una línea, qué idea del libro la
hace cambiar (eso va en «idea», que el alumno no ve).
```

## Forma del JSON

```json
{
  "libro": "Del origen del dinero",
  "autor": "Carl Menger",
  "preguntas": [
    { "id": "inventor", "texto": "¿Quién crees que inventó el dinero?", "idea": "…" }
  ]
}
```

- `id`: corto, en minúsculas, sin espacios. **No se cambia** una vez publicado.
- `idea`: para Juan y para el revisor (qué parte del libro hace cambiar la respuesta).
  No se sube a la app.

## Comprobar y subir

Desde `Documents/scripts no ficcion/`:

- `python verificar_capsula.py "<json>"` — 4 preguntas, forma abierta, sin sí/no, ids.
- `python cargar_capsula.py "<json>" --seco` — comprueba sin tocar Supabase.
- `--pruebas` (proyecto de pruebas) o `--supabase-key <service_role>` (producción).
  Subir otra vez sube la versión; las cápsulas ya selladas guardan sus preguntas.

El libro tiene que estar marcado como no ficción (`libros.es_ficcion = false`); el
cargador avisa si no lo está.
