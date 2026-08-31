// Generador de ruido ambiental para libros de no ficción.
// Capa 1: ruido generativo (Web Audio API — sin archivos).
// Capa 2: ambiente en loop (archivos en /public/sounds/).
// Solo el volumen persiste en localStorage ('inm_noise_pref'): el tipo/ambiente
// siempre arrancan en 'off'/'ninguno' en cada sesión de lectura para que el sonido
// nunca empiece solo — hay que elegirlo desde el panel cada vez que se abre un libro.
// Una vez elegido, sigue sonando aunque se cierre el panel (el player queda montado).
import { useState, useEffect, useRef } from 'react'

const PREF_KEY = 'inm_noise_pref'

export const TIPOS_RUIDO = [
  { key: 'off',    label: 'Apagado' },
  { key: 'blanco', label: 'Blanco'  },
  { key: 'rosa',   label: 'Rosa'    },
  { key: 'marron', label: 'Marrón'  },
]

export const AMBIENCIAS = [
  { key: 'ninguno', label: 'Ninguno', src: null },
  { key: 'lluvia',  label: 'Lluvia',  src: '/sounds/lluvia.mp3'  },
  { key: 'rio',     label: 'Río',     src: '/sounds/rio.mp3'     },
  { key: 'olas',    label: 'Olas',    src: '/sounds/olas.mp3'    },
  { key: 'fuego',   label: 'Fuego',   src: '/sounds/fuego.mp3'   },
]

function loadPref() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || 'null') || {} }
  catch { return {} }
}

function buildNoiseBuffer(ctx, tipo) {
  const n = ctx.sampleRate * 2   // 2 s en loop
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)

  if (tipo === 'blanco') {
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1

  } else if (tipo === 'rosa') {
    // Algoritmo Paul Kellett — aproxima espectro -3 dB/octava
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886*b0 + w*0.0555179
      b1 = 0.99332*b1 + w*0.0750759
      b2 = 0.96900*b2 + w*0.1538520
      b3 = 0.86650*b3 + w*0.3104856
      b4 = 0.55000*b4 + w*0.5329522
      b5 = -0.7616*b5 - w*0.0168980
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11
      b6 = w * 0.115926
    }

  } else if (tipo === 'marron') {
    // Integración de ruido blanco — espectro -6 dB/octava
    let last = 0
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1
      d[i] = (last + 0.02 * w) / 1.02
      last = d[i]
      d[i] *= 3.5
    }
  }
  return buf
}

export function useWhiteNoise() {
  const pref = loadPref()
  const [tipo,       setTipo]       = useState('off')
  const [volNoise,   setVolNoise]   = useState(pref.volNoise   ?? 0.35)
  const [ambiente,   setAmbiente]   = useState('ninguno')
  const [volAmb,     setVolAmb]     = useState(pref.volAmb     ?? 0.25)

  const ctxRef  = useRef(null)
  const srcRef  = useRef(null)
  const gainRef = useRef(null)
  const audioRef = useRef(null)

  // ── Persistir preferencias ─────────────────────────────────────
  // Solo el volumen persiste entre sesiones: tipo/ambiente siempre arrancan
  // apagados (ver comentario arriba) para que el sonido no arranque solo.
  useEffect(() => {
    // loadPref() ya está protegido; el guardado también debe estarlo (WebView
    // con almacenamiento bloqueado → setItem lanza y tumba el lector).
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ volNoise, volAmb })) }
    catch { /* almacenamiento no disponible */ }
  }, [volNoise, volAmb])

  // ── Capa 1: ruido generativo ───────────────────────────────────
  // El cleanup de abajo es el ÚNICO sitio que desmonta esta capa. React lo
  // ejecuta antes de volver a entrar aquí y también al desmontar, así que
  // desmontar además al ENTRAR (como se hacía antes) cerraba dos veces el
  // mismo AudioContext: el segundo close() devuelve una promesa rechazada
  // que nadie recogía, y salía un unhandled rejection por cada cambio de tipo.
  useEffect(() => {
    if (tipo === 'off') return

    const ctx = new window.AudioContext()
    const gain = ctx.createGain()
    gain.gain.value = volNoise
    gain.connect(ctx.destination)

    const src = ctx.createBufferSource()
    src.buffer = buildNoiseBuffer(ctx, tipo)
    src.loop = true
    src.connect(gain)
    src.start()

    // En iOS el contexto puede nacer 'suspended' aunque lo dispare un gesto
    // del usuario, porque el efecto corre después del render y ya fuera de la
    // ventana del gesto. Sin esto el ruido no suena y no hay ningún error que
    // lo explique.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    ctxRef.current  = ctx
    gainRef.current = gain
    srcRef.current  = src

    return () => {
      try { src.stop() } catch { /* ya detenido */ }
      if (ctx.state !== 'closed') ctx.close().catch(() => {})
      srcRef.current  = null
      gainRef.current = null
      ctxRef.current  = null
    }
  }, [tipo])   // solo reconstruir buffer cuando cambia el tipo

  // Actualizar volumen sin reconstruir buffer
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volNoise
  }, [volNoise])

  // ── Capa 2: ambiente en loop ───────────────────────────────────
  // Crear el elemento <audio> una sola vez
  useEffect(() => {
    const a = new Audio()
    a.loop = true
    a.volume = volAmb
    audioRef.current = a
    return () => { a.pause(); a.src = ''; audioRef.current = null }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Cambiar fuente cuando cambia el ambiente
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const amb = AMBIENCIAS.find(x => x.key === ambiente)
    a.pause()
    if (amb?.src) {
      a.src = amb.src
      a.load()
      a.play().catch(() => {})
    } else {
      a.src = ''
    }
  }, [ambiente])

  // Actualizar volumen del ambiente sin reiniciar
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volAmb
  }, [volAmb])

  // Sin efecto de limpieza al desmontar: era el TERCER sitio que cerraba el
  // AudioContext y volvía a rechazar la promesa (los refs de la capa 1 no se
  // anulaban, así que al desmontar cerraba un contexto ya cerrado). Cada capa
  // se limpia sola en su propio cleanup: la 1 arriba, el <audio> en el efecto
  // que lo crea.

  return { tipo, setTipo, volNoise, setVolNoise, ambiente, setAmbiente, volAmb, setVolAmb }
}
