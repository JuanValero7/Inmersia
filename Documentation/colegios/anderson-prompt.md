# Método Anderson — prompt y reglas (v2, 6 nov 2026)

Sale de las pruebas con *El signo de los cuatro* y *Noches blancas*. Vale para cualquier libro.

**Dónde vive el juego de cada libro:** en la carpeta del libro, no en Inmersia: `Documents/<libro>/anderson/anderson.json` (lo que sale de este prompt), `anderson.compilado.json` (lo que se sube) y `maqueta.html` (para jugarlo). Se sube con `Documents/scripts ficcion/cargar_anderson.py`.

## 1. Prompt

```
Eres profesor de Lengua de secundaria y preparas un juego de comprensión lectora para
alumnos con lectura media-baja. Trabaja sobre el texto completo de «{LIBRO}», adjunto
abajo y dividido en capítulos.

PASO 1 — Personajes y perfiles
Elige los {X} personajes más importantes. Para cada uno da:
- aparece: el primer capítulo en que el lector sabe quién es, aunque todavía no haya
  salido en escena. Un nombre suelto, sin saber quién es, no cuenta.
- perfil: entre 3 y 7 puntos. Menos puntos si el personaje sale poco o tarde.
Cada punto:
- Es una frase corta y sencilla que empieza por el nombre del personaje y que un chico de
  13 años entiende sin diccionario. Ejemplo: "Harvey es mimado y arrogante".
- Dice cómo es, qué quiere o por qué actúa como actúa.
- Trata un tema distinto de los demás puntos del personaje. Si dos puntos hablan de lo
  mismo (el dinero, una persona, una relación), júntalos en uno.
- No contradice a otro punto, salvo que sea un cambio.
- Si el personaje cambia a lo largo del libro, un punto cuenta ese cambio
  (es_cambio: true, y en parte_de el id del punto del que parte).

PASO 2 — Pasajes
Para cada punto, al menos 3 pasajes que lo sostengan:
- El personaje hace, dice, piensa o deja de hacer algo. Nunca un narrador ni otro
  personaje diciendo el rasgo.
- Ninguno basta solo: el rasgo se ve al juntarlos.
- De escenas distintas. Mejor momentos claros que sutiles o irónicos.
- Si el punto es un cambio, sus pasajes son posteriores al momento en que cambia.
- Sin destripar: solo pasajes del capítulo "aparece" en adelante. Ni la cita ni el
  resumen pueden contar algo que el lector todavía no sabe en ese capítulo (quién lo
  hizo, una identidad escondida, lo que se revela después).
- Que no se amontonen: si el libro lo permite, ningún capítulo junta más de la mitad de
  los pasajes de un personaje. Nunca adelantes un pasaje para repartirlos mejor.
Para cada pasaje da:
- capitulo: el número de capítulo
- cita: el texto exacto del libro, de 1 a 3 oraciones, sin cambiar ni una palabra
- resumen: una frase corta y neutra que dice qué pasó, sin interpretar ni nombrar el
  rasgo. Bien: "Harvey le ofrece dinero a Troop". Mal: "Harvey intenta comprar a Troop
  porque es arrogante".

PASO 3 — Revisión cruzada
Repasa cada pasaje y pregúntate: ¿un alumno, con el libro en la mano, podría defender que
este pasaje también apoya otro punto del mismo personaje? Si la respuesta es sí, anota ese
punto en "tambien". Reglas:
- Dos puntos comparten como mucho 2 pasajes. Si comparten más, júntalos o cambia pasajes.
- Si un pasaje apoya 3 o más puntos, es demasiado general: cámbialo.

PASO 4 — Señuelos
Por personaje, {M} pasajes reales que solo engañan a quien lee por encima: parecen
apoyar una de las conclusiones falsas del paso 5. Con el libro en la mano, ninguno se
puede defender como prueba de un punto verdadero del personaje; si se puede, no es un
señuelo. Explica en una línea qué lectura por encima provoca.

PASO 5 — Conclusiones falsas
Por punto, 2 conclusiones falsas:
- Que no se distingan del punto verdadero por cómo están escritas: las tres empiezan
  por el nombre y miden parecido. Si la correcta es la única larga o la única sin el
  nombre, el alumno acierta sin pensar.
- Una es la lectura por encima (tipo "por_encima"); la otra, algo distinto pero creíble
  (tipo "otra").
- Las dos salen de las mismas pistas del punto: cada una es lo que concluiría alguien que
  lee esas pistas por encima. Una falsa que no se apoya en ninguna de las pistas no vale.
- Nada de exageraciones que se descartan solas: sin "todos", "siempre", "nunca", "odia"
  ni maldades de caricatura.
- Una de las falsas es un rasgo cercano pero distinto (tímido en vez de frío, desconfiado
  en vez de observador).
- Que no todas apunten en la misma dirección: si la correcta es positiva, al menos una
  falsa también lo es, y al revés.
- La correcta no repite palabras de los resúmenes de las pistas, si las falsas no lo hacen.
- Prueba final: tapa las pistas y lee solo las tres opciones. Si así se adivina cuál es la
  correcta, cambia las falsas.
- El libro las desmiente. Di en una línea qué parte del libro lo hace. Si una falsa se
  puede defender con el libro, cámbiala.

Devuelve SOLO JSON:
{"personajes":[{"id":"","nombre":"","corto":"","aparece":0,
  "perfil":[{"id":"","punto":"","es_cambio":false,"parte_de":"",
    "falsas":[{"texto":"","tipo":"por_encima|otra","la_desmiente":""}],
    "pasajes":[{"id":"","capitulo":0,"cita":"","resumen":"","tambien":[""]}]}],
  "senuelos":[{"capitulo":0,"cita":"","resumen":"","engana_hacia":"","por_que":""}]}]}
```

## 2. Lo que comprueba el script (no se le pide a la IA)

- Cada cita está literal en el capítulo que dice, y una sola vez en el libro. Se le añade el párrafo, que es donde la pista llega al leer.
- Cada punto tiene al menos 3 pasajes, contando los que lo apoyan por `tambien`.
- Dos puntos no comparten más de 2 pasajes, así un mismo trío nunca abre dos deducciones.
- Ningún señuelo aparece en un punto ni en un `tambien`.
- Ningún pasaje es anterior al capítulo en que aparece su personaje.
- Reparto: en qué capítulo se puede armar cada punto (el de su tercer pasaje) y cuántas pistas nuevas trae cada capítulo por personaje. Es solo un aviso: si el libro cuenta a un personaje al final (como Small), se acepta.
- El cambio se arma también con la deducción de la que parte (2.º nivel).

## 3. Reglas del juego

- **Una pista puede servir a varias deducciones.** Un trío es correcto si las tres pistas están en una misma deducción pendiente.
- **Una pista solo desaparece cuando ya no le queda nada por probar.** Si después de usarla todavía sirve a otra deducción pendiente, se queda en la lista.
- **Un personaje entra en la mesa cuando aparece en el libro**, nunca antes: su chip, su ficha y sus pistas no existen hasta ese capítulo.
- **Lo que sobra desaparece de la lista.** Si una pista podía llenar un rasgo, pero ese rasgo ya se llenó con otras, sale de la lista y pasa a la ficha como prueba extra («+N pistas más lo confirman»). Solo se queda en la lista si todavía sirve a otro rasgo pendiente.
- **Las parejas correctas se marcan.** Si en un trío fallido dos pistas sí van juntas, el juego te las marca y la marca se queda en la lista hasta que armes esa deducción. Así no se olvidan cuando hay muchas pistas.
- «No encajan juntas» queda para cuando ninguna pareja del trío va junta.
- **Quedarse sin ovillos es parte del juego.** Cada intento cuesta 1 y no hay regalo al terminar el libro.
- **El aviso al empezar cada capítulo** es la ayuda para recordar: dice cuántas pistas sin alinear tienes y de qué personajes son las nuevas.
- **Premio por perfil al día: 3 ovillos por cada rasgo armado** desde el último cobro. Se cobra cada vez que el perfil queda al día con lo leído. No hace falta calcular la combinatoria: armar un perfil al azar costaría entre 75 y 550 ovillos, y con 10 de partida y 2 por capítulo nadie llega a tenerlos.
- **Al terminar el libro se muestran las deducciones que faltaron,** con sus pistas, como cierre.

## 4. Lo que ve el profe

- Por alumno y por deducción: **cuántos intentos** le costó, o que no la armó. Se separan dos cosas:
  - **juntar las pistas** (intentos con «no encajan» o «casi»). Se vuelve más fácil a medida que se gastan pistas, así que va con cuántas pistas había en la mesa en ese momento;
  - **elegir la conclusión** (A, B o C). No se vuelve más fácil por descarte, porque las opciones son las mismas: es la señal más honesta de comprensión.
- **Una muestra breve de los fallos,** en llano. Por ejemplo: «Eligió "Holmes es perezoso" (lectura por encima)» o «Usó el señuelo "un boxeador le dice que desperdició su talento"». Sale de `falsas.tipo` y del `por_que` de los señuelos.
- No se mide cuándo la armó ni hay semáforo.
- Nunca se le muestra nada que el alumno haya escrito en privado (en Anderson no se escribe nada).
