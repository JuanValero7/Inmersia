// Plain JavaScript (.jsx)
import clsx from 'clsx'
import { supabase } from '../../lib/supabase.js'

export function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)    return 'hace un momento'
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

export function Avatar({ name, small = false }) {
  return (
    <div className={clsx('foro-avatar', small && 'small')} aria-hidden="true">
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

export async function fetchNombre(userId) {
  const { data } = await supabase
    .from('perfiles').select('nombre, apellido').eq('id', userId).maybeSingle()
  return data?.nombre ? `${data.nombre} ${data.apellido || ''}`.trim() : 'Lector'
}
