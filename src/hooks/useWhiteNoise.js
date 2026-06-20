// Generador de ruido ambiental para libros de no ficción.
// Capa 1: ruido generativo (Web Audio API — sin archivos).
// Capa 2: ambiente en loop (archivos en /public/sounds/).
// Preferencias persisten en localStorage bajo 'inm_noise_pref'.
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
  { key: 'cafe',    label: 'Café',    src: '/sounds/cafe.mp3'    },
  { key: 'bosque',  label: 'Bosque',  src: '/sounds/bosque.mp3'  },
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
  const [tipo,       setTipo]       = useState(pref.tipo       || 'off')
  const [volNoise,   setVolNoise]   = useState(pref.volNoise   ?? 0.35)
  const [ambiente,   setAmbiente]   = useState(pref.ambiente   || 'ninguno')
  const [volAmb,     setVolAmb]     = useState(pref.volAmb     ?? 0.25)

  const ctxRef  = useRef(null)
  const srcRef  = useRef(null)
  const gainRef = useRef(null)
  const audioRef = useRef(null)

  // ── Persistir preferencias ─────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify({ tipo, volNoise, ambiente, volAmb }))
  }, [tipo, volNoise, ambiente, volAmb])

  // ── Capa 1: ruido generativo ───────────────────────────────────
  useEffect(() => {
    // Detener contexto anterior si existe
    srcRef.current?.stop()
    srcRef.current = null
    ctxRef.current?.close()
    ctxRef.current = null

    if (tipo === 'off') return

    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.gain.value = volNoise
    gain.connect(ctx.destination)

    const src = ctx.createBufferSource()
    src.buffer = buildNoiseBuffer(ctx, tipo)
    src.loop = true
    src.connect(gain)
    src.start()

    ctxRef.current  = ctx
    gainRef.current = gain
    srcRef.current  = src

    return () => {
      src.stop()
      ctx.close()
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

  // ── Limpieza al desmontar ──────────────────────────────────────
  useEffect(() => {
    return () => {
      srcRef.current?.stop()
      ctxRef.current?.close()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    }
  }, [])

  return { tipo, setTipo, volNoise, setVolNoise, ambiente, setAmbiente, volAmb, setVolAmb }
}
