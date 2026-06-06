// Plain JavaScript (.jsx)
import { useState, useEffect, memo } from 'react'
import { supabase } from '../../lib/supabase.js'
import { theme, ClayButton } from './clay.jsx'
import { getTourPhase } from '../guidedTour.js'
import { runGuidedNotebook1 } from '../tutorial.js'

// Tipos (arriba, horizontal)
const TYPES = [
  { id: 'pred', label: 'Predicciones', col: '#86ad9e', txt: '#2e6b56' },
  { id: 'anot', label: 'Anotaciones',  col: '#cf8ea4', txt: '#8a3556' },
  { id: 'sub',  label: 'Subrayados',   col: '#e0b256', txt: '#9a6310' },
]

// Cuaderno de lectura — clay. Tipos arriba en horizontal; los capítulos con
// notas (o el que estás leyendo) son las pestañas laterales.
// Mantiene las queries Supabase: predicciones / anotaciones / subrayados.
const Notebook = memo(function Notebook({ isOpen, onClose, userId, libroId, capituloNum, capitulos = [] }) {
  const [type, setType] = useState('pred')
  const [selCap, setSelCap] = useState(capituloNum)
  const [tabCaps, setTabCaps] = useState([])
  const [subrayados, setSubrayados] = useState([])
  // drafts por capítulo: { [num]: { pred, anot, anotId, loaded, dirty } }
  const [drafts, setDrafts] = useState({})

  // metadatos de capítulos para tooltip
  const capMeta = {}
  for (const c of capitulos) capMeta[c.numero] = c.titulo

  useEffect(() => {
    if (!isOpen) return
    setSelCap(capituloNum)
    if (userId && libroId) loadIndex()
    if (getTourPhase() === 'notebook_1') {
      const t = setTimeout(() => runGuidedNotebook1(), 600)
      return () => clearTimeout(t)
    }
  }, [isOpen, libroId, capituloNum])

  async function loadIndex() {
    const [predList, anotList, subRes] = await Promise.all([
      supabase.from('predicciones_usuario').select('capitulo_num').eq('user_id', userId).eq('libro_id', libroId),
      supabase.from('anotaciones_usuario').select('capitulo_num').eq('user_id', userId).eq('libro_id', libroId),
      supabase.from('subrayados_usuario').select('id, texto_original, capitulo_num').eq('user_id', userId).eq('libro_id', libroId).order('capitulo_num'),
    ])
    const nums = new Set([capituloNum])
    predList.data?.forEach(r => nums.add(r.capitulo_num))
    anotList.data?.forEach(r => nums.add(r.capitulo_num))
    subRes.data?.forEach(r => nums.add(r.capitulo_num))
    setTabCaps([...nums].sort((a, b) => a - b))
    setSubrayados(subRes.data || [])
    loadChapter(capituloNum)
  }

  async function loadChapter(num) {
    if (drafts[num]?.loaded) return
    const [predRes, anotRes] = await Promise.all([
      supabase.from('predicciones_usuario').select('contenido').eq('user_id', userId).eq('libro_id', libroId).eq('capitulo_num', num).maybeSingle(),
      supabase.from('anotaciones_usuario').select('id, contenido').eq('user_id', userId).eq('libro_id', libroId).eq('capitulo_num', num).order('created_at').limit(1).maybeSingle(),
    ])
    setDrafts(prev => ({ ...prev, [num]: { pred: predRes.data?.contenido || '', anot: anotRes.data?.contenido || '', anotId: anotRes.data?.id || null, loaded: true, dirty: false } }))
  }

  function selectCap(num) {
    setSelCap(num)
    if (userId && libroId) loadChapter(num)
  }

  function editDraft(num, field, val) {
    setDrafts(prev => ({ ...prev, [num]: { pred: '', anot: '', anotId: null, loaded: true, ...(prev[num] || {}), [field]: val, dirty: true } }))
  }

  async function handleClose() {
    const saves = []
    for (const [numStr, d] of Object.entries(drafts)) {
      if (!d?.dirty || !userId || !libroId) continue
      const num = Number(numStr)
      const pred = d.pred.trim().slice(0, 2000)
      const anot = d.anot.trim().slice(0, 2000)
      if (pred) {
        saves.push(supabase.from('predicciones_usuario').upsert(
          { user_id: userId, libro_id: libroId, capitulo_num: num, contenido: pred, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,libro_id,capitulo_num' }))
      }
      if (anot) {
        saves.push(d.anotId
          ? supabase.from('anotaciones_usuario').update({ contenido: anot }).eq('id', d.anotId)
          : supabase.from('anotaciones_usuario').insert({ user_id: userId, libro_id: libroId, capitulo_num: num, contenido: anot }))
      }
    }
    if (saves.length) await Promise.all(saves)
    onClose()
  }

  async function deleteSubrayado(id) {
    await supabase.from('subrayados_usuario').delete().eq('id', id)
    setSubrayados(prev => prev.filter(s => s.id !== id))
  }

  if (!isOpen) return null

  const nt = drafts[selCap] || { pred: '', anot: '', anotId: null }
  const subsCap = subrayados.filter(s => s.capitulo_num === selCap)
  const lined = 'repeating-linear-gradient(0deg, transparent, transparent 31px, #b9c6d6 31px, #b9c6d6 32px)'
  const activeMeta = TYPES.find(t => t.id === type)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(20,12,4,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 'min(860px,93vw)', height: 'min(600px,86vh)', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#f7f1e4,#efe6d2)', borderRadius: 14, overflow: 'hidden', borderLeft: '14px solid #b3402e', border: `2px solid ${theme.ink}`, boxShadow: `5px 7px 0 ${theme.ink}30, 0 24px 60px rgba(0,0,0,0.55)` }}>
        {/* header */}
        <div style={{ background: 'linear-gradient(90deg,#b3402e,#8e2f20)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fbe9df', fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>Cuaderno de lectura</span>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, width: 28, height: 28, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* tipos: arriba horizontal */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px 10px', flexShrink: 0, borderBottom: '1px solid rgba(74,54,34,0.12)' }}>
          {TYPES.map(t => {
            const active = type === t.id
            return (
              <button key={t.id} onClick={() => setType(t.id)}
                style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: active ? 800 : 600, fontSize: 13, cursor: 'pointer', padding: '7px 16px', borderRadius: 999, border: `2px solid ${active ? theme.ink : 'transparent'}`, background: active ? t.col : `${t.col}44`, color: active ? '#fff' : t.txt, boxShadow: active ? `1.4px 1.8px 0 ${theme.ink}33` : 'none', textShadow: active ? '0 1px 1px rgba(0,0,0,0.2)' : 'none' }}>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* body: contenido + solapas de capítulo */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {type === 'sub' ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {subsCap.length === 0
                  ? <p style={{ fontFamily: "'Baloo 2',sans-serif", fontStyle: 'italic', fontSize: 13, color: 'rgba(74,54,34,0.5)' }}>Sin subrayados en este capítulo. Seleccioná texto en el libro para guardar uno.</p>
                  : subsCap.map(s => (
                    <div key={s.id} style={{ marginBottom: 12, padding: '11px 14px', background: 'rgba(224,178,86,0.2)', borderLeft: '4px solid #e0b256', borderRadius: '0 8px 8px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <p style={{ flex: 1, margin: 0, fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: 15, lineHeight: 1.5, color: '#3a2a18' }}>“{s.texto_original}”</p>
                      <button onClick={() => deleteSubrayado(s.id)} title="Eliminar" style={{ background: 'none', border: 'none', color: 'rgba(160,60,40,0.6)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 24px 12px', minHeight: 0 }}>
                <p style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 13, color: 'rgba(74,54,34,0.6)', marginBottom: 10, fontWeight: 600 }}>
                  {type === 'pred' ? '¿Qué creés que pasará en el próximo capítulo?' : 'Tus notas sobre este capítulo.'}
                </p>
                <textarea
                  value={type === 'pred' ? nt.pred : nt.anot}
                  onChange={e => editDraft(selCap, type === 'pred' ? 'pred' : 'anot', e.target.value)}
                  placeholder={type === 'pred' ? 'Escribí tus predicciones…' : 'Escribí tus anotaciones…'}
                  maxLength={2000}
                  style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: lined, fontFamily: "'Special Elite', monospace", fontSize: 14, lineHeight: '32px', color: '#2a1f12' }} />
              </div>
            )}
          </div>

          {/* solapas de capítulo */}
          <div style={{ width: 46, display: 'flex', flexDirection: 'column', flexShrink: 0, borderLeft: '1px solid rgba(74,54,34,0.12)' }}>
            {tabCaps.map(num => {
              const active = selCap === num
              return (
                <button key={num} onClick={() => selectCap(num)} title={capMeta[num] ? `Cap. ${num} · ${capMeta[num]}` : `Cap. ${num}`}
                  style={{ flex: 1, minHeight: 54, writingMode: 'vertical-rl', textOrientation: 'mixed', border: 'none', borderBottom: '1px solid rgba(74,54,34,0.1)', cursor: 'pointer', fontFamily: "'Baloo 2', sans-serif", fontWeight: active ? 800 : 600, fontSize: 11.5, letterSpacing: '0.04em', background: active ? activeMeta.col : 'rgba(230,215,185,0.6)', color: active ? '#fff' : 'rgba(74,54,34,0.7)', boxShadow: active ? 'inset 3px 0 0 rgba(0,0,0,0.15)' : 'none' }}>
                  Cap. {num}{num === capituloNum ? ' •' : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(74,54,34,0.12)', background: 'rgba(245,235,210,0.6)', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: 11.5, color: 'rgba(74,54,34,0.55)' }}>Cap. {selCap}{selCap === capituloNum ? ' (estás leyendo)' : ''}</span>
          <ClayButton variant="primary" onClick={handleClose} style={{ fontSize: 13 }}>Guardar y continuar →</ClayButton>
        </div>
      </div>
    </div>
  )
})

export { Notebook }
