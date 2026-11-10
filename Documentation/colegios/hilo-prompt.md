# Hilo de ideas — pistas e ideas por libro (no ficción)

El juego grande de no ficción, el «método Anderson» de los libros que no cuentan una
historia (decisiones de Juan, 10 nov 2026). Maqueta aprobada:
`Documents/Inmersia_maquetas/colegios/maqueta-tablero-noficcion.html`.
Migración `100_hilo_ideas.sql`; en la app, `src/components/hilo/HiloIdeas.jsx` (se abre
desde la carpeta del centro de la Investigación). **Encendido por defecto**.

## Cómo funciona

- **Pistas**: llegan SOLAS al terminar cada capítulo, mezcladas en la mesa (no agrupadas
  por capítulo). Al empezar el capítulo siguiente, el lector avisa: «🧵 Llegaron 4 pistas
  nuevas a tu pizarra». Entre ellas hay **señuelos**: datos ciertos del libro que no van
  en ninguna idea.
- **Ideas**: tarjetas tapadas en una pizarra, unidas por hilos. Una idea se abre cuando
  ya llegaron todas sus pistas (y se abrieron las ideas de las que sale). No dice de qué
  capítulo viene. Cada idea dice si ya puedes armarla o si le falta una idea anterior.
- **SIEMPRE 3 piezas por idea y una sola combinación válida.** Si una idea sale de otra
  ya armada, esa pieza entra sola por el hilo: el lector solo pone pistas.
- Se toca la tarjeta de la idea y luego las pistas que se le suman. Se valida con
  **«Jugar 🧶1»**, como Anderson. Si 2 van juntas → «Casi» y esas quedan marcadas con 🔗.
  Si no → «No encajan». Correcta → la idea se destapa con su conclusión (no hay que
  elegir entre opciones).
- La **conclusión final** se arma sola cuando están las ideas que llegan a ella.
- **Ovillos**: Jugar −1, idea +2, conclusión del libro +5, ayuda −1 (una vez por idea,
  enseña la frase «falta»). Con el libro terminado y sin ovillos, se ven las ideas que
  faltaron.
- La combinación correcta y qué pistas son señuelos **nunca llegan al navegador**: se
  valida en la base de datos.
- El profe ve por alumno: ideas armadas, si llegó a la conclusión, intentos fallidos,
  ayudas y veces que usó señuelos; por idea, cuántos la armaron y dónde se atasca la clase.

Lo escribe Claude leyendo el libro (nunca Gemini) y lo revisa Juan.

## Prompt (para quien lo escribe)

```
Escribes el «hilo de ideas» de «{LIBRO}», de {AUTOR}, para Inmersia (app de lectura;
alumnos de 12 a 15 años). Es un juego de deducción: el alumno recibe pistas (frases
cortas sacadas del libro) y las une de tres en tres en ideas, que se encadenan hasta
llegar a la tesis del libro.

CUÁNTAS
- 10–12 ideas. Una es la CONCLUSIÓN DEL LIBRO (final: "principal"): la tesis, la
  respuesta a la pregunta que se hace el autor. Puede haber UNA conclusión «extra»
  (final: "extra"): una consecuencia que no lleva a la principal.
- 20–30 pistas reales según lo largo del libro, y señuelos ≈ 1 por cada 3 reales
  (Juan: 75 % / 25 %). Todos los capítulos dan alguna pista.

IDEAS
1. SIEMPRE 3 piezas. Una pieza es una pista o una idea anterior. La conclusión
   principal suele salir solo de ideas (3 ideas): se arma sola.
2. Las ideas MEZCLAN capítulos: si las 3 pistas de una idea salen del mismo capítulo,
   el juego se vuelve «3 pistas por capítulo» y es trivial. Solo la primera idea del
   libro puede ser de un capítulo.
3. Se encadenan: las ideas tempranas son las piezas de las siguientes (pizarra de
   izquierda a derecha). Nada de ideas sueltas que no lleven a la conclusión, salvo la
   «extra».
4. Cada idea lleva:
   - pregunta: lo que se ve en la tarjeta tapada. Corta, de chico de 13 años
     («¿Por qué no bastaba con el trueque?»). No adelanta la respuesta.
   - titulo: 2–5 palabras, se ve al armarla («El trueque se atasca»).
   - conclusion: 1–3 frases en llano; lo que entiende el alumno al unir las piezas.
   - falta: la ayuda (cuesta 1 ovillo). Dice QUÉ buscar sin nombrar las pistas
     («Qué acepta cada uno en el trueque y qué tan fácil es encontrar a la persona justa»).

PISTAS
5. Cada pista real va en UNA sola idea (así la combinación es única). Ninguna real puede
   sobrar.
6. t: una frase corta (≤ 22 palabras), en llano, que diga UN hecho o argumento del
   libro. No copia la cita: la traduce.
7. cita: un trozo LITERAL del capítulo (8–30 palabras), copiado letra por letra del
   capitulo_NN.txt, que salga UNA sola vez en el libro. Ubica la pista (no se usa el
   número de párrafo: la numeración del .txt no es la de la base de datos).
8. cap: el capítulo donde está la cita (su final trae la pista).

SEÑUELOS (senuelo: true)
9. CIERTOS: salen del libro, con su cita. Nunca inventados.
10. Tientan: tocan el tema de alguna idea, pero no la explican (un dato curioso, una
    etimología, un ejemplo de color, una opinión de pasada). Si un señuelo encaja de
    verdad en una idea, el juego es injusto: o se cambia o se vuelve pista real.
11. Repartidos por el libro, no todos en el mismo capítulo.

IDIOMA: español neutro con tuteo (nunca voseo).

Devuelve SOLO JSON:
{
  "libro": "<título como en Supabase>",
  "pistas": [{"id": "p01", "cap": 1, "t": "...", "cita": "...", "senuelo": false}, ...],
  "ideas":  [{"id": "Q", "titulo": "...", "pregunta": "...", "piezas": ["p01", "p02", "p00"],
              "conclusion": "...", "falta": "...", "final": null}, ...]
}
```

Los ids no se cambian una vez publicado (las jugadas de los alumnos van por id). Ids
cortos: `p01…` las pistas, `s01…` los señuelos, letras/`N1…` las ideas.

## Comprobador y carga

Desde `Documents/scripts no ficcion/`:

- `PYTHONIOENCODING=utf-8 python verificar_hilo.py "<libro>/hilo/hilo.json"` — 3 piezas
  por idea, cada pista real en una sola idea y los señuelos en ninguna, la cadena no da
  vueltas y todo llega a la conclusión, cada cita literal y única en su capítulo, voseo.
  Avisa si una idea tiene sus 3 pistas del mismo capítulo, si la cuenta de reales o
  señuelos se sale de lo normal o si un capítulo no da pistas. Imprime cuándo se abre
  cada idea.
- `python cargar_hilo.py "<json>" --seco` deja `hilo.compilado.json`; `--pruebas` sube al
  proyecto de pruebas; `--supabase-key …` a producción. Ubica las citas contra los
  párrafos de Supabase: si el libro se volvió a procesar y una cita ya no está, no sube.

Lo que el comprobador no ve (lo revisa una persona): que la conclusión sea de verdad la
tesis del libro, que cada idea se entienda con sus 3 piezas y no con otras, que los
señuelos sean ciertos y no encajen en ninguna idea, que las preguntas no adelanten la
respuesta.

Ejemplo: `Documents/Del origen del dinero - Carl Menger/hilo/hilo.json` (23 pistas
reales + 8 señuelos, 11 ideas).
