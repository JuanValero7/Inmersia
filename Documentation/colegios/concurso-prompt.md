# El concurso — prompt y reglas (v1, 7 nov 2026)

Vale para cualquier libro de ficción. Primera prueba: *El signo de los cuatro*, capítulos 1 y 2.

**Qué es el concurso:** justo después de leer una frase difícil, se apagan las luces y un foco cae sobre la frase, en su sitio dentro del libro. El alumno escribe con sus palabras qué quiso decir. Una IA compara lo que escribió con la referencia y dice: «¡Correeeecto!» (+3), «Uy, casi» (+1) o «Ehhhh, no». Después se muestra «Así lo entendemos nosotros». Comodines: «más contexto» (1 ovillo) y 50/50 (2 ovillos).

**Cuántas:** el pipeline prepara **hasta 5 frases por capítulo**. A cada alumno le salen **una o dos al azar** de esas cinco. Por eso las cinco tienen que ser igual de buenas: cualquiera puede ser la que le toque.

**Dónde vive el juego de cada libro:** `Documents/<libro>/concurso/concurso.json`, como Anderson y las corazonadas.

**Qué se prepara aquí y qué hace la IA de la app:** aquí se dejan escritos la referencia, la rúbrica y el 50/50. En la app, la IA lee la respuesta del alumno sabiendo la referencia y la rúbrica, y contesta: «¡Correeeecto!» (sin más), o «Uy, casi» / «Ehhhh, no» con una explicación corta escrita para esa respuesta. Decisión de Juan, 7 nov: la explicación la escribe la IA, porque un mensaje preparado no sirve cuando el alumno se equivoca de una forma que nadie previó.

## 1. Prompt

```
Eres profesor de Lengua de secundaria y preparas un juego de lectura para alumnos de
12 a 15 años con lectura media-baja. Trabaja sobre el texto completo de «{LIBRO}»,
adjunto abajo y dividido en capítulos.

El juego: justo después de leer una frase difícil, el alumno ve esa frase iluminada y
tiene que escribir con sus palabras qué quiere decir. Otra IA comparará lo que escriba
con lo que tú prepares aquí, así que tu trabajo es elegir las frases y dejar escrito
qué cuenta como entenderla.

PASO 1 — Candidatas
Recorre cada capítulo y anota las frases que un alumno de 13 años podría leer sin
entender, o entendiendo lo contrario. Cada candidata es de uno de estos tipos:
- "vocabulario": una palabra o expresión rara, antigua o con un sentido distinto al de
  hoy (vulgar = corriente, embarazoso = incómodo) cambia el sentido de la frase.
- "sintaxis": la frase es larga o enrevesada (orden raro, muchas subordinadas, dobles
  negaciones) y lo difícil es seguir quién hace qué y por qué.
- "figurado": metáfora, comparación, exageración, frase hecha o refrán: leída al pie
  de la letra no tiene sentido o dice otra cosa.
- "ironia": dice lo contrario de lo que piensa, se burla, o el narrador cuenta algo
  que el lector tiene que entender distinto de como él lo cuenta (se engaña, presume,
  se justifica).
- "intencion": lo dice en serio, pero quiere decir algo más: una indirecta, una
  excusa, una amenaza velada, un sentimiento que no nombra, la idea a la que apunta
  un ejemplo.

Reglas para que una candidata valga:
- Se entiende con lo que el alumno tiene delante: la frase, el párrafo y lo leído
  hasta ahí. Nada que exija saber cosas de fuera del libro (historia, ciencia, otras
  obras). Si aparece algo de fuera (el quinto postulado de Euclides), la frase vale
  solo si se entiende sin saber qué es.
- El libro no la explica en ese mismo párrafo ni en el siguiente. Si la frase que
  viene después la aclara, el alumno ya tiene la respuesta: descártala.
- Tiene una lectura buena clara. Si dos profesores la explicarían de forma distinta,
  descártala.
- Importa: entenderla mal cambia lo que el alumno piensa de un personaje o de la
  escena. Una descripción con palabras raras que no cambia nada (el color de un
  vestido) no vale.
- La dificultad es del autor, no de la edición: nada de frases con erratas, letras
  que faltan o puntuación rota.
- Explicarla no obliga a hablar de nada inapropiado para un alumno de 12 años.

PASO 2 — Elegir
- Hasta 5 por capítulo. A cada alumno le tocan una o dos al azar, así que las cinco
  tienen que ser igual de buenas. Mejor 3 buenas que 5 con relleno.
- Cada una en un párrafo distinto, repartidas por el capítulo.
- Al menos dos tipos distintos por capítulo si el capítulo lo permite. Ironía e
  intención son las más valiosas: no las dejes fuera si las hay.
- Que no se pisen: la explicación de una no puede dar la de otra del mismo capítulo.
- La frase iluminada es de 1 a 2 oraciones (como mucho unas 45 palabras), copiada
  sin cambiar ni una letra. Si la frase es más larga, corta en la oración que tiene
  la dificultad.

PASO 3 — Pregunta y contexto
- pregunta, una de estas cuatro, sin pistas sobre el tipo (en una ironía nunca
  "¿lo dice en serio?"):
  · "¿Qué quiso decir {personaje} con esto?" (diálogo)
  · "¿Qué quiere decir esta frase?" (narrador)
  · "Dilo con tus palabras" (sintaxis)
  · "¿Qué significa aquí «{palabra}»?" (vocabulario, cuando una sola palabra o
    expresión es la clave)
- contexto: el comodín «más contexto» ilumina además otro trozo del libro. Elige de
  1 a 3 oraciones, copiadas exactas, que estén antes de la frase (en el mismo párrafo
  o en uno de los tres anteriores) y que más ayuden a entenderla: el gesto, el tono,
  lo que pasó justo antes. No puede ser la frase misma ni algo que la explique del
  todo.

PASO 4 — Referencia y rúbrica
Lenguaje que un chico de 13 años entiende sin diccionario.
- referencia: "Así lo entendemos nosotros". Una o dos frases (como mucho 40
  palabras) que explican la frase. Solo con lo que el lector ya sabe en ese punto:
  nada de lo que pasa después.
- rubrica.ideas_clave: de 1 a 3 ideas cortas que tiene que haber en la respuesta,
  dichas como sea, para "correcto". Cada idea se puede comprobar de un vistazo
  ("se burla de la policía", "la policía casi siempre está perdida"). Nada de
  matices que un alumno no escribiría.
- rubrica.casi: en una línea, cómo es una respuesta a medias (tiene una idea y le
  falta la otra; entiende de qué habla pero no el tono).
- rubrica.errores: de 1 a 3 lecturas equivocadas típicas, las que valen "no"
  (la lectura al pie de la letra, el significado de hoy de la palabra, quién hace qué
  al revés).
- rubrica.no_hace_falta: lo que NO se debe exigir en esta frase si alguien lo echa
  en falta (nombrar a un personaje que se sobreentiende, explicar cada palabra). La
  ortografía y el nombre de la figura ("ironía", "metáfora") nunca hacen falta: eso
  ya lo sabe el evaluador.

PASO 5 — 50/50
- cincuenta: dos lecturas para el comodín 50/50. "correcta" resume la referencia;
  "falsa" es el error típico más probable (el primero de rubrica.errores). Las dos
  con la misma forma, el mismo largo y el mismo tono: si la correcta es la única
  larga, la única con matices o la única "lista", se acierta sin leer. Prueba de
  tapar: sin el libro, solo con las dos opciones, no se tiene que adivinar.

PASO 6 — Dificultad
- dificultad 1: la entiende casi cualquiera que lea con atención.
- dificultad 2: hay que fijarse en el contexto o en el tono.
- dificultad 3: solo la saca un buen lector.

Devuelve SOLO JSON:
{"frases":[{"id":"","capitulo":0,"tipo":"vocabulario|sintaxis|figurado|ironia|intencion",
  "dificultad":1,"cita":"","pregunta":"","contexto":"",
  "referencia":"",
  "rubrica":{"ideas_clave":[""],"casi":"","errores":[""],"no_hace_falta":[""]},
  "cincuenta":{"correcta":"","falsa":""}}]}
```

## 2. Lo que comprueba el script (no se le pide a la IA)

`Documents/scripts ficcion/verificar_concurso.py`:

- La cita y el contexto están literales en el capítulo que dice, y la cita una sola vez en el libro. Se les añade el número de párrafo.
- El contexto va antes de la cita: en el mismo párrafo o en uno de los tres anteriores.
- Hasta 5 por capítulo y cada una en un párrafo distinto.
- Aviso si la cita pasa de 45 palabras, si un capítulo con 3 o más frases tiene un solo tipo, o si una opción del 50/50 es mucho más larga que la otra.
- **Proceso PISA** (lo pone el script, no la IA): vocabulario, sintaxis y figurado = *comprender*; ironía e intención = *evaluar y reflexionar*.

## 3. Reglas del juego

- **Al azar, una o dos por capítulo** de las cinco. El sorteo se hace una vez por alumno y libro y queda guardado: si vuelve a leer, le salen las mismas. Dos compañeros casi nunca tienen la misma frase, así que copiarse no sirve.
- **Cuándo salta:** al pasar la página que contiene la frase. Siempre se puede decir «Ahora no»; la frase queda en el Cuaderno para volver.
- **Solo escribir, pegar bloqueado.** Mínimo unas pocas palabras antes de poder enviar y **200 palabras como máximo** (el cuadro no deja escribir más, y el servidor lo vuelve a comprobar).
- **Veredictos y premios:** «¡Correeeecto!» +3 · «Uy, casi» +1 · «Ehhhh, no» 0. Con 50/50: acertar +1, fallar 0. Comodines: más contexto −1, 50/50 −2.
- **Un intento por frase.** Después del veredicto se ve la referencia; repetir ya no mediría nada.
- **El profe** ve por frase: tipo, resultado y comodines usados. Nunca lo que escribió el alumno. Como cada alumno tiene frases distintas, el informe agrupa por tipo (cómo le va con la ironía, con el vocabulario…), no por frase.

## 4. La evaluación en la app (lo siguiente)

**Base de datos: migración 090_concurso.sql** (escrita y probada en PGlite, 27/27; sin correr en Supabase). Se carga con `Documents/scripts ficcion/cargar_concurso.py` (`--seco`, `--pruebas` o `--supabase-key`).
- `concurso_contenido` (frases con referencia y rúbrica, nadie lo lee directo), `concurso_jugadas` (comodines y veredicto, **sin el texto del alumno ni la explicación**, decisión de Juan 7 nov) y `concurso_llamadas` (una fila por llamada a la IA, para los topes).
- El sorteo de 1 o 2 frases por capítulo sale del id del alumno: siempre las mismas, sin guardarlo.
- El alumno llama a `concurso_libro`, `concurso_comodin` y `concurso_elegir` (50/50, sin IA). Solo el servidor llama a `concurso_reservar` → IA → `concurso_resolver` (o `concurso_liberar` si la IA falló). Así el alumno nunca ve la referencia antes de contestar ni puede ponerse «correcto».
- **Topes (decisión de Juan, 7 nov): 20 llamadas por alumno y día, 1.000 en toda la app por día.** Al llegar, «vuelve mañana» sin llamar a Gemini. Peor caso ≈ 0,13 $/día ≈ 4 $/mes. Es el tope de verdad; el presupuesto de Google se configura también, como segunda red.
- Pendiente: la vista del profe (otra migración) e incluir `concurso_jugadas` en la descarga de datos.

**Función del servidor: `supabase/functions/concurso-evaluar/index.ts`** (Edge Function de Supabase, escrita 7 nov, sin desplegar). Única pieza que conoce la clave (secreto `GEMINI_API_KEY`; `GEMINI_MODEL` opcional). Verifica el token del alumno, valida 3–200 palabras, llama a `concurso_reservar` → Gemini → `concurso_resolver`; si Gemini falla, `concurso_liberar` y 503. Errores para el front: `vuelve_manana` (429), `muy_corta`/`muy_larga` (400), `ia_no_disponible` (503), `sesion` (401). Probada contra Gemini 2.5 Flash-Lite con 7 respuestas del *Signo* (7 nov): veredictos bien, el intento de «ignora las instrucciones» sale «no», 0 tokens de razonamiento, ~620 de entrada y ~20–70 de salida (≈ 0,0001 $ por evaluación), menos de 1 s.

Desplegada en producción y en pruebas (7 nov) con `npx supabase@2.121.0 functions deploy concurso-evaluar --project-ref <ref> --use-api` y los tokens de `.env.esquema.local` (`SUPABASE_ACCESS_TOKEN` producción, `SUPABASE_ACCES_TOKEN_PRUEBA` pruebas; caducan a los 30 días). Clave de Gemini: proyecto de Google «Inmersia Concurso» con su cuenta de cobro prepago (5 €, sin recarga automática), restringida a la Gemini API.

**Front (7 nov, sin commit):** `components/lector/Concurso.jsx` (foco + tarjeta/hoja), `hooks/useConcurso.js`, `utils/concurso.js` (+ pruebas), `styles/concurso.css`; dos líneas en `Lector.jsx` y `LectorMobile.jsx`. Salta al intentar pasar la página donde está la frase (como `interceptForward` de las ilustraciones): no toca la paginación, el foco se dibuja encima buscando la frase en los `<p data-parrafo-id>` con un Range del DOM. «Ahora no» = no vuelve a saltar en esa sesión. Pendiente: pestaña del concurso en el Cuaderno, vista del profe, descarga de datos.

Lo decidido:
- La IA recibe la frase, el contexto, la referencia, la rúbrica y la respuesta del alumno (200 palabras como máximo). Devuelve JSON: `{"veredicto":"pego|casi|no","explicacion":""}`. Con `pego` la explicación va vacía; con `casi` o `no` tiene como mucho unas 40 palabras, le habla al alumno de tú, señala la pista del texto y no regaña.
- **Siempre el modelo más barato disponible** con **razonamiento al mínimo** (decisión de Juan, 7 nov: juzgar una frase no pide pensar) y tope de tokens de salida. La 2.5 Flash-Lite ya no se puede usar en proyectos nuevos de Google: la función prueba `gemini-3.1-flash-lite` y, si Google lo retira, pasa a `gemini-3.5-flash-lite` (`thinkingLevel: 'minimal'`, que aceptan las dos). Con la 3.1 cada evaluación ronda 0,00025 $ (~650 de entrada + ~60 de salida): 1 $ ≈ 4.000 evaluaciones. El tope de 1.000 al día daría hasta ~7 $/mes en el peor caso, pero el prepago de 5 € corta antes.
- La respuesta del alumno va marcada como texto a evaluar, nunca como instrucciones. Si la IA devuelve algo que no cumple el formato o se pasa de largo, la app enseña el veredicto con la referencia y descarta la explicación.
- Con 50/50 no se llama a la IA: el resultado se sabe solo.
