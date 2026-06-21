import { useRef } from 'react'
import { findPrefixAtEnd, findSuffixAtStart } from '../../../utils/readerHelpers.js'

const LINE = 1.72  // alto de línea (coincide con .lm-para en el CSS)

export default function MobileBookPage({ chapter, chapterIndex, parrafos, mediaByParrafo, isFirst, pageNum, fontSize, font,
                    atStart, nextIsChapter, onPrev, onNext, onPlaySfx, onSelectText }) {
  const lineH = Math.round(fontSize * LINE)
  const innerRef = useRef(null)

  function handleSel() {
    // Delay de 50ms: deja que el navegador finalice la selección antes de leerla,
    // especialmente necesario en touch donde la selección no está 100% lista al touchend.
    setTimeout(() => {
      if (!onSelectText) return
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return
      if (!innerRef.current?.contains(sel.anchorNode)) return
      const text = sel.toString().trim()
      const anchorEl = sel.anchorNode?.parentElement?.closest('[data-parrafo-id]')
      const parrafoId = anchorEl?.dataset?.parrafoId || null
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      onSelectText({ text, parrafoId, rect })
    }, 50)
  }

  return (
    <div className="lm-page" data-screen-label={`Lector cap ${chapter?.numero ?? chapterIndex + 1}`}>
      <div className="lm-page-lines" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${lineH-1}px, rgba(150,110,60,0.05) ${lineH-1}px, rgba(150,110,60,0.05) ${lineH}px)` }} />
      <div className="lm-page-inner" data-lm-pagebox ref={innerRef} translate="no" style={{ fontSize, lineHeight: LINE }} onMouseUp={handleSel} onTouchEnd={handleSel} onContextMenu={(e) => e.preventDefault()}>
        {isFirst && (
          <div className="lm-chap-head">
            <div className="lm-chap-kicker" style={{ fontSize: fontSize*0.6 }}>Capítulo {chapter?.numero ?? chapterIndex + 1}</div>
            <div className="lm-chap-title" style={{ fontSize: fontSize*1.55 }}>{chapter?.titulo}</div>
            <div className="lm-chap-rule" />
          </div>
        )}
        {parrafos.length === 0 && <div className="lm-page-msg">— fin del capítulo —</div>}
        {parrafos.map((p, i) => {
          if (p.tipo === 'separador') return <div key={p.id ?? `s${i}`} className="lm-sep">❧</div>
          const sfx = (mediaByParrafo[p.id] || []).filter(m => m.origen === 'explicito' && m.tipo === 'audio')
          const text = p.contenido || ''
          const textLower = text.toLowerCase()
          const anchors = []
          const sfxUnanchored = []
          for (const s of sfx) {
            const ref = s.metadata?.texto_ref
            if (ref) {
              const pos = textLower.indexOf(ref.toLowerCase())
              if (pos !== -1) {
                anchors.push({ start: pos, end: pos + ref.length, s })
              } else {
                const partialStart = findPrefixAtEnd(text, ref)
                if (partialStart !== -1) {
                  anchors.push({ start: partialStart, end: text.length, s })
                } else {
                  const partialEnd = findSuffixAtStart(text, ref)
                  if (partialEnd !== -1) anchors.push({ start: 0, end: partialEnd, s })
                }
              }
            } else {
              sfxUnanchored.push(s)
            }
          }
          anchors.sort((a, b) => a.start - b.start)
          let sfxContent = null
          if (anchors.length > 0) {
            sfxContent = []
            let last = 0
            for (const { start, end, s } of anchors) {
              if (last < start) sfxContent.push(<span key={`t${last}`}>{text.slice(last, start)}</span>)
              sfxContent.push(<span key={`s${start}`} className="sfx-glow" onClick={(e) => { e.stopPropagation(); onPlaySfx(s) }}>{text.slice(start, end)}</span>)
              last = end
            }
            if (last < text.length) sfxContent.push(<span key={`t${last}`}>{text.slice(last)}</span>)
          }
          const paraGlow = sfxUnanchored.length > 0 && anchors.length === 0
          const handleParaClick = paraGlow ? (e) => { e.stopPropagation(); onPlaySfx(sfxUnanchored[0]) } : undefined
          return (
            <p key={p.id ?? `p${i}`} data-parrafo-id={p.id}
              onClick={paraGlow ? handleParaClick : undefined}
              className={'lm-para' + (p.tipo==='dialogo'?' dlg':'') + (paraGlow ? ' sfx-glow' : '')}
              style={{ fontFamily: font }}>
              {sfxContent ?? p.contenido}
            </p>
          )
        })}
      </div>
      <div className="lm-pagenum">{pageNum}</div>
      <div className={'lm-turn left' + (atStart?' disabled':'')} onClick={atStart?undefined:onPrev}>
        <span>‹</span><div className="corner" />
      </div>
      <div className={'lm-turn right' + (onNext?'':' disabled') + (nextIsChapter?' next-chapter':'')} onClick={onNext || undefined}>
        <span>{nextIsChapter ? '✦' : '›'}</span><div className="corner" />
      </div>
    </div>
  )
}
