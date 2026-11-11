# Explícaselo a… — cómo se prepara un libro (no ficción)

Juego de no ficción (migración 101). A mitad del libro y al terminarlo, el lector gira una **ruleta**, le toca un **personaje** con su **regla** y le explica con sus palabras una idea del libro. La IA (función `explicaselo-evaluar`, Gemini flash-lite) hace del personaje: pregunta lo que le faltó y al final da el veredicto. Apagado por defecto (Perfil y aulas).

El contenido lo escribe **Claude leyendo el libro** (nunca Gemini). Los personajes son fijos y viven en el código; por libro solo se escriben las dos ideas.

## Reglas del juego (decisiones de Juan, 10–11 nov 2026)

- **Dos momentos**, como el Desafío: `mitad` (tras un capítulo a mitad del libro) y `final` (tras el último). Una idea por momento.
- **Ruleta de 6 personajes**, la gira el servidor (nadie elige al fácil). El primer giro es gratis; **volver a girar cuesta 1 ovillo**. Al escribir el primer mensaje, el personaje ya no cambia.

  | Personaje | Regla | Quién la comprueba |
  |---|---|---|
  | Abuela | Sin palabras de economía: con cosas de la casa y del mercado | la IA |
  | Primo de 6 años | Frases cortas y un ejemplo con golosinas o juguetes | la IA |
  | Pirata | No más de 3 frases | la app y la base de datos, antes de enviar |
  | Marciano | No entiende un concepto del libro: esas palabras no se pueden usar (`prohibidas`, por libro) | la app y la base de datos, antes de enviar |
  | Kevin Escalada, CEO de Sinergix | Véndele la idea: que le cambia la vida y le hace ganar millones con un producto | la IA |
  | Granjero medieval | Nada inventado después del año 1500 | la IA |

- **Como mucho 2 mensajes** del alumno (de 2 a 150 palabras, sin pegar texto). Tras el primero, el personaje pregunta por el primer punto que falta (o se da por entendido si estaban los 4); tras el segundo, siempre veredicto.
- **Veredicto** (lo calcula la base de datos con los puntos que marca la IA): 4 puntos = **lo entendió (+3)**; 2–3 = **casi (+1)**; 0–1 = **se quedó igual (0)**. Romper la regla deja el resultado en «casi» como mucho. Si la IA falla al dar el veredicto, «casi».
- Al terminar, el alumno ve los 4 puntos (cuáles tocó) y la **explicación de referencia**.
- **El profe lee la charla entera** (el alumno lo sabe), con el personaje, los puntos, si rompió la regla y una nota de la IA.
- Topes de IA **compartidos con el Desafío**: 12 llamadas por alumno y día, 1.000 al día en toda la app.

## Qué escribir por libro

`Documents/<libro>/explicaselo/explicaselo.json` (ejemplo: *Del origen del dinero*):

```json
{
  "libro": "Del origen del dinero",
  "momentos": [
    {
      "momento": "mitad",
      "tras_capitulo": 4,
      "id": "liquidez",
      "idea": "para el revisor: por qué esta idea y de qué capítulos sale",
      "consigna": "Explícale qué es la «liquidez»: por qué unas cosas se cambian con facilidad y otras no.",
      "puntos": [{ "t": "lo que tiene que estar", "q": "pregunta del plan B en minúscula y sin signos" }],
      "referencia": "cómo lo explicaríamos nosotros, 50–130 palabras",
      "prohibidas": { "palabras": ["comprar", "vender"], "raices": ["compr", "vend", "venta"] }
    },
    { "momento": "final", "tras_capitulo": 9, "...": "..." }
  ]
}
```

### Cómo elegir

- **La idea del final = la tesis del libro** (la conclusión principal del hilo de ideas), dicha para que la entienda cualquiera.
- **La idea de la mitad = la pieza que hace falta para entender el final** y que ya se leyó en la primera mitad. No adelantar nada posterior a `tras_capitulo`.
- **Consigna**: empieza por «Explícale…», 6–25 palabras, sin usar las palabras prohibidas (el marciano también la recibe).
- **4 puntos**: lo mínimo para que alguien que no leyó el libro lo entienda. Cada uno, una sola idea, dicha en llano (8–40 palabras). Se aceptan con cualquier palabra o ejemplo: no exigir términos del libro.
- **`q`**: lo que preguntaría alguien que no entendió ese punto. El personaje le pone su muletilla y los signos («¡Arr! ¿Y » + q + «, grumete?»), así que va en minúscula y sin signos. El plan B usa la del primer punto.
- **Referencia**: como se la contaríamos a un alumno de 12–15 años; con un ejemplo concreto. Mejor sin las palabras prohibidas.
- **Prohibidas (marciano)**: el concepto que un extraterrestre no entendería y sin el cual la explicación se pone interesante (Menger: comprar y vender → hay que hablar de «cambiar»). `raices` en minúscula sin tildes; se comprueban al comienzo de palabra («compr» pilla compraba, comprador; no «recompensa»). Cada palabra de `palabras` tiene que empezar por una raíz.

## Comprobar y subir

Desde `Documents/scripts no ficcion/`:

```
PYTHONIOENCODING=utf-8 python verificar_explicaselo.py ".../explicaselo/explicaselo.json"
PYTHONIOENCODING=utf-8 python cargar_explicaselo.py ".../explicaselo/explicaselo.json" --seco
```

Subir solo cuando Juan lo diga: `--pruebas`, o `--supabase-key "$K" --yes` para producción.

## Revisión de criterio

- ¿La idea del final es de verdad la tesis del libro? ¿La de la mitad se entiende con lo leído hasta ese capítulo?
- ¿Cada punto se puede decir con palabras de un chico de 13 años? ¿Alguno solo se cumple repitiendo un término del libro?
- ¿Se puede explicar sin las palabras prohibidas? (Pruébalo: escribe la explicación al marciano.)
- ¿Los 4 puntos juntos bastan para entenderlo, y ninguno sobra?
