# Corazonadas — prompt y reglas (v1, 7 nov 2026)

Vale para cualquier libro de ficción. Primera prueba: *El signo de los cuatro* y *Noches blancas* (los mismos de Anderson).

**Qué es una corazonada:** mientras lee, el alumno encuentra un chip en un momento de suspenso. Si lo toca, el gato le enseña una pregunta con tres opciones y le invita a jugarse 1, 2 o 3 ovillos. Más adelante, en el párrafo que lo resuelve, aparece un corazón: lo toca cuando quiera y cobra (o pierde).

**Dos clases, por si se pueden deducir o no:**
- **Deducible:** un lector atento podía llegar a la respuesta con lo ya leído. Es la que mide inferencia y la que cuenta para el profe.
- **Sorpresa:** el libro gira y no se podía ver venir. Da juego, pero no dice nada de la comprensión del alumno, así que no cuenta como acierto.

**Dos tipos de pregunta:**
- **¿Qué va a pasar?** (`que_pasara`): un hecho que todavía no ocurrió.
- **¿Qué está pasando de verdad?** (`que_pasa`): algo que ya es cierto pero el lector no sabe (por qué alguien hizo algo, qué esconde, qué siente, quién fue).

**Dónde vive el juego de cada libro:** `Documents/<libro>/corazonadas/corazonadas.json`, como Anderson.

## 1. Prompt

```
Eres profesor de Lengua de secundaria y preparas un juego de lectura para alumnos con
lectura media-baja. Trabaja sobre el texto completo de «{LIBRO}», adjunto abajo y
dividido en capítulos.

El juego: mientras lee, el alumno encuentra un aviso en un momento de suspenso. Si lo
toca, ve una pregunta con tres opciones y elige la que cree. Más adelante, en el párrafo
que lo resuelve, el libro le confirma si acertó. Se llaman corazonadas.

PASO 1 — Momentos de suspenso
Recorre el libro y anota los momentos en que el propio libro deja abierta una pregunta
que el lector tiene ganas de resolver: alguien tiene que decidir algo, hay una amenaza,
una promesa, una cita, un secreto, alguien que falta, algo que no se explica. Para cada
momento da:
- tipo: "que_pasara" si la respuesta es un hecho que todavía no ha ocurrido;
  "que_pasa" si ya es verdad pero el lector no lo sabe (por qué alguien hizo algo, qué
  esconde, qué siente de verdad, quién fue).
- chip: capítulo y cita exacta (1 a 3 oraciones, sin cambiar ni una palabra) del
  párrafo en el que el lector ya tiene la pregunta en la cabeza y todavía no sabe nada
  de la respuesta.
- revelacion: capítulo y cita exacta del párrafo donde el libro da la respuesta.
Reglas:
- La pregunta la abre el libro, no tú. Si en ese momento el lector no se lo está
  preguntando, no es un momento de suspenso.
- Entre el chip y la revelación hay al menos unas páginas de lectura, y como mucho 3
  capítulos.
- La revelación es clara: al leerla queda en pie una sola respuesta. Si el libro lo
  deja abierto o ambiguo, descarta el momento.
- Nada que se sepa sin leer: ni el título, ni la portada, ni la fama del libro, ni las
  reglas del género (el detective resuelve el caso, el protagonista no muere a la
  mitad) pueden dar la respuesta.

PASO 2 — Deducible o sorpresa
Para cada momento, ponte en la piel de un lector atento que solo ha leído hasta el chip.
- "deducible": ese lector puede llegar a la respuesta con lo que ya leyó (cómo es un
  personaje, lo que quiere, algo que se dijo o se mostró antes, una promesa, un detalle
  que se repite). Da de 1 a 3 pistas previas que la sostienen, todas anteriores al chip:
  capítulo, cita exacta y resumen. El resumen es una frase corta y neutra que dice qué
  pasó, sin interpretar. Bien: "Nastenka dice que la abuela la tiene prendida a su
  vestido". Mal: "Nastenka está desesperada por escapar".
- "sorpresa": el libro gira y no se podía ver venir, o el lector atento pensaría justo
  lo contrario. Di en una línea por qué.
- Si no es ni una cosa ni la otra (la respuesta es un azar, sin pistas y sin giro),
  descarta el momento.

PASO 3 — Elegir
- TOPE POR LARGO (manda sobre todo lo demás): en total, como mucho una por cada
  {PALABRAS_POR_CORAZONADA} palabras del libro (4.500; mínimo 2 en el libro). Si el
  libro tiene muchos capítulos cortos, quedan capítulos sin ninguna.
- De 0 a 2 por capítulo. Mejor ninguna que una
  floja.
- Al menos dos de cada tres son deducibles.
- Mezcla los dos tipos si el libro lo permite.
- Prefiere los momentos centrales de la historia a los detalles laterales.
- Que no se pisen: la pregunta, el contexto y las opciones de una corazonada no pueden
  dar ni quitar la respuesta de otra que siga abierta en ese momento.

PASO 4 — Pregunta, contexto y resultado
Lenguaje que un chico de 13 años entiende sin diccionario.
- pregunta: corta, nombra al personaje y empieza por "¿Qué…", "¿Por qué…", "¿Quién…" o
  "¿Cómo…". Ejemplo: "¿Qué hará Harvey?".
- contexto: una o dos frases neutras que recuerdan lo que acaba de pasar, para que la
  pregunta se entienda sin volver atrás. Solo cosas que el lector ya sabe en el chip.
- resultado: una frase corta con lo que pasó de verdad. Se muestra al cobrar.

PASO 5 — Opciones
Tres opciones: la correcta y dos falsas.
- Las tres tienen la misma forma (mismo sujeto, mismo tiempo verbal) y miden parecido.
  Si la correcta es la única larga o la única con detalle, se acierta sin pensar.
- Las tres son creíbles en el momento del chip: ninguna choca con algo que el lector ya
  sabe. Nada de exageraciones que se descartan solas.
- Se excluyen entre sí: al leer la revelación, solo una queda en pie. Ninguna falsa es
  "en parte" verdad.
- Si es deducible: una falsa es la lectura por encima, lo que elegiría quien no se fijó
  en las pistas previas (tipo "por_encima"); la otra es algo distinto pero creíble
  (tipo "otra").
- Si es sorpresa: una falsa es lo que esperaría el lector atento (tipo "esperada"); la
  otra, "otra".
- Prueba de tapar: lee solo la pregunta y las tres opciones, sin el libro. Si así se
  adivina la correcta, cambia las falsas.
- la_desmiente: en una línea, qué dice la revelación que descarta esa falsa.

Devuelve SOLO JSON:
{"corazonadas":[{"id":"","tipo":"que_pasara|que_pasa","clase":"deducible|sorpresa",
  "pregunta":"","contexto":"","resultado":"",
  "chip":{"capitulo":0,"cita":""},
  "revelacion":{"capitulo":0,"cita":""},
  "correcta":"",
  "falsas":[{"texto":"","tipo":"por_encima|esperada|otra","la_desmiente":""}],
  "pistas_previas":[{"capitulo":0,"cita":"","resumen":""}],
  "por_que_sorpresa":""}]}
```

## 2. Lo que comprueba el script (no se le pide a la IA)

- Cada cita (chip, revelación, pistas previas) está literal en el capítulo que dice, y una sola vez en el libro. Se le añade el párrafo.
- La revelación va después del chip, a no más de 3 capítulos.
- Las pistas previas van antes del chip.
- Reparto: cuántas por capítulo (aviso si un capítulo tiene más de 2) y proporción de deducibles (aviso si es menos de dos tercios).
- Aviso si la correcta es mucho más larga que las falsas.

## 3. Reglas del juego

- **Chip entre párrafos**, justo después del párrafo `chip`. Tocarlo es opcional: si lo ignoras, sigues leyendo.
- Te juegas **1, 2 o 3 ovillos**. Si aciertas, recibes **el doble**.
- **Corazón en el párrafo `revelacion`**: lo tocas cuando quieras y cobras o pierdes.
- **Al cobrar una deducible se muestra «Así se podía saber»** con las pistas previas. Es lo que convierte el fallo en aprendizaje. *(Propuesta.)*
- **Sorpresas: pagan igual, con aviso del gato** antes de jugar («esta es difícil»). Decisión de Juan, 7 nov.
- **Si llegas a la revelación sin jugar, la pierdes.** En cuanto la página con el párrafo `revelacion` está en pantalla, el chip se cierra y no se puede volver atrás a responder. No se pierden ovillos (no había apuesta), solo la oportunidad. Si chip y revelación caen en la misma pantalla (doble página en escritorio), el chip no aparece.
- Que la respuesta llegue en la página siguiente está bien, y que un capítulo no tenga ninguna también.
- Lo que eligió la clase se ve solo al terminar el libro.

## 4. Lo que ve el profe

- **Solo las deducibles cuentan como inferencia:** si acertó y cuántos ovillos se jugó. Acierto con 3 ovillos = lo entendió y lo sabía; acierto con 1 = lo intuyó; fallo con 3 = cree que entiende y no (la señal más útil).
- Una muestra breve de los fallos, en llano: «Eligió "…" (lectura por encima)».
- Las sorpresas no cuentan como acierto ni como fallo.
- No jugar una corazonada no es un dato: no se marca nada.
