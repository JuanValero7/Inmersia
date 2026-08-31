// Descarga de datos personales — derecho de portabilidad (art. 20 RGPD).
// Lo usa el botón "Descargar mis datos" de Perfil → Legal.
//
// Recoge en un solo JSON todo lo que la Política de Privacidad declara que
// guardamos de una persona. No hace falta ningún permiso especial: cada
// consulta pasa por la RLS, que ya limita cada tabla a las filas propias.
// Si mañana se añade una tabla con datos de usuario, va en esta lista —
// y en la tabla de la sección 2 de la política.
import { supabase } from './supabase.js'

// [clave en el JSON, tabla, columna que apunta al usuario]
const FUENTES = [
  ['biblioteca',        'bibliotecas_usuarios',    'user_id'],
  ['progreso_lectura',  'progreso_lectura',        'user_id'],
  ['sesiones_lectura',  'sesiones_lectura',        'user_id'],
  ['notas',             'notas_usuario',           'user_id'],
  ['anotaciones',       'anotaciones_usuario',     'user_id'],
  ['subrayados',        'subrayados_usuario',      'user_id'],
  ['resenas',           'resenas_libros',          'user_id'],
  ['comentarios_foro',  'foros_comentarios',       'autor_id'],
  ['album',             'album_barajitas_pegadas', 'user_id'],
  ['predicciones',      'predicciones_usuario',    'user_id'],
  ['preferencias',      'preferencias_usuario',    'user_id'],
]

export async function reunirMisDatos(user) {
  const datos = {
    _generado: new Date().toISOString(),
    _sobre: 'Copia de los datos personales asociados a esta cuenta de Inmersia (art. 20 RGPD).',
    cuenta: {
      id: user.id,
      email: user.email,
      creada: user.created_at,
      nombre: user.user_metadata?.nombre ?? null,
      apellido: user.user_metadata?.apellido ?? null,
      fecha_nacimiento: user.user_metadata?.fecha_nacimiento ?? null,
      genero: user.user_metadata?.genero ?? null,
    },
  }

  const { data: perfil } = await supabase
    .from('perfiles').select('*').eq('id', user.id).maybeSingle()
  datos.perfil = perfil ?? null

  // En paralelo: son once consultas independientes y cada una va por su
  // índice de user_id. Una tabla que falle no debe tumbar la descarga
  // entera, así que el error se anota en su propia clave.
  const resultados = await Promise.all(
    FUENTES.map(([, tabla, columna]) =>
      supabase.from(tabla).select('*').eq(columna, user.id)
    )
  )
  FUENTES.forEach(([clave], i) => {
    const { data, error } = resultados[i]
    datos[clave] = error ? { _error: error.message } : (data ?? [])
  })

  // Los mensajes de chat no se incluyen: son una conversación de dos, y
  // entregarlos completos daría copia de lo que escribió la otra persona.
  // Se conservan un máximo de 90 días (Política de Privacidad, sección 4).
  datos._nota_chat =
    'Los mensajes de chat privado no se incluyen porque contienen también los mensajes de tu interlocutor. Se borran automáticamente a los 90 días.'

  return datos
}

// Reúne los datos y dispara la descarga del archivo en el navegador.
// Devuelve null si fue bien, o un mensaje de error.
export async function descargarMisDatos(user) {
  try {
    const datos = await reunirMisDatos(user)
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inmersia-mis-datos-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Sin esto el blob se queda en memoria hasta recargar la pestaña.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return null
  } catch (err) {
    return err?.message || 'No se pudo generar la descarga.'
  }
}
