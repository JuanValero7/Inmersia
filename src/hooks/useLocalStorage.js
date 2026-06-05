// =============================================================
// INMERSIA — Hook genérico para persistir state en localStorage
// Formato: Plain JavaScript (.js)
// =============================================================

import { useState, useCallback } from 'react'

export default function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial }
    catch { return initial }
  })
  const set = useCallback((v) => {
    setValue(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* localStorage unavailable */ }
      return next
    })
  }, [key])
  return [value, set]
}