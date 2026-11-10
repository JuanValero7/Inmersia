# El falsificador — párrafos por libro (no ficción)

Segundo juego de no ficción (decisiones de Juan, 10 nov 2026). Maqueta aprobada:
`Documents/Inmersia_maquetas/colegios/maqueta-falsificador-noficcion.html`.
Migración `099_falsificador.sql`; en la app, `src/components/lector/Falsificador.jsx`.
Apagado por defecto (también en las aulas): se enciende desde el Perfil o el profe.

## Cómo funciona

- En el libro hay **8 párrafos sospechosos, mitad y mitad**: 4 los escribió Claude
  imitando al autor (los **falsos**, que el lector mete en el capítulo) y 4 son del libro
  (los **reales**). Un capítulo, un sospechoso (si el libro es corto, menos).
- Igual que el concurso: al intentar pasar la página donde está el párrafo se apagan las
  luces, cae un foco sobre él y sale la tarjeta: «¿Quién escribió este párrafo?» →
  «Lo escribió <autor>» o «Lo coló el gato». Si sigue en la página siguiente, «Leer el
  resto» la muestra con las luces apagadas.
- **Sin «Ahora no»**: si el falso se queda sin responder, el alumno se queda con una
  mentira. Acierto **+1 ovillo**, fallo **−1** (si tiene alguno).
- El veredicto revela todo. Falso: «Lo raro: …» y «Lo que dice el libro: …». Real: lo que
  dice el autor ahí. Al volver, el falso queda **tachado con el sello LO COLÓ EL GATO**
  para siempre. El real no lleva marca: la información correcta se lee limpia.
- El profe ve por alumno «pilló X de N trampas» y «confió en el autor X de N veces», y el
  párrafo que más engañó a la clase.

El texto del libro **no se toca nunca**: los falsos son párrafos nuevos y los reales se
iluminan donde están. Lo escribe Claude leyendo el libro (nunca Gemini) y lo revisa Juan.

## Prompt (para el agente que lo escribe)

```
Escribes los párrafos del «falsificador» de «{LIBRO}», de {AUTOR}, para Inmersia (app de
lectura; alumnos de 12 a 15 años). Mezclados con el libro, el alumno tiene que adivinar
cuáles escribió el autor y cuáles «coló el gato».

8 sospechosos: 4 FALSOS que escribes tú y 4 REALES que eliges del libro. Uno por
capítulo, repartidos por todo el libro, alternando falso y real.

FALSOS (los escribes tú):
1. Imitan la voz del autor: su vocabulario, su largo de frase, sus giros, sus conectores
   («Sin embargo», «Es evidente que»…). Nunca caricatura ni parodia.
2. Cambian algo de lo que dice el libro (lo dan vuelta, le ponen otra causa, otro
   protagonista) o meten un dato inverosímil para la época o el tema. Un lector atento
   tiene que poder pillarlo con lo que ya leyó o con lo que viene justo después.
3. Encajan donde van: siguen el hilo del párrafo de antes y no rompen el de después.
4. De 3 a 8 oraciones. Ni muy largos ni muy cortos: del largo de los párrafos del autor
   alrededor (el largo delata).
5. Ninguna frase copiada del libro.
6. Cada uno guarda «raro» (qué lo delata, 1 frase en llano) y «verdad» (qué dice de
   verdad el libro, 1 o 2 frases en llano, sin tecnicismos).

REALES (los eliges del libro):
7. Párrafos enteros de 3 a 8 oraciones, de LARGO PARECIDO al de los falsos.
8. Que suenen igual de «raros» que un falso: no elijas el más famoso ni el más obvio.
9. «verdad» = qué dice el autor ahí, 1 o 2 frases en llano. Empieza por «Es de {AUTOR}.»

Tuteo, nunca voseo. Lee el libro entero en UN comando (cat capitulo_*.txt).
```

## Formato

`Documents/<libro>/falsificador/falsificador.json`:

```json
{
  "libro": "Del origen del dinero",
  "autor": "Menger",
  "sospechosos": [
    { "id": "r1", "capitulo": 1, "tipo": "real",
      "cita": "Existe un fenómeno que desde hace mucho tiempo y de manera muy peculiar",
      "verdad": "Es de Menger. Abre el libro con el misterio: …" },
    { "id": "f1", "capitulo": 2, "tipo": "falso",
      "tras": "Examinada con más minuciosidad, la suposición que sustenta esta teoría",
      "texto": "Debe reconocerse, sin embargo, …",
      "raro": "Habla de decretos antiguos que «se conservan»…",
      "verdad": "Menger dice justo lo contrario: …" }
  ]
}
```

- `autor`: como sale en «Lo escribió …» (normalmente el apellido).
- `cita` (real): el **comienzo** del párrafo, literal y único en el libro.
- `tras` (falso): el comienzo del párrafo **después del cual** va el falso.
- Los párrafos se ubican por la cita, no por posición: la numeración del `.txt` no es
  la de la base de datos. El cargador los busca en Supabase al subir.
- Los ids no se cambian una vez publicado (las respuestas van por id).

## Comprobar y subir

Desde `Documents/scripts no ficcion/`:

```
PYTHONIOENCODING=utf-8 python verificar_falsificador.py "<json>"
PYTHONIOENCODING=utf-8 python cargar_falsificador.py "<json>" --seco
PYTHONIOENCODING=utf-8 python cargar_falsificador.py "<json>" --pruebas
PYTHONIOENCODING=utf-8 python cargar_falsificador.py "<json>" --supabase-key "$K" --yes   # producción
```

El comprobador da **error** si no son mitad y mitad, si una cita no está (o está dos
veces, o en otro capítulo), si un párrafo no tiene de 3 a 8 oraciones, si un falso copia
una frase del libro o si hay voseo. Da **aviso** si un párrafo pasa de 200 palabras, si
la media de los falsos y de los reales se separa más de un 25 % (el largo delata) o si
hay dos en un capítulo.

El criterio lo revisa una persona: ¿suena al autor?, ¿«lo raro» se puede pillar
leyendo?, ¿el real elegido no es demasiado obvio?
