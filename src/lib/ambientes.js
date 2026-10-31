// GENERADO por scripts ficcion/generar_ambientes.py desde ambientes_catalogo.json:
// no editar a mano. Solo los ambientes cuyos audios ya están en
// public/sounds/ambiente/. Lo usa hooks/useAmbiente.js.
//   bucle:    el sonido continuo ES el ambiente (lluvia); se alternan sus
//             variantes <slug>_<v>.mp3 con un fundido.
//   detalles: silencio + sonidos sueltos detalles/<slug>/<detalle>.mp3, uno
//             cada `intervalo` segundos (al azar), elegido según su peso.
export const AMBIENTES = {
  lluvia_ventana: {'nombre': 'Lluvia tras la ventana', 'tipo': 'bucle', 'variantes': ['a', 'b']},
  ciudad_xix_dia: {'nombre': 'Ciudad antigua de día', 'tipo': 'detalles', 'intervalo': [35, 65], 'detalles': [{'slug': 'carruaje', 'peso': 3}, {'slug': 'pasos', 'peso': 3}, {'slug': 'vendedor', 'peso': 2}, {'slug': 'palomas', 'peso': 2}, {'slug': 'campana', 'peso': 1}, {'slug': 'perro', 'peso': 1}]},
  ciudad_xix_noche: {'nombre': 'Ciudad antigua de noche', 'tipo': 'detalles', 'intervalo': [45, 90], 'detalles': [{'slug': 'carruaje_lejano', 'peso': 2}, {'slug': 'pasos_noche', 'peso': 3}, {'slug': 'contraventana', 'peso': 2}, {'slug': 'perro_lejano', 'peso': 2}, {'slug': 'gato', 'peso': 1}]},
  casa_silencio: {'nombre': 'Casa en silencio', 'tipo': 'detalles', 'intervalo': [45, 90], 'detalles': [{'slug': 'cortina', 'peso': 3}, {'slug': 'rafaga', 'peso': 2}, {'slug': 'crujido', 'peso': 2}, {'slug': 'pajaro', 'peso': 2}, {'slug': 'puerta_lejana', 'peso': 1}]},
}
