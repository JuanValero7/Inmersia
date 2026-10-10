// Tira de predicción (variante B de Documentation/lector/mockups-cuaderno.html).
// ─────────────────────────────────────────────────────────────
// Antes, al terminar un capítulo se abría el Cuaderno SOLO y el siguiente no
// arrancaba hasta cerrarlo. Ahora esta tira aparece en la ÚLTIMA página del
// capítulo, antes de pasar al siguiente: "Anotar predicción" abre el Cuaderno
// en ese capítulo; la × la cierra. Quien la ignora y avanza, avanza: el lector
// la deja de mostrar al cambiar de capítulo.
//
// Compartida por escritorio y móvil. En móvil va más arriba (`movil`) para no
// tapar al gato, que abre la bandeja de herramientas. En escritorio se sube
// sobre el borde inferior del libro: pegada al fondo de la ventana no se veía.
export default function TiraPrediccion({ capNum, onAnotar, onCerrar, movil = false }) {
  return (
    <div role="status" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: movil ? 78 : 110, zIndex: 40,
      width: movil ? 'calc(100% - 28px)' : 'auto', maxWidth: 620, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: 12,
      background: '#fffdf8', border: '2px solid #4a3622', borderRadius: movil ? 18 : 999,
      padding: movil ? '10px 10px 10px 14px' : '7px 8px 7px 18px',
      boxShadow: '2px 4px 0 rgba(74,54,34,0.22), 0 10px 24px rgba(0,0,0,0.15)',
      fontFamily: "'Baloo 2', sans-serif",
    }}>
      <span aria-hidden="true" style={{ color: '#BE6173', fontSize: 16 }}>✎</span>
      <span style={{ flex: movil ? 1 : 'none', fontWeight: 700, fontSize: movil ? 13 : 13.5, color: '#4a3622', lineHeight: 1.25, whiteSpace: movil ? 'normal' : 'nowrap' }}>
        {movil ? `Fin del cap. ${capNum}: ¿qué crees que pasará?` : `Fin del capítulo ${capNum}. ¿Qué crees que pasará?`}
      </span>
      <button type="button" onClick={onAnotar}
        style={{ flexShrink: 0, fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: '#F2792A', color: '#fff', border: '2px solid #4a3622', borderRadius: 999, padding: '6px 15px', boxShadow: '1.5px 2px 0 rgba(74,54,34,0.35)', whiteSpace: 'nowrap' }}>
        {movil ? 'Anotar' : 'Anotar predicción'}
      </button>
      <button type="button" onClick={onCerrar} aria-label="Cerrar" title="Cerrar"
        style={{ flexShrink: 0, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1.5px solid rgba(74,54,34,0.35)', borderRadius: '50%', color: '#9a6a4a', cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1, padding: 0 }}>×</button>
    </div>
  )
}
