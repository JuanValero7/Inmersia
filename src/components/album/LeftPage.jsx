import AudioPlayer from './AudioPlayer.jsx'
import Placa from './Placa.jsx'
import Seccion from './Seccion.jsx'

// Página izquierda: placa (progreso + stats, sin portada) + banda sonora +
// accesos (Investigación · Foro · Leer) y, debajo, la sección Lugares.
export default function LeftPage({ entry, onOpenBook, onGoForo, onGoInvestigacion, onPegar }) {
  const { libro, pct, previewAudio, stats, secciones } = entry

  return (
    <div className="album-page album-page-left">
      <div className="album-bookhead">
        <p className="kick">Álbum · tu colección</p>
        <h2 className="album-book-title">{libro.title}</h2>
        <p className="album-book-author">{libro.author}</p>
      </div>

      <div className="album-topblock">
        {/* ── PLACA (sin portada) ── */}
        <Placa pct={pct} leido={libro.leido} stats={stats} />

        {/* ── música + accesos ── */}
        <div className="album-topside">
          <AudioPlayer url={previewAudio} />
          <div className="album-access">
            <button className="album-acc" data-c="investigacion" onClick={() => onGoInvestigacion(libro)}>
              <span className="aic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg></span>
              <span className="alab">Investigación</span>
            </button>
            <button className="album-acc" data-c="foro" onClick={() => onGoForo(libro)}>
              <span className="aic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg></span>
              <span className="alab">Foro</span>
            </button>
            <button className="album-acc" data-c="leer" onClick={() => onOpenBook(libro)}>
              <span className="aic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.25C10.83 5.48 9.25 5 7.5 5S4.17 5.48 3 6.25v13C4.17 18.48 5.75 18 7.5 18s3.33.48 4.5 1.25m0-13C13.17 5.48 14.75 5 16.5 5S19.83 5.48 21 6.25v13C19.83 18.48 18.25 18 16.5 18s-3.33.48-4.5 1.25m0-13v13" /></svg></span>
              <span className="alab">Leer</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Lugares (debajo de la placa) — solo ficción, no ficción va toda en Infografías ── */}
      {libro.es_ficcion !== false && (
        <Seccion label="Lugares" seccion="lugares" color="var(--verde)" data={secciones.lugares} onPegar={onPegar} />
      )}
    </div>
  )
}
