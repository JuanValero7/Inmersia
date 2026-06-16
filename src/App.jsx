// src/App.jsx
// ─────────────────────────────────────────────────────────────
// MODIFICADO: ahora muestra la LANDING pública antes del Auth.
//   · Sin usuario y sin intención de entrar  → <Landing/> (o <LandingMobile/>)
//   · El usuario pulsa "Iniciar sesión" / "Crear cuenta" / "Empezar a leer"
//        → se abre <Auth/> en la pestaña correspondiente
//   · "← Volver" en Auth regresa a la landing
// El resto del archivo es idéntico al original.
// Cambios marcados con  // ⬅︎ LANDING
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase.js'
import useIsMobile from './hooks/useIsMobile.js'
import Auth from './components/Auth.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import TourResume from './components/TourResume.jsx'

const VistaBiblioteca = lazy(() => import('./components/Biblioteca.jsx'))
const VistaLectura    = lazy(() => import('./components/Lector.jsx'))
const VistaTienda     = lazy(() => import('./components/Tienda.jsx'))
const CartelaView     = lazy(() => import('./components/Cartelera.jsx'))
const VistaPerfil     = lazy(() => import('./components/Perfil.jsx'))
const VistaForo       = lazy(() => import('./components/Foro.jsx'))
const VistaForoMobile = lazy(() => import('./components/mobile/ForoMobile.jsx'))
const VistaPerfilMobile = lazy(() => import('./components/mobile/PerfilMobile.jsx'))
const VistaBibliotecaMobile = lazy(() => import('./components/mobile/BibliotecaMobile.jsx'))
const CarteleraMobile = lazy(() => import('./components/mobile/CarteleraMobile.jsx'))
const VistaLecturaMobile = lazy(() => import('./components/mobile/LectorMobile.jsx'))
const Landing         = lazy(() => import('./components/Landing.jsx'))            // ⬅︎ LANDING
const LandingMobile   = lazy(() => import('./components/mobile/LandingMobile.jsx')) // ⬅︎ LANDING

const Fallback = (
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'var(--bg-warm)'}}>
    <div className="spinner" style={{width:32,height:32,borderWidth:3,borderColor:'rgba(139,77,42,0.2)',borderTopColor:'#8b4d2a'}}/>
    <p style={{fontFamily:"'Playfair Display',serif",color:'#9a6a4a',fontSize:'1rem'}}>Abriendo la biblioteca…</p>
  </div>
)

export default function App() {
  const [view,                setView]                = useState('auth')
  const [user,                setUser]                = useState(undefined)
  const [authReady,           setAuthReady]           = useState(false)
  const [currentBook,         setCurrentBook]         = useState(null)
  const [lastOpenedBookIds,   setLastOpenedBookIds]   = useState([])
  const [foroSource,          setForoSource]          = useState('biblioteca')
  const [lectorStartNotebook, setLectorStartNotebook] = useState(false)
  const [cartelaJumpId,       setCartelaJumpId]       = useState(null)
  const [showAuth,            setShowAuth]            = useState(false)      // ⬅︎ LANDING
  const [authTab,             setAuthTab]             = useState('login')    // ⬅︎ LANDING

  const isMobile = useIsMobile()
  const Foro = isMobile ? VistaForoMobile : VistaForo
  const Perfil = isMobile ? VistaPerfilMobile : VistaPerfil
  const Biblioteca = isMobile ? VistaBibliotecaMobile : VistaBiblioteca
  const Cartelera = isMobile ? CarteleraMobile : CartelaView
  const Lectura = isMobile ? VistaLecturaMobile : VistaLectura
  const LandingView = isMobile ? LandingMobile : Landing   // ⬅︎ LANDING

  // ── Browser history ──────────────────────────────────────────
  const navigate = useCallback((newView) => {
    window.history.pushState({ view: newView }, '')
    setView(newView)
  }, [])

  useEffect(() => {
    const handlePopState = (e) => {
      const v = e.state?.view
      if (!v || v === 'auth' || v === 'reset-password') return
      setView(v)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Lee los últimos libros abiertos de localStorage (nuevo key, fallback al anterior)
  const loadLastBooks = useCallback((u) => {
    if (!u) return
    const savedNew = localStorage.getItem(`inm_last_books_${u.id}`)
    const savedOld = localStorage.getItem(`inm_last_book_${u.id}`)
    if (savedNew) {
      try { setLastOpenedBookIds(JSON.parse(savedNew)) } catch { /* ignore */ }
    } else if (savedOld) {
      setLastOpenedBookIds([savedOld])
    }
  }, [])

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      setAuthReady(true)
      if (u) {
        window.history.replaceState({ view: 'biblioteca' }, '')
        setView('biblioteca')
        loadLastBooks(u)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') { setView('reset-password'); return }
      if (!session) {
        window.history.replaceState({ view: 'auth' }, '')
        setView('auth')
        setLastOpenedBookIds([])
        setShowAuth(false)   // ⬅︎ LANDING — al cerrar sesión volvemos a la landing
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [loadLastBooks])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setLastOpenedBookIds([])
    window.history.replaceState({ view: 'auth' }, '')
    setView('auth')
    setShowAuth(false)   // ⬅︎ LANDING
  }

  // ── Helpers para actualizar historial de libros ───────────────
  function pushBookId(bookId, currentUser) {
    setLastOpenedBookIds(prev => {
      const next = [bookId, ...prev.filter(id => id !== bookId)].slice(0, 3)
      if (currentUser) localStorage.setItem(`inm_last_books_${currentUser.id}`, JSON.stringify(next))
      return next
    })
  }

  const handleOpenBook = (book) => {
    pushBookId(book.id, user)
    setCurrentBook(book)
    navigate('lectura')
  }

  const handleGoNotebook = useCallback((book) => {
    pushBookId(book.id, user)
    setCurrentBook(book)
    setLectorStartNotebook(true)
    navigate('lectura')
  }, [user, navigate])

  if (!authReady) return Fallback
  if (view === 'reset-password') return <ResetPassword onDone={() => { window.history.replaceState({ view: 'biblioteca' }, ''); setView('biblioteca') }} />

  // ── No hay usuario ────────────────────────────────────────────  // ⬅︎ LANDING
  if (!user) {
    if (showAuth) {
      return (
        <Auth
          initialTab={authTab}
          onBack={() => setShowAuth(false)}
          onAuthSuccess={(u) => { setUser(u); loadLastBooks(u); window.history.replaceState({ view: 'biblioteca' }, ''); setView('biblioteca') }}
        />
      )
    }
    return (
      <Suspense fallback={Fallback}>
        <LandingView onAuth={(tab) => { setAuthTab(tab === 'registro' ? 'registro' : 'login'); setShowAuth(true) }} />
      </Suspense>
    )
  }

  return (
    <>
    <Suspense fallback={Fallback}>
      {view === 'biblioteca' && (
        <Biblioteca
          user={user}
          lastOpenedBookIds={lastOpenedBookIds}
          onSignOut={handleSignOut}
          onOpenBook={handleOpenBook}
          onGoTienda={() => navigate('tienda')}
          onGoPerfil={() => navigate('perfil')}
          onGoForo={(book) => { setCurrentBook(book); setForoSource('biblioteca'); navigate('foro') }}
          onGoNotebook={handleGoNotebook}
        />
      )}
      {view === 'perfil' && (
        <Perfil
          user={user}
          onGoBack={() => navigate('biblioteca')}
          onSignOut={handleSignOut}
        />
      )}
      {view === 'tienda' && (
        <VistaTienda onGoBack={() => navigate('biblioteca')} user={user} onOpenBook={handleOpenBook}/>
      )}
      {view === 'cartelera' && (
        <Cartelera
          onGoBack={() => navigate('lectura')}
          book={currentBook}
          user={user}
          onGoForo={() => { setForoSource('cartelera'); navigate('foro') }}
          onGoBiblioteca={() => navigate('biblioteca')}
          jumpToItemId={cartelaJumpId}
          onJumpConsumed={() => setCartelaJumpId(null)}
        />
      )}
      {view === 'foro' && (
        <Foro
          book={currentBook}
          user={user}
          onGoBack={() => navigate(foroSource)}
          onGoLectura={() => navigate('lectura')}
          onGoBiblioteca={() => navigate('biblioteca')}
          onGoCartelera={() => navigate('cartelera')}
        />
      )}
      {view === 'lectura' && (
        <Lectura
          book={currentBook}
          onGoBack={() => navigate('biblioteca')}
          onGoCartelera={(itemId) => { setCartelaJumpId(itemId || null); navigate('cartelera') }}
          onGoForo={() => { setForoSource('lectura'); navigate('foro') }}
          startWithNotebook={lectorStartNotebook}
          onNotebookStarted={() => setLectorStartNotebook(false)}
        />
      )}
    </Suspense>
    <TourResume />
    </>
  )
}
