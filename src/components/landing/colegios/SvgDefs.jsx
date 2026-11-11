// src/components/landing/colegios/SvgDefs.jsx
// ─────────────────────────────────────────────────────────────
// Íconos de la landing para colegios, definidos una vez y usados con <Icono>.
// Las ids llevan el prefijo lc- para no chocar con otros <symbol> de la app.
// ─────────────────────────────────────────────────────────────
/* eslint-disable no-restricted-syntax -- hex a propósito: colores de las banderas y de los íconos ilustrados (ovillo, sol) */

export function Icono({ id, className }) {
  return <svg className={className} aria-hidden="true"><use href={`#lc-${id}`} /></svg>
}

export function Ovillos({ n }) {
  return Array.from({ length: n }, (_, i) => <Icono key={i} id="ovillo" className="lc-cz-ovillo" />)
}

export default function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="lc-ovillo" viewBox="0 0 48 48"><path d="M33 33 q5 9 13 7" fill="none" stroke="#a83246" strokeWidth="2" strokeLinecap="round" /><circle cx="22" cy="22" r="17" fill="#d9536a" stroke="#4a3622" strokeWidth="2.4" /><g fill="none" stroke="#a83246" strokeWidth="2" strokeLinecap="round"><path d="M8 16 q14 -7 27 5" /><path d="M6 24 q16 -9 31 4" /><path d="M10 32 q13 -10 25 -1" /><path d="M17 6 q-7 15 2 32" /><path d="M26 6 q-8 15 0 32" /></g></symbol>
      <symbol id="lc-sol" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#f2b23a" stroke="#4a3622" strokeWidth="1.5" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="#4a3622" strokeWidth="1.5" strokeLinecap="round" /></symbol>
      <symbol id="lc-luna" viewBox="0 0 24 24"><path d="M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5z" fill="#eef0f7" stroke="#eef0f7" strokeWidth="1.2" /></symbol>
      <symbol id="lc-corazon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.6 1.2 4.4 2.5.8-1.3 2.2-2.5 4.4-2.5 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" /></symbol>
      <symbol id="lc-f-pe" viewBox="0 0 26 18"><rect width="26" height="18" fill="#fff" /><rect width="8.7" height="18" fill="#d91023" /><rect x="17.3" width="8.7" height="18" fill="#d91023" /></symbol>
      <symbol id="lc-f-ar" viewBox="0 0 26 18"><rect width="26" height="18" fill="#fff" /><rect width="26" height="6" fill="#74acdf" /><rect y="12" width="26" height="6" fill="#74acdf" /><circle cx="13" cy="9" r="2" fill="#f6b40e" /></symbol>
      <symbol id="lc-f-cl" viewBox="0 0 26 18"><rect width="26" height="18" fill="#d52b1e" /><rect width="26" height="9" fill="#fff" /><rect width="9" height="9" fill="#0039a6" /><path d="M4.5 2.2l.8 2.4h2.5l-2 1.5.8 2.4-2.1-1.5-2.1 1.5.8-2.4-2-1.5h2.5z" fill="#fff" /></symbol>
      <symbol id="lc-f-mx" viewBox="0 0 26 18"><rect width="26" height="18" fill="#fff" /><rect width="8.7" height="18" fill="#006847" /><rect x="17.3" width="8.7" height="18" fill="#ce1126" /><circle cx="13" cy="9" r="2.2" fill="#8c6a2f" /></symbol>
      <symbol id="lc-f-co" viewBox="0 0 26 18"><rect width="26" height="18" fill="#ce1126" /><rect width="26" height="13.5" fill="#003893" /><rect width="26" height="9" fill="#fcd116" /></symbol>
    </svg>
  )
}
