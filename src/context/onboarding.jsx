// Contexto del tutorial guiado (onboarding) de usuarios nuevos.
// ─────────────────────────────────────────────────────────────
// Única fuente de verdad = el flag `perfiles.onboarding_completado` en la DB.
// El tutorial corre EN MEMORIA en una sola sesión: al detectar el flag en
// `false` (usuario nuevo) se activa, se lo lleva a la Biblioteca y se marca
// `true` de inmediato. Así:
//   · abandonar a mitad         → ya está en true → no reaparece.
//   · borrar cache / otro navegador → el true vive en la DB → no reaparece.
// La única forma de repetirlo es restart() (opción "Repetir tutorial" en Perfil),
// que reactiva el flujo en memoria sin volver a tocar la DB.
//
// Máquina de estados (lineal). Cada superficie lee `step` y restringe la
// navegación a un único destino permitido:
//   bienvenida → manual → investigacion → foro → album → tienda_final → tienda → done
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { ensureProfile } from '../lib/ensureProfile.js'
import { queryKeys } from '../lib/queries.js'

// 'tienda_final' = el hint "Ve a la Tienda" que vive en la Biblioteca.
// 'tienda'       = el aviso del límite de lecturas pendientes, en la FACHADA de
//                  la Tienda. Es el último: si el usuario nunca cruza la puerta
//                  el paso se queda ahí, pero el flag de la DB ya está en true,
//                  así que no reaparece en otra sesión.
export const ONBOARDING_STEPS = ['bienvenida', 'manual', 'investigacion', 'foro', 'album', 'tienda_final', 'tienda', 'done']

const OnboardingContext = createContext(null)

// Controlador: lo instancia App (que tiene `user` y `navigate`) y expone su
// valor por el Provider para que cualquier superficie profunda lo consuma.
export function useOnboardingController(user, navigate) {
  const [step, setStep]   = useState(null)   // null = sin resolver / sin tutorial
  const [ready, setReady] = useState(false)
  const startedRef = useRef(false)           // evita reactivar en el mismo ciclo de vida
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false
    if (!user?.id) { setStep(null); setReady(true); startedRef.current = false; return }
    setReady(false)
    // Esperar a ensureProfile ANTES de leer el flag. En un registro nuevo la fila
    // de `perfiles` todavía no existe: esta consulta necesita 1 viaje de red y
    // ensureProfile 2 (SELECT + INSERT), así que sin esperar ganábamos la carrera,
    // maybeSingle() devolvía null, `=== false` era falso y el usuario recién
    // registrado se quedaba SIN tutorial. ensureProfile está memoizado por user.id
    // (ver lib/ensureProfile.js), así que esto no duplica trabajo con App.jsx.
    ensureProfile(user)
      .then(() => {
        // La query de bibliotecaUsuario (Biblioteca.jsx) se dispara en cuanto hay
        // user.id, en paralelo a ensureProfile — podía ganar la carrera y cachear
        // la lista SIN el Manual del Explorador (staleTime 60s, nadie la refresca
        // después). Al llegar aquí el insert del Manual ya está garantizado en la
        // DB, así que invalidamos para que el botón "Abrir el Manual" del
        // WelcomePopup deje de quedar deshabilitado.
        queryClient.invalidateQueries({ queryKey: queryKeys.bibliotecaUsuario(user.id) })
        return supabase.from('perfiles').select('onboarding_completado').eq('id', user.id).maybeSingle()
      })
      .then(({ data }) => {
        if (cancelled) return
        // === false explícito: usuario nuevo. (Si la columna no existe todavía
        // —migración sin correr— data?.x es undefined y NO se dispara nada.)
        if (data?.onboarding_completado === false && !startedRef.current) {
          startedRef.current = true
          setStep('bienvenida')
          navigate('/biblioteca')
          supabase.from('perfiles').update({ onboarding_completado: true }).eq('id', user.id)
            .then(({ error }) => { if (error) console.error('No se pudo marcar el onboarding:', error.message) })
        } else {
          setStep('done')
        }
        setReady(true)
      })
    return () => { cancelled = true }
    // `navigate` queda fuera a propósito: con <BrowserRouter> react-router usa
    // useNavigateUnstable, que la re-crea en cada cambio de pathname. En las deps
    // haría correr este efecto en cada navegación; al releer el flag —ya en true
    // desde el arranque— caería en el else y mataría el tutorial con setStep('done')
    // justo al abrir el manual. Aquí solo se navega a una ruta absoluta, así que la
    // referencia capturada sirve igual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Avanza al siguiente paso. `from` (opcional) hace la transición idempotente:
  // solo avanza si el paso actual coincide, evitando saltos dobles.
  const advance = useCallback((from) => {
    setStep(prev => {
      if (from && prev !== from) return prev
      const i = ONBOARDING_STEPS.indexOf(prev)
      return i < 0 ? prev : ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)]
    })
  }, [])

  const goto = useCallback((s) => { if (ONBOARDING_STEPS.includes(s)) setStep(s) }, [])

  // Saltar tutorial → libertad total. El flag ya está en true desde el inicio,
  // así que basta con cerrar el flujo en memoria.
  const skip = useCallback(() => setStep('done'), [])

  // Repetir tutorial (desde Perfil). Reactiva en memoria; el flag sigue en true.
  const restart = useCallback(() => {
    startedRef.current = true
    setStep('bienvenida')
    navigate('/biblioteca')
  }, [navigate])

  const active = ready && step != null && step !== 'done'
  return { active, step, ready, advance, goto, skip, restart }
}

export function OnboardingProvider({ value, children }) {
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

// Valor no-op por defecto: si algún componente consume fuera del Provider,
// simplemente no hay tutorial (nunca rompe).
const NOOP = { active: false, step: 'done', ready: true, advance() {}, goto() {}, skip() {}, restart() {} }

export function useOnboarding() {
  return useContext(OnboardingContext) ?? NOOP
}
