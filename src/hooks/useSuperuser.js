// src/hooks/useSuperuser.js
// Verifica si el usuario actual es superusuario consultando la tabla
// `superusuarios`. La tabla tiene RLS: un usuario solo puede leer su
// propio registro, y nadie puede insertarse a sí mismo desde el cliente.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useSuperuser(user) {
  const [isSuperuser, setIsSuperuser] = useState(false)

  useEffect(() => {
    if (!user?.id) { setIsSuperuser(false); return }
    supabase
      .from('superusuarios')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setIsSuperuser((count ?? 0) > 0))
  }, [user?.id])

  return isSuperuser
}
