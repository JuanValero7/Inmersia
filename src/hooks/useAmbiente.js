// Sonido de ambiente de la ficción, por tramos de párrafos (migración 080).
//
// Cada capítulo trae sus tramos ({desde, hasta, ambiente}). El lector le dice
// al motor qué ambiente toca al primer párrafo de la página que se ve
// (useAmbienteEnPagina, en useLectorComun.js) y el motor:
//   · bucle    (lluvia): alterna sus variantes con un fundido de 3 s, para que
//              el bucle no se note.
//   · detalles (casa, ciudad…): silencio y, cada `intervalo` segundos al azar,
//              un sonido suelto elegido según su peso, nunca el mismo dos veces
//              seguidas. El fondo continuo se descartó: sonaba a ruido blanco.
// Al cambiar de tramo espera 2 s en la página nueva (ir y volver por el borde
// de un tramo no cambia nada) y hace un fundido.
//
// El lector solo controla el VOLUMEN (decisión de Juan: nada de más opciones).
// A 0 no suena nada; arranca en 0 en cada sesión para que el sonido nunca
// empiece solo, igual que el ruido de la no ficción (useWhiteNoise).
//
// Web Audio y no <audio>: en iPhone el volumen de un <audio> no se puede
// cambiar desde la página, y una GainNode sí.
import { useState, useEffect, useRef, useCallback } from 'react'
import { AMBIENTES } from '../lib/ambientes.js'

const BASE = '/sounds/ambiente/'
const FUNDIDO = 3              // s: cambio de tramo y paso entre variantes del bucle
const ESPERA_CAMBIO = 2000     // ms en la página nueva antes de cambiar de tramo
const NIVEL_BUCLE = 0.7
const azar = (a, b) => a + Math.random() * (b - a)

/**
 * Ambiente que toca al párrafo `numero`. null si el tramo es "ninguno", si no
 * hay tramo o si el ambiente aún no tiene audios en la app.
 * @param {Array<{desde: number, hasta: number, ambiente: string}>|null} tramos
 * @param {number|undefined} numero
 * @returns {string|null}
 */
export function ambienteDelParrafo(tramos, numero) {
  if (!tramos?.length || numero == null) return null
  const t = tramos.find(t => numero >= t.desde && numero <= t.hasta)
  return t && AMBIENTES[t.ambiente] ? t.ambiente : null
}

/**
 * Elige un detalle según su peso, sin repetir el último.
 * @param {Array<{slug: string, peso: number}>} lista
 * @param {string|null} ultimo
 * @param {number} [r] número al azar en [0, 1)
 */
export function elegirDetalle(lista, ultimo, r = Math.random()) {
  const opciones = lista.length > 1 ? lista.filter(d => d.slug !== ultimo) : lista
  let resto = r * opciones.reduce((s, d) => s + d.peso, 0)
  for (const d of opciones) { resto -= d.peso; if (resto < 0) return d }
  return opciones[opciones.length - 1]
}

class Motor {
  constructor() { this.ctx = null; this.master = null; this.buffers = new Map(); this.escena = null }

  // Solo desde un gesto del lector (mover el volumen): si no, el navegador
  // deja el contexto en pausa.
  iniciar() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  volumen(v) {
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08)
  }

  cargar(ruta) {
    if (!this.buffers.has(ruta)) {
      const p = fetch(BASE + ruta)
        .then(r => { if (!r.ok) throw new Error(`${ruta}: ${r.status}`); return r.arrayBuffer() })
        // forma con callbacks: el Safari viejo no devuelve promesa
        .then(b => new Promise((ok, mal) => this.ctx.decodeAudioData(b, ok, mal)))
      p.catch(() => this.buffers.delete(ruta))   // que un fallo de red no quede guardado
      this.buffers.set(ruta, p)
    }
    return this.buffers.get(ruta)
  }

  // Una "voz": el buffer con su propia ganancia, que entra en `entrada` segundos.
  tocar(buffer, nivel, entrada) {
    const t = this.ctx.currentTime
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(nivel, t + entrada)
    g.connect(this.master)
    const s = this.ctx.createBufferSource()
    s.buffer = buffer
    s.connect(g)
    s.onended = () => g.disconnect()
    s.start(t)
    return { g, s, t }
  }

  apagarVoz({ g, s }, seg) {
    const t = this.ctx.currentTime
    g.gain.cancelScheduledValues(t)
    g.gain.setValueAtTime(g.gain.value, t)
    g.gain.linearRampToValueAtTime(0, t + seg)
    try { s.stop(t + seg + 0.05) } catch { /* ya había terminado */ }
  }

  poner(slug, esCambio) {
    this.escena?.parar()
    this.escena = null
    if (!slug || !this.ctx) return
    const a = AMBIENTES[slug]
    this.escena = a.tipo === 'bucle' ? new Bucle(this, slug, a) : new Detalles(this, slug, a, esCambio)
  }

  cerrar() {
    this.escena?.parar()
    this.escena = null
    this.ctx?.close().catch(() => {})
    this.ctx = null
    this.buffers.clear()
  }
}

class Bucle {
  constructor(motor, slug, a) {
    this.m = motor; this.vivo = true; this.i = 0; this.voz = null
    this.archivos = a.variantes.map(v => `${slug}_${v}.mp3`)
    this.archivos.forEach(r => motor.cargar(r).catch(() => {}))
    this.siguiente()
  }
  async siguiente() {
    let buf
    try { buf = await this.m.cargar(this.archivos[this.i++ % this.archivos.length]) } catch { return }
    if (!this.vivo) return
    const previa = this.voz
    this.voz = this.m.tocar(buf, NIVEL_BUCLE, FUNDIDO)
    if (previa) this.m.apagarVoz(previa, FUNDIDO)
    this.timer = setTimeout(() => this.siguiente(), Math.max(1, buf.duration - FUNDIDO) * 1000)
  }
  parar() {
    this.vivo = false
    clearTimeout(this.timer)
    if (this.voz) this.m.apagarVoz(this.voz, FUNDIDO)
  }
}

class Detalles {
  constructor(motor, slug, a, esCambio) {
    this.m = motor; this.vivo = true; this.ultimo = null
    this.lista = a.detalles; this.intervalo = a.intervalo
    this.ruta = d => `detalles/${slug}/${d.slug}.mp3`
    this.lista.forEach(d => motor.cargar(this.ruta(d)).catch(() => {}))
    // El primero llega antes que los demás para que se note el lugar, pero no
    // de golpe: tras un cambio de tramo, a los 8–20 s; al subir el volumen, a los 5–15 s.
    this.esperar(esCambio ? azar(8, 20) : azar(5, 15))
  }
  esperar(seg) { this.timer = setTimeout(() => this.tocar(), seg * 1000) }
  async tocar() {
    if (!this.vivo) return
    const d = elegirDetalle(this.lista, this.ultimo)
    this.ultimo = d.slug
    try {
      const buf = await this.m.cargar(this.ruta(d))
      if (!this.vivo) return
      // volumen al azar y entrada/salida de 0,2 s: que ninguno empiece ni corte en seco
      const nivel = azar(0.6, 1)
      const { g, t } = this.m.tocar(buf, nivel, 0.2)
      const fin = t + buf.duration
      g.gain.setValueAtTime(nivel, Math.max(t + 0.2, fin - 0.25))
      g.gain.linearRampToValueAtTime(0, fin)
    } catch { /* sin este detalle: pasa al siguiente */ }
    this.esperar(azar(...this.intervalo))
  }
  // El detalle que esté sonando termina solo; no se programan más.
  parar() { this.vivo = false; clearTimeout(this.timer) }
}

/**
 * Motor de ambiente del lector. Una sola instancia por lector (vive en
 * useLectorComun), para que siga sonando con el panel de sonido cerrado.
 * @returns {{ volumen: number, setVolumen: (v: number) => void,
 *             ambiente: string|null, nombre: string|null, situar: (slug: string|null) => void }}
 */
export function useAmbiente() {
  const [volumen, setVolumenEstado] = useState(0)
  const [ambiente, setAmbiente] = useState(null)
  const motorRef = useRef(null)
  if (!motorRef.current) motorRef.current = new Motor()
  const volRef = useRef(0)
  const actualRef = useRef(undefined)     // ambiente ya aplicado (undefined: aún ninguno)
  const timerRef = useRef(null)

  useEffect(() => {
    const motor = motorRef.current
    return () => { clearTimeout(timerRef.current); motor.cerrar() }
  }, [])

  const setVolumen = useCallback((v) => {
    const motor = motorRef.current
    const antes = volRef.current
    volRef.current = v
    setVolumenEstado(v)
    if (v > 0) {
      motor.iniciar()
      motor.volumen(v)
      if (antes === 0) motor.poner(actualRef.current ?? null, false)
    } else {
      motor.volumen(0)
      motor.poner(null)
    }
  }, [])

  const situar = useCallback((slug) => {
    clearTimeout(timerRef.current)
    const aplicar = (esCambio) => {
      if (slug === actualRef.current) return
      actualRef.current = slug
      setAmbiente(slug)
      if (volRef.current > 0) motorRef.current.poner(slug, esCambio)
    }
    // Al abrir el libro, directo; después, solo si el lector se queda en la página.
    if (actualRef.current === undefined) aplicar(false)
    else if (slug !== actualRef.current) timerRef.current = setTimeout(() => aplicar(true), ESPERA_CAMBIO)
  }, [])

  return { volumen, setVolumen, ambiente, nombre: ambiente ? AMBIENTES[ambiente].nombre : null, situar }
}
