# Evaluación sigilosa en Inmersia — cómo lo haríamos

> Documento de idea, 5 nov 2026. No es para construir todavía: es para saber qué implica cada parte.
> Origen: un director dijo que a Inmersia «le faltaba la parte analítica cognitiva del estudiante».

## Punto de partida

**Principio (Valerie Shute, *stealth assessment*):** el alumno juega; el sistema recoge evidencia de cómo lee sin que él sienta que lo evalúan. Se piensa en tres capas:
1. **Qué quiero saber** (competencias)
2. **Qué hace el alumno que me lo demuestra** (evidencia)
3. **Qué actividad provoca esa acción** (el juego)

**Marco: PISA (lectura).** Organiza la evidencia en los tres procesos de lectura de PISA:

| Proceso PISA | En llano |
|---|---|
| **Localizar información** | encontrar lo que el texto dice |
| **Comprender** (literal + inferencias) | entender lo que dice y lo que no dice pero se deduce |
| **Evaluar y reflexionar** | juzgar el texto: ironía, intención, forma, opinión fundamentada |

**Inmersia no pone nota.** Da la evidencia ordenada por proceso y el profe decide cómo evaluar.

**Las mecánicas:**
- **La timba**: apostar fichas a lo que va a pasar.
- **El método Anderson**: pistas → deducciones → asociadas a personajes, inspirado en el tablero de casos de Saga en Alan Wake 2.
- **El concurso**: pantalla negra, «¿qué quiso decir aquí?», con comodines.
- **Expedientes** de autor y época que se compran con fichas.
- *El veredicto queda aparcado: Juan le va a dar una vuelta.*

**Pieza común a todo:** un **registro único de evidencias**. Cada mecánica escribe ahí una fila con alumno, libro, capítulo, mecánica, proceso PISA, resultado, fichas apostadas y tiempo. El panel del profe solo lee de ahí. Si este registro está bien diseñado, añadir una mecánica nueva no obliga a tocar el panel.

---

## 1. El pipeline de contenido (lo más difícil)

Cada libro necesita apuestas, casos de Anderson con sus pistas, frases para el concurso y expedientes. Se generaría con IA, igual que hoy la cartelera, pero aquí **un error cuesta caro**: si una respuesta correcta está mal marcada, el chico que acertó pierde fichas y el profe ve evidencia falsa.

### Con qué contamos ya
- `capitulo_XX.txt` por libro y `book_analysis.json` (personajes, lugares, capítulos).
- `extraer_cartelera.py` (Gemini 2.5 Flash): **fase 1** por capítulo sin contexto y **fase 2** de consolidación con el libro entero. Es exactamente el patrón que hace falta.
- `cartelera_items` con hechos, personajes y lugares por capítulo: son pistas y línea de tiempo casi gratis.
- `parrafos` en la base de datos, para anclar cada pista a un párrafo concreto.
- `costos.py` para medir cuánto cuesta cada libro.

### Qué hay que generar, mecánica por mecánica

**La timba** (dificultad media)
- 1 o 2 apuestas por capítulo: pregunta, 3 opciones, cuál es la correcta y **en qué capítulo se resuelve** (siempre uno posterior).
- La pregunta se escribe conociendo el libro entero, pero tiene que poder **intuirse con lo leído hasta ese punto**. Si no, es pura suerte y la evidencia no vale.
- Algunos capítulos no dan para apostar, y está bien: no hay que forzar.

**El método Anderson** (la más difícil)

Estructura, igual que en el juego:
- **Caso**: una pregunta grande del libro, por ejemplo «¿Por qué cambia Harvey?» o «¿Qué esconde el arcipreste?».
- **Huecos**: 2 a 4 subpreguntas dentro del caso.
- **Pistas**: fragmentos literales del texto que encajan en cada hueco, más **pistas señuelo** que son reales pero no encajan, para que no se resuelva por eliminación.
- **Deducción**: el caso completo da una conclusión, que muchas veces es una predicción que el libro confirma más adelante.
- **Perfil**: las deducciones se pegan a un personaje (motivo, secreto, rasgo) y así se arma su ficha.
- **Línea de tiempo**: ordenar hechos de la cartelera. En libros lineales es memoria de secuencia; en libros con saltos de tiempo es comprensión de verdad.

Se genera **de arriba abajo**: primero, con el libro entero, los 3 a 6 casos; después, para cada caso, las pistas que el libro va dejando antes de revelarlo; al final, los señuelos.

**El concurso** (dificultad media; lo caro está en la app, no aquí)
- 0 o 1 frase por capítulo, elegida por sintaxis difícil, vocabulario antiguo, figura retórica o **ironía**.
- Una preselección se puede hacer **sin IA**: frases largas, palabras poco frecuentes, subordinadas. La IA elige entre esas candidatas.
- Por cada frase: interpretación de referencia, **qué cuenta como «la pegó» y qué como «casi»** (una pequeña rúbrica) y las dos opciones del 50/50.
- El contexto ampliado del comodín sale gratis: son los párrafos de alrededor.

**Expedientes** (fácil)
- Van por autor, no por libro, así que se reutilizan. Pocos y cortos.

**Etiquetas para todo:** proceso PISA y una dificultad estimada.

### Cómo se valida sin revisarlo todo a mano
1. **Citas literales comprobadas por código.** Cada pista se busca palabra por palabra en el `.txt`. Si no aparece, se descarta: la IA a veces inventa citas y esto lo detecta gratis.
2. **Comprobación de spoilers por código.** Cada pista se desbloquea antes del capítulo que resuelve su caso, y cada apuesta se resuelve después del capítulo donde aparece.
3. **El «lector ciego».** Otra llamada a la IA recibe solo la pregunta y las pistas hasta ese capítulo:
   - si **con** pistas no puede resolverlo, el caso es injusto;
   - si **sin** pistas lo resuelve, es demasiado fácil.
4. **Revisión humana rápida.** Una página sencilla, del estilo de tus maquetas en HTML, con «aprobar / descartar / editar» por elemento. El objetivo es 20–30 minutos por libro, no una tarde.
5. **Después, con datos reales.** Con 30 alumnos o más, cada elemento se marca solo:
   - si lo acierta casi todo el mundo, es demasiado fácil;
   - si no lo acierta nadie, probablemente está mal hecho;
   - si lo aciertan igual los buenos lectores que los que no, no sirve para distinguir.

   El contenido mejora con el uso.

### Metodología sencilla
1. **Un libro a mano primero.** Eliges un libro corto del plan lector (el Lazarillo es ideal por la ironía) y armamos juntos, en conversación, el set ideal: apuestas, 3 casos y 10 frases. Ese es el «patrón oro».
2. **Prompts que lo reproduzcan.** Siguiendo tu regla con Gemini: guiar el razonamiento en el prompt, modo JSON y presupuesto de razonamiento; sin dividir en tandas y sin Pro. Se compara lo generado con el patrón oro.
3. **Tres libros distintos**: uno de misterio o aventura, uno clásico raro y uno sin trama de misterio (Bambi o El Principito). Ahí sabremos si Anderson funciona fuera de los libros «de detectives».
4. **Medir costo y tiempo de revisión por libro** y recién entonces escalar.

### Dudas
- **¿Quién revisa?** ¿Tú solo, o un profe de lengua como colaborador? Un profe del colegio piloto revisando su libro es también una forma de que se involucre.
- **¿Todo el catálogo o solo los libros del plan lector o asignados a un aula?** Recomendación: solo libros de aula al principio.
- **Libros de no ficción:** Anderson casi no aplica. ¿Solo timba y concurso?
- **Libros partidos en temporadas** (más de 300 páginas): los casos tienen que cerrarse dentro de cada temporada.
- **¿Cuántas apuestas por capítulo?** Pocas y buenas mejor que muchas y flojas.

### Dificultades
- **Anderson en libros sin misterio.** Hay que reformular los casos como «por qué» y «qué cambió» en vez de «quién lo hizo». Es donde la calidad más va a variar.
- **Anclar las pistas.** Si se vuelve a subir un libro, los ids de los párrafos cambian. Conviene anclar por **capítulo + número de párrafo + cita**, no por id.
- **Ambigüedad.** Una buena pregunta de inferencia a veces tiene dos respuestas defendibles. El lector ciego y la revisión humana tienen que detectarlo.
- **Castellano antiguo** (Lazarillo, Quijote): la IA entiende bien, pero las citas literales con grafías raras complican la búsqueda exacta.

---

## 2. Cómo meter los juegos sin que la página se vuelva pesada

### Con qué contamos ya
- Todas las pantallas grandes (Cartelera, Álbum, Panel del colegio…) ya se cargan **solo cuando se abren** (`lazy` en `App.jsx`).
- La tira de fin de capítulo (`TiraPrediccion.jsx`) es el lugar natural de la timba y ya existe.
- Hay una regla tuya: **nada puede sumar al tiempo de carga del capítulo**.

### Sugerencias
- **Cero kilobytes nuevos en el lector al abrir.** Cada juego es un trozo de código aparte que se descarga cuando el alumno lo toca, igual que las pantallas de hoy.
- **Los datos llegan después del capítulo.** Primero se ve el texto. Cuando el navegador está libre, se pide en una sola consulta pequeña lo de ese capítulo: apuesta, frase del concurso y pistas presentes. Nunca el libro entero.
- **Anderson vive fuera del lector**, como pantalla propia junto a la Cartelera. Dentro del lector solo hay un aviso discreto de «nueva pista», como la nota de «Nuevo en la investigación».
- **Recoger pistas subrayando.** Si el alumno subraya un párrafo que tiene pista, se la lleva. No hace falta construir nada nuevo en el lector, solo una comprobación al guardar el subrayado.
- **Guardar evidencia sin bloquear.** Las filas del registro se envían en segundo plano y nunca frenan el paso de página.
- **El concurso es lo único que llama a una IA en vivo,** y solo cuando el alumno envía su respuesta. Mientras la IA piensa, se muestra una animación de concurso («el jurado delibera…»): el drama tapa la espera.
- **Tablero de Anderson ligero:** los hilos entre pistas en SVG o CSS, sin librerías de gráficos. En móvil, **tocar pista → tocar hueco** en lugar de arrastrar: es más ligero y más cómodo con el pulgar.
- **Encender solo para aulas al principio.** Los juegos aparecen en libros asignados a un aula, así el riesgo y el contenido necesario se mantienen pequeños.

### Metodología sencilla
1. **Medir antes:** tamaño del código del lector y tiempo de apertura de un capítulo, hoy.
2. **Presupuesto:** el lector no crece al abrir; cada juego, por debajo de un tamaño fijo acordado.
3. **Construir y volver a medir con las mismas pruebas.** Si algo empeora, no entra.

### Dudas
- ¿Los juegos también para lectores normales, fuera de colegios? Es más alcance y más contenido.
- ¿El concurso necesita conexión sí o sí? Sí: sin internet no hay IA. ¿Qué ve el alumno si falla? Probablemente «guardamos tu respuesta, el jurado contesta luego».

### Dificultades
- **El lector es la parte más delicada de la app.** Tocarlo lo mínimo: tira de fin de capítulo, pantalla negra del concurso y comprobación del subrayado. Nada más.
- **Trampas desde el navegador.** Las fichas y los resultados se calculan **en la base de datos** (funciones seguras), nunca en el navegador; si no, cualquiera se da fichas.
- **Costo de la IA del concurso:** pequeño por respuesta con un modelo barato, pero hay que vigilarlo con `costos.py` o algo parecido.

---

## 3. Experiencias que no sean antipáticas ni invasivas

### Reglas de oro
1. **Siempre se puede saltar, sin castigo.** Saltar no quita fichas.
2. **Nunca interrumpir a mitad de una escena.** Solo en pausas naturales: fin de capítulo, cambio de escena o al cerrar el libro.
3. **Topes fijos:** como mucho 1 concurso por capítulo y 1 aviso de pista por página.
4. **Equivocarse es divertido, no humillante.** Nada de cruces rojas ni «incorrecto»; un tono de juego («casi te sale»), y el gato lo celebra o lo lamenta.
5. **Las fichas nunca llegan a cero del todo.** Hay un mínimo o una pequeña renta, para que nadie quede fuera del juego y se aburra.
6. **El juego no puede competir con el libro.** Si alguien solo quiere leer, el juego tiene que poder ignorarse por completo.

### Cómo se vive cada una
- **Timba:** en la última página del capítulo, la tira de hoy cambia a «¿Qué crees que pasará? Apuesta». Hay 3 opciones y una barra para elegir cuántas fichas. Cuando llega el capítulo que lo resuelve, aparece un aviso breve: «¡Acertaste! +40».
- **Anderson:** al leer, una pista se nota sutilmente o se recoge subrayando. Desde fuera del lector se entra al tablero. Al completar un caso hay un momento especial: la deducción se «revela» y se pega al personaje. *Idea:* si completas una deducción **antes** de que el libro la confirme, puedes apostar fichas por ella, y así la timba y Anderson se alimentan entre sí.
- **Concurso:** la pantalla se apaga y aparece la frase iluminada. Hay comodines, una respuesta escrita (el audio después) y el veredicto. **El gato puede ser el presentador**: ya es tu guía en la app.
- **Expedientes:** en la cartelera, sobres cerrados que se abren con fichas.

### Metodología sencilla
1. **Maqueta** de cada experiencia con `/mockup`, primero en móvil, que es donde leen los chicos.
2. **Prototipo con datos falsos** de un libro que conozcas.
3. **Probar con 3 a 5 chicos de verdad** mientras los miras jugar sin explicarles nada. Lo que no entienden solos, se cambia.
4. Recién entonces se construye de verdad.

### Dudas
- ¿Cómo aprende el chico las reglas? ¿Una fase nueva del onboarding o aprender jugando la primera vez?
- ¿La timba se juega sola o con la clase? Las «cuotas» de la clase eran parte de la idea original.
- ¿Las fichas son por libro o globales? Por libro es más sencillo; globales permiten llevarse algo de un libro a otro.
- ¿Se ve el saldo de fichas de los compañeros? Ojo con los rankings.

### Dificultades
- **Anderson en móvil.** Un tablero con hilos en una pantalla de 6 pulgadas es el mayor reto de diseño de todo el proyecto.
- **Encontrar la frecuencia justa.** Si hay demasiado, vuelve a ser tarea; si hay muy poco, no hay evidencia. Solo se sabe probando.

---

## 4. Que se vea lindo y que cada decisión tenga su porqué pedagógico

### Que se vea lindo
- **Anderson encaja de forma natural con la cartelera**, que ya es un corcho con chinchetas y notas (`TableroNotas`). Bastan hilos rojos entre notas y la foto del personaje en el centro. Es el mismo mundo visual, no una pantalla extraña.
- **Concurso:** fondo negro y foco de teatro sobre la frase, con la estética de papel y de plastilina de Inmersia en los comodines.
- **Fichas:** que no parezcan de casino. Fichas propias de Inmersia (¿con la cara del gato?).
- **Sonido:** pequeños efectos de acierto, de pista encontrada y de caso resuelto, reutilizando lo que ya sabes hacer con los sonidos.
- **Nombre público de Anderson:** «método Anderson» funciona como nombre interno. Hacia afuera, mejor un nombre propio de Inmersia que no dependa de Alan Wake.

### El porqué pedagógico (la columna vertebral)
Hay una base muy sólida: la **enseñanza recíproca** (Palincsar y Brown, 1984), uno de los métodos de comprensión lectora más estudiados. Enseña **cuatro estrategias**, y tus mecánicas encajan casi una a una:

| Estrategia | Mecánica | Proceso PISA | Respaldo |
|---|---|---|---|
| **Predecir** | La timba | Comprender (inferencia) | Enseñanza recíproca |
| **Preguntar y resumir** | El método Anderson | Localizar + Comprender | Enseñanza recíproca; red causal de la narración (Trabasso y van den Broek, 1985) |
| **Clarificar** | El concurso | Comprender + Evaluar (ironía) | Enseñanza recíproca; autoexplicación y paráfrasis (Chi) |
| — | Fichas apostadas | Metacognición | «Calibración de la comprensión» (Glenberg y Epstein, 1985): muchos lectores creen entender lo que no entienden, y la apuesta lo hace visible |
| — | Todo el sistema | — | *Stealth assessment* (Shute, 2011) y diseño centrado en la evidencia (Mislevy, 2003) |

*(Verificar las referencias exactas antes de publicarlas.)*

### Cómo se explica
- **Para el profe, dentro del panel:** cada indicador lleva un «¿por qué?» de una línea. Por ejemplo: «Predecir es una estrategia clave de comprensión; aquí ves cuántas predicciones acertó y cuán seguro estaba».
- **Para el director, antes de la reunión:** una página «Cómo lee Inmersia» con una tarjeta por mecánica: **qué hace el alumno, qué proceso PISA muestra, qué ve el profe y qué NO ve nunca**. Esa última parte vende confianza.
- **Para el alumno:** nada. Él juega.

### Metodología sencilla
1. **Primero la ficha pedagógica de cada mecánica**, antes de la UI. Guía todas las decisiones de diseño.
2. **Validarla en 30 minutos con un profe de lengua real.** ¿Le sirve lo que vería? ¿Lo entiende sin explicaciones?
3. **Después, el diseño visual** de las experiencias, que ya tienen claro qué tienen que mostrar.

### Dudas
- **«Escala PISA»:** usar los **procesos** de PISA para ordenar la evidencia es sólido. Decir «este alumno está en nivel PISA 4» **no**: esos niveles salen de una prueba calibrada con miles de alumnos y un director informado podría cuestionarlo. Propuesta: procesos PISA sí; niveles como mucho «orientativos» o directamente fuera.
- ¿Las referencias académicas van a la vista del profe o solo en el documento para directores?

### Dificultades
- **Demostrar que mide de verdad.** Al final, un director querrá saber si un alumno al que le va bien en Inmersia comprende mejor. Eso solo lo responde el piloto, comparando con una prueba tradicional del colegio.

---

## Resumen de dificultad

| | Pipeline | Ligereza | Experiencia | Pedagogía/visual |
|---|---|---|---|---|
| **Timba** | Media | Fácil (ya hay sitio) | Fácil | Fácil |
| **Anderson** | **Muy difícil** | Media | **Difícil (móvil)** | Media |
| **Concurso** | Media | Media (IA en vivo) | Media | Fácil |
| **Expedientes** | Fácil | Fácil | Fácil | Fácil |

Anderson es lo más difícil en todo y también lo más divertido. Sugerencia de orden para cuando toque: **registro de evidencias → timba** (prueba todo el circuito con poco riesgo) **→ Anderson con un solo libro hecho a mano → concurso**.
