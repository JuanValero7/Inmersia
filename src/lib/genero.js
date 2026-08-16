// Saludo de bienvenida flexionado según el género elegido en el registro.
// `genero` viene de user.user_metadata.genero ('masculino' | 'femenino' | 'diverso').
// Para usuarios antiguos sin género declarado se usa la forma masculina (neutra
// por defecto en español). El género se guarda en el user_metadata de Auth,
// no en la tabla perfiles.
export function saludoBienvenida(genero) {
  if (genero === 'femenino') return 'Bienvenida'
  if (genero === 'diverso')  return 'Bienvenide'
  return 'Bienvenido'
}
