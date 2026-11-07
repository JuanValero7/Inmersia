# El mapa del tesoro — prompt y reglas (v1, 7 nov 2026, borrador)

Vale para cualquier libro de ficción. Primera prueba prevista: *El signo de los cuatro*, capítulos 1 y 2.

**Qué es el mapa del tesoro:** al empezar el capítulo, el alumno recibe la lista con todos los tesoros del capítulo (salvo los que serían spoiler, que se suman más tarde). Puede acordarse de ellos o no. Un poco antes de cada tesoro el libro empieza a brillar (la idea de las luces led que quitamos): «ojo, hay un tesoro cerca», y si se le olvidó, abre la lista. Lo encuentra subrayando la frase y eligiendo «Mapa del tesoro» (la otra opción es «Guardar en mi cuaderno»). Sin límite de intentos: +1 ovillo si acierta, −1 cada vez que falla. Los tesoros no se escapan: si los ignora, simplemente no gana (decisiones de Juan, 7 nov). No hace falta volver a leer el capítulo: releer es aburridísimo.

**Dos clases de tesoro:**
- **A la vista** (`vista`): un detalle que el libro dice tal cual. Vale lo pequeño («¿de qué color era la cortina?»): se trata de fijarse (Juan, 7 nov). PISA: *localizar*.
- **Escondido** (`escondido`): una idea que el libro no dice con esas palabras (un sentimiento que no se nombra, un motivo, algo dicho de otra forma). PISA: *comprender*.

**Dónde vive el juego de cada libro:** `Documents/<libro>/mapa/mapa.json`, como los demás juegos.

## 1. Prompt

```
Eres profesor de Lengua de secundaria y preparas un juego de lectura para alumnos de
12 a 15 años con lectura media-baja. Trabaja sobre el texto completo de «{LIBRO}»,
adjunto abajo y dividido en capítulos.

El juego: al empezar cada capítulo, el alumno recibe un mapa con fichas de tesoros.
Cada ficha es una pregunta cuya respuesta está en una frase de ese capítulo. Mientras
lee, un poco antes de cada tesoro el libro brilla para avisar de que hay uno cerca.
Si encuentra la frase, la subraya y la guarda en el mapa: acertar da premio y
fallar cuesta. Tu
trabajo es elegir los tesoros, escribir las fichas y dejar dicho qué frases cuentan
como encontrarlo.

Dos clases de tesoro:
- "vista": un detalle que el libro dice tal cual: un color, una cifra, un nombre, un
  lugar, un objeto, qué hizo alguien. Vale lo pequeño ("¿de qué color era la
  cortina?"): se trata de fijarse.
- "escondido": una idea que el libro no dice con esas palabras. Hay que entender la
  frase para reconocer que es la que lo dice o lo deja ver: un sentimiento que no se
  nombra, el motivo de lo que alguien hace, algo dicho con otras palabras.

PASO 1 — Candidatos
Recorre cada capítulo y anota detalles e ideas que se puedan buscar. Reglas:
- Tiene dónde subrayarse: una frase concreta lo dice o lo deja ver. Si para verlo
  hace falta juntar frases de sitios distintos, no vale.
- Se entiende solo con lo leído hasta ahí, sin saber nada de fuera del libro.
- Los "escondido" importan: un sentimiento, un motivo o un rasgo que pesa en la
  historia. Los "vista" pueden ser pequeños.
- Nada que obligue a hablar de algo inapropiado para un alumno de 12 años.

PASO 2 — Las frases que valen
- respuestas: TODAS las frases del capítulo donde se encuentra, copiadas exactas, una
  oración cada una. La primera es la principal: el brillo se pone alrededor de esa.
  Si el alumno subraya cualquiera de la lista, lo encontró.
- Busca bien: si el detalle se repite en el capítulo, todas las frases van en la
  lista. Una frase buena que falte le quita el tesoro a un alumno que lo encontró.
- Si son más de 3 frases, la pregunta es demasiado abierta: afínala o descártala.

PASO 3 — La ficha
El alumno lee las fichas ANTES de leer el capítulo.
- pregunta: corta (como mucho 20 palabras), de tú.
  · "vista": directa ("¿De qué color es la cortina del cuarto de Nastenka?").
  · "escondido": da la idea con otras palabras y pide la frase que la sostiene
    ("Harvey presume mucho, pero algo le duele. Encuentra la frase que lo deja ver").
- Sin adelantar: la ficha solo usa lo que el lector sabe al acabar el capítulo
  anterior. Mal: "¿Por qué Troop se niega a volver?" si la negativa pasa en este
  capítulo. Bien: "¿Qué le importa más a Troop que el dinero?" si ya sabemos que
  Troop es el patrón. Si hace falta, escribe la pregunta de otra forma
  (spoiler: false).
- spoiler: true solo si no hay forma de preguntarlo sin adelantar algo del capítulo.
  Esa ficha no sale en la lista del principio: se suma unos párrafos antes de la
  frase principal y solo usa lo que el lector sabe en ese punto.
- Prueba de las palabras (solo "escondido"): la ficha no comparte con la frase buena
  ninguna palabra importante, salvo los nombres. Si buscando una palabra de la ficha
  se llega a la frase, no está escondido: pásalo a "vista" o reescríbelo.
- porque (solo "escondido"): una frase de como mucho 25 palabras que el gato dice al
  enseñar el tesoro, explicando por qué esa frase lo dice ("Se le llenan los ojos de
  lágrimas al hablar de su madre: la echa de menos").

PASO 4 — Elegir
- Hasta {N} por capítulo, mezclando "vista" y "escondido" si el capítulo lo permite.
  Mejor 2 buenos que 4 de relleno.
- Separados: entre la frase principal de un tesoro y la del siguiente hay al menos
  una página de lectura, para que cada brillo sea de un solo tesoro.
- Ninguna frase es respuesta de dos tesoros.
- Si te paso las frases del concurso de este libro ({CONCURSO}), no uses ninguna
  como respuesta de un tesoro "escondido": el concurso ya explica qué quieren decir.

PASO 5 — Dificultad
- 1: se encuentra con una lectura atenta.
- 2: hay que fijarse bien o entender una expresión.
- 3: solo lo saca un buen lector.

Devuelve SOLO JSON:
{"tesoros":[{"id":"","capitulo":0,"tipo":"vista|escondido","dificultad":1,
  "spoiler":false,"pregunta":"","respuestas":[""],"porque":""}]}
```

## 2. Lo que comprueba el script (no se le pide a la IA)

`Documents/scripts ficcion/verificar_mapa.py` (deja `mapa.compilado.json` al lado):

- Las respuestas están literales en el capítulo que dice; se les añade el párrafo.
- Ninguna frase es respuesta de dos tesoros; como mucho 3 respuestas por tesoro.
- Calcula el brillo alrededor de la frase principal (dónde empieza y dónde acaba) y avisa si dos brillos se pisan.
- Aviso si un escondido comparte palabras importantes con su frase (la prueba de las palabras, a máquina) y si una respuesta coincide con una frase del concurso o una pista de Anderson del mismo libro.
- Proceso PISA: `vista` = localizar, `escondido` = comprender.

## 3. Reglas del juego (decididas 7 nov)

- **La lista entera al empezar el capítulo**, salvo las fichas con `spoiler: true`, que se suman cuando empieza su brillo.
- **Brillo en todos los tesoros = «ojo, hay un tesoro cerca»**, sin decir cuál. Brilla el borde del libro, no los párrafos; los datos solo dicen entre qué párrafos está encendido. El cargador lo corre un poco al azar para que el centro del brillo no delate la frase. Solo sirve para recordar que el juego está ahí y que el premio está cerca.
- **Puede coincidir con Anderson** (Juan, 7 nov): que una frase sea tesoro y pista de Anderson no molesta. La pista llega justo cuando el alumno lee esa frase, así que no le regala nada que no tenga delante. Empieza unos 5 párrafos antes de la frase principal y sigue unos 5 después. Propuesta sin confirmar: medirlo por largo (≈ media página antes y después) y no por párrafos, porque 5 párrafos de diálogo son pocas líneas.
- **Subrayar:** al subrayar sale «Guardar en mi cuaderno» / «Mapa del tesoro». Con «Mapa del tesoro» se compara con todas las fichas pendientes del capítulo. Si no coincide con ninguna, es un fallo, esté donde esté. Para el profe, un fallo dentro de un brillo se apunta a ese tesoro (por eso un brillo = un tesoro); fuera de los brillos queda como fallo del capítulo. El subrayado actual hay que trabajarlo.
- **Sin límite de intentos** (Juan, 7 nov): acertar +1 ovillo, cada fallo −1. Así subrayar al azar sale caro. Para intentarlo hace falta tener al menos 1 ovillo, como en los otros juegos. El «porque» del gato y dónde estaba solo se ven al encontrarlo.
- **No se escapan:** una ficha ignorada sigue en el mapa; se puede encontrar cuando sea.
- **«Cerca»:** si falla pero subrayó en el párrafo de una respuesta o en el de al lado, el gato lo dice. La palabra la elige Juan (no «caliente»).
- **Sin trampas:** la lista de respuestas es general (cualquier frase que valga, en todo el capítulo).
- **El profe** ve tesoros encontrados de cada tipo y los fallos (de qué tesoro, si estaba en un brillo).

## 4. Base de datos (7 nov)

**Migración 091_mapa_tesoro.sql**: escrita y probada en PGlite con los tesoros reales del *Signo* (29/29). **Sin correr en Supabase.** Se carga con `Documents/scripts ficcion/cargar_mapa.py` (`--seco`, `--pruebas` o `--supabase-key`).
- `mapa_contenido`: los tesoros de cada libro, con las frases buenas. Nadie lo lee directo.
- `mapa_jugadas`: una fila por cada subrayado enviado al mapa (acierto o fallo; el tesoro encontrado o el del brillo; si fue «cerca»). **Nunca guarda lo subrayado.**
- Ovillos en el libro de cuentas común, motivo `tesoro` (+1 / −1).
- El alumno llama a `mapa_libro` (fichas, brillos y lo ya encontrado; nunca las respuestas) y `mapa_subrayar(libro, capítulo, párrafo, texto)`, que devuelve `tesoro`, `ya_encontrado`, `cerca` o `no`.
- Vale si **más de la mitad de lo subrayado** cae en una frase buena (mínimo 3 palabras). Probado: un trozo de la frase, la frase entera, la frase con un poco de más y rayas/espacios distintos valen; el párrafo entero no.
- No cobran: menos de 3 palabras, capítulo sin tesoros pendientes, subrayar uno ya encontrado, texto que no está en el párrafo (`texto_no_coincide`: indica un fallo nuestro de normalización). Sin ovillos no se puede intentar.
- El cargador pone ids opacos y elige el brillo (11 párrafos, de 3 a 7 antes de la frase, fijo por id) sin que dos se pisen.
- **Juan la corrió en producción (7 nov).** En pruebas la aplicó Claude. El *Signo* (8 tesoros, versión 1) está subido en los dos.
- Ojo: `parrafos.numero` en Supabase va **por capítulo** (cada uno empieza en 1). Por eso `textos` usa la clave «cap:párrafo».

## 5. Front (7 nov, sin commit)

- `components/lector/MapaTesoro.jsx` (`useMapaTesoroLector`), `hooks/useMapaTesoro.js`, `utils/mapaTesoro.js` (+ pruebas), `styles/mapa-tesoro.css`. Conectado en `Lector.jsx`, `LectorMobile.jsx`, `BookReader.jsx` (prop `brillo`, y el subrayado avisa del párrafo donde termina), `MobileBookPage.jsx` (prop `brillo`) y `LectorSheets.jsx` (opción del mapa en la hoja de subrayado).
- **Brillo:** el borde del libro (escritorio: la sombra de la antigua luz LED, en dorado y con pulso; móvil: el borde de la página) cuando en pantalla hay un párrafo del tramo de un tesoro pendiente. El botón del mapa brilla a la vez.
- **Lista:** se abre sola la primera vez que se entra en un capítulo con tesoros (se recuerda en el navegador); después vive en el **Cuaderno**, pestaña «Tesoros» (decisión de Juan, 8 nov: el botón suelto junto al Cuaderno era feo, y en móvil la barra se va a llenar con comunidades). El Cuaderno solo enseña los capítulos hasta el que se lee. Cuando el libro brilla, brillan también la entrada al Cuaderno (escritorio) y el gato (móvil), y el Cuaderno se abre directamente en «Tesoros». Las fichas con spoiler se suman al llegar a su tramo.
- **Rendimiento (8 nov):** el brillo es una capa con la sombra fija y solo la opacidad animada (animar la sombra costaba ~210 ms de CPU por segundo; así, 6–10 ms).
- **Subrayar:** «Mapa del tesoro» junto a «Subrayar» (escritorio) y en la hoja de confirmar (móvil), solo si al capítulo le quedan tesoros. Si cruza párrafos o tiene menos de 3 palabras, se explica en vez del botón.
- **Gato (frases de Juan):** «¡Bravo!» (+1) · «Uy, casi» (−1) · «Ehhh, ¿por qué te comportas como un perro escarbando en todos lados?» (−1) · «Ese ya lo tienes». El tesoro escondido enseña su «porque». Los fallos se cierran solos a los 4 s.
- Pendiente: mejorar el subrayado (otra sesión), vista del profe, descarga de datos.

## 6. Pendiente

- La palabra para «cerca» (Juan).
- **Contenido completo (8 nov, hecho por Claude leyendo los libros):** *El signo de los cuatro* 49 tesoros en 12 capítulos y *Noches blancas* 26 en 6, en `Documents/<libro>/mapa/mapa.json`; subidos a pruebas y producción. Siete escondidos se cambiaron porque su frase ya era del concurso (las frases más jugosas suelen coincidir: por eso la regla nueva del paso 4). El comprobador ahora usa el mismo cálculo de brillos que el cargador.
- **Prueba 1 hecha por Claude (7 nov):** *Signo* caps. 1–2, 8 tesoros (4 y 4; 4 vista, 4 escondidos; 2 con spoiler), en `Documents/El signo de los cuatro - Arthur Conan Doyle/mapa/mapa.json`. El script pasa sin errores. Lo que salió:
  - Una ficha con spoiler sale 5 párrafos antes y casi siempre anticipa un poco lo que viene («Holmes toca un tema delicado para Watson»). No resuelve nada, pero anticipa. ¿Se acepta «anticipar sin resolver»?
  - El brillo de 5 párrafos en el *Signo* va de 246 a 554 palabras (párrafos largos). En libros con mucho diálogo será mucho más corto.
