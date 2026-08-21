import { marcasDelParrafo } from '../../../utils/readerHelpers.js'

const LINE = 1.72  // alto de línea (coincide con .lm-para en el CSS)

export default function MobileBookPage({ chapter, chapterIndex, parrafos, mediaByParrafo, subrayados = [], isFirst, pageNum, fontSize, font,
                    atStart, nextIsChapter, onPrev, onNext, hideArrows, onPlaySfx }) {
  const lineH = Math.round(fontSize * LINE)

  return (
    <div className="lm-page" data-screen-label={`Lector cap ${chapter?.numero ?? chapterIndex + 1}`}>
      <div className="lm-page-lines" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${lineH-1}px, rgba(150,110,60,0.05) ${lineH-1}px, rgba(150,110,60,0.05) ${lineH}px)` }} />
      <div className="lm-page-inner" data-lm-pagebox translate="no" style={{ fontSize, lineHeight: LINE }} onContextMenu={(e) => e.preventDefault()}>
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
          const { segmentos, sfxSinAnclar, anclados } = marcasDelParrafo(text, sfx, subrayados)
          const paraGlow = sfxSinAnclar.length > 0 && anclados === 0
          const handleParaClick = paraGlow ? (e) => { e.stopPropagation(); onPlaySfx(sfxSinAnclar[0]) } : undefined
          return (
            <p key={p.id ?? `p${i}`} data-parrafo-id={p.id}
              onClick={paraGlow ? handleParaClick : undefined}
              className={'lm-para' + (p.tipo==='dialogo'?' dlg':'') + (paraGlow ? ' sfx-glow' : '')}
              style={{ fontFamily: font }}>
              {segmentos
                ? segmentos.map(seg => (
                  <span key={seg.start}
                    className={[seg.sfx && 'sfx-glow', seg.subrayado && 'subrayado-marca'].filter(Boolean).join(' ') || undefined}
                    onClick={seg.sfx ? (e) => { e.stopPropagation(); onPlaySfx(seg.sfx) } : undefined}>
                    {seg.text}
                  </span>
                ))
                : text}
            </p>
          )
        })}
      </div>
      <div className="lm-pagenum">{pageNum}</div>
      {!hideArrows && (
        <>
          <div className={'lm-turn left' + (atStart?' disabled':'')} onClick={atStart?undefined:onPrev}>
            <span>‹</span><div className="corner" />
          </div>
          <div className={'lm-turn right' + (onNext?'':' disabled') + (nextIsChapter?' next-chapter':'')} onClick={onNext || undefined}>
            <span>{nextIsChapter ? '✦' : '›'}</span><div className="corner" />
          </div>
        </>
      )}
    </div>
  )
}
