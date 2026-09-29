import { useEffect } from 'react'
import { Link } from 'react-router-dom'

/**
 * Pantalla para una URL que no existe.
 *
 * POR QUÉ NO ES UN <Navigate to="/">
 * Lo era, y Search Console lo marcaba como «Soft 404» y como «Página con
 * redirección»: el servidor devolvía 200 con el contenido de la portada, y
 * Google, al renderizar, veía además un cambio de URL. Las dos cosas son
 * señales de sitio mal mantenido, y la redirección silenciosa además le
 * escondía al usuario que el enlace que siguió estaba roto.
 *
 * Un SPA no puede devolver un 404 de verdad: el archivo ya salió del servidor
 * con un 200 mucho antes de que React decida qué pintar. La solución que
 * documenta el propio Google para este caso es la etiqueta `noindex`, que es
 * lo que hace el efecto de abajo. Se retira al desmontar para no envenenar la
 * siguiente pantalla, que comparte el mismo documento.
 */
export default function NoEncontrada() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      padding: '2rem', textAlign: 'center',
      background: '#f5efe2', color: '#4a3622',
      fontFamily: "'Baloo 2', system-ui, sans-serif",
    }}>
      <p style={{ fontSize: 64, margin: 0, lineHeight: 1 }}>📖</p>
      <h1 style={{ fontSize: 26, margin: 0, fontWeight: 700 }}>
        Esta página no existe
      </h1>
      <p style={{ margin: 0, maxWidth: 380, opacity: 0.75, lineHeight: 1.6 }}>
        El enlace que seguiste está roto o la página cambió de sitio.
      </p>
      <Link to="/" style={{
        marginTop: 8, padding: '12px 26px', borderRadius: 999,
        background: '#f2792a', color: '#fffdf8',
        textDecoration: 'none', fontWeight: 600,
      }}>
        Volver al inicio
      </Link>
    </div>
  )
}
