import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import useIsMobile from './hooks/useIsMobile.js'
import { useSuperuser } from './hooks/useSuperuser.js'
import Auth from './components/Auth.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import TourResume from './components/TourResume.jsx'
import { LectorRoute } from './components/LectorRoute.jsx'

const VistaBiblioteca       = lazy(() => import('./components/Biblioteca.jsx'))
const VistaLectura          = lazy(() => import('./components/Lector.jsx'))
const VistaTienda           = lazy(() => import('./components/Tienda.jsx'))
const CartelaView           = lazy(() => import('./components/Cartelera.jsx'))
const VistaPerfil           = lazy(() => import('./components/Perfil.jsx'))
const VistaForo             = lazy(() => import('./components/Foro.jsx'))
const VistaForoMobile       = lazy(() => import('./components/mobile/ForoMobile.jsx'))
const VistaPerfilMobile     = lazy(() => import('./components/mobile/PerfilMobile.jsx'))
const VistaBibliotecaMobile = lazy(() => import('./components/mobile/BibliotecaMobile.jsx'))
const CarteleraMobile       = lazy(() => import('./components/mobile/CarteleraMobile.jsx'))
const VistaLecturaMobile    = lazy(() => import('./components/mobile/LectorMobile.jsx'))
const Landing               = lazy(() => import('./components/Landing.jsx'))
const LandingMobile         = lazy(() => import('./components/mobile/LandingMobile.jsx'))

const Fallback = (
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'var(--bg-warm)'}}>
    <div className="spinner" style={{width:32,height:32,borderWidth:3,borderColor:'rgba(139,77,42,0.2)',borderTopColor:'#8b4d2a'}}/>
    <p style={{fontFamily:"'Playfair Display',serif",color:'#9a6a4a',fontSize:'1rem'}}>Abriendo la biblioteca…</p>
  </div>
)

// Redirige a /auth si no hay sesión activa
function ProtectedRoute({ user }) {
  if (!user) return <Navigate to="/auth" replace />
  return <Outlet />
}

// Página de login/registro — lee la pestaña inicial del state de navegación
function AuthPage({ setUser, loadLastBooks }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const initialTab = location.state?.tab ?? 'login'
  return (
    <Auth
      initialTab={initialTab}
      onBack={() => navigate('/')}
      onAuthSuccess={(u) => { setUser(u); loadLastBooks(u); navigate('/biblioteca', { replace: true }) }}
    />
  )
}

export default function App() {
  const [user,                setUser]                = useState(undefined)
  const [authReady,           setAuthReady]           = useState(false)
  const [currentBook,         setCurrentBook]         = useState(null)
  const [lastOpenedBookIds,   setLastOpenedBookIds]   = useState([])
  const [foroSource,          setForoSource]          = useState('biblioteca')
  const [lectorStartNotebook, setLectorStartNotebook] = useState(false)
  const [cartelaJumpId,       setCartelaJumpId]       = useState(null)

  const navigate    = useNavigate()
  const isMobile    = useIsMobile()
  const isSuperuser = useSuperuser(user ?? null)

  const Foro        = isMobile ? VistaForoMobile       : VistaForo
  const Perfil      = isMobile ? VistaPerfilMobile     : VistaPerfil
  const Biblioteca  = isMobile ? VistaBibliotecaMobile : VistaBiblioteca
  const Cartelera   = isMobile ? CarteleraMobile       : CartelaView
  const Lectura     = isMobile ? VistaLecturaMobile    : VistaLectura
  const LandingView = isMobile ? LandingMobile         : Landing

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

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      setAuthReady(true)
      if (u) loadLastBooks(u)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') { navigate('/reset-password'); return }
      if (event === 'SIGNED_OUT') {
        setLastOpenedBookIds([])
        navigate('/')
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [loadLastBooks, navigate])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setLastOpenedBookIds([])
    navigate('/')
  }

  function pushBookId(bookId, currentUser) {
    setLastOpenedBookIds(prev => {
      const next = [bookId, ...prev.filter(id => id !== bookId)].slice(0, 3)
      if (currentUser) localStorage.setItem(`inm_last_books_${currentUser.id}`, JSON.stringify(next))
      return next
    })
  }

  const handleOpenBook = useCallback((book) => {
    pushBookId(book.id, user)
    setCurrentBook(book)
    navigate(`/libro/${book.slug || book.id}`)
  }, [user, navigate])

  const handleGoNotebook = useCallback((book) => {
    pushBookId(book.id, user)
    setCurrentBook(book)
    setLectorStartNotebook(true)
    navigate(`/libro/${book.slug || book.id}`)
  }, [user, navigate])

  if (!authReady) return Fallback

  return (
    <>
      <Suspense fallback={Fallback}>
        <Routes>

          {/* Raíz: landing pública o redirección a biblioteca */}
          <Route path="/" element={
            user
              ? <Navigate to="/biblioteca" replace />
              : <LandingView
                  onAuth={(tab) => navigate('/auth', { state: { tab } })}
                  onGoTienda={() => navigate('/tienda')}
                />
          } />

          {/* Auth */}
          <Route path="/auth" element={
            user
              ? <Navigate to="/biblioteca" replace />
              : <AuthPage setUser={setUser} loadLastBooks={loadLastBooks} />
          } />

          {/* Reset de contraseña (Supabase redirige aquí) */}
          <Route path="/reset-password" element={
            <ResetPassword onDone={() => navigate('/biblioteca', { replace: true })} />
          } />

          {/* Tienda — pública para explorar; comprar y leer requiere auth */}
          <Route path="/tienda" element={
            <VistaTienda
              onGoBack={() => navigate(user ? '/biblioteca' : '/')}
              user={user}
              onOpenBook={handleOpenBook}
              isSuperuser={isSuperuser}
            />
          } />

          {/* Lector — público para invitados (máx. 2 caps por RLS) y completo para usuarios */}
          <Route path="/libro/:slug" element={
            <LectorRoute
              LectorCmp={Lectura}
              user={user}
              currentBook={currentBook}
              isSuperuser={isSuperuser}
              lectorStartNotebook={lectorStartNotebook}
              setLectorStartNotebook={setLectorStartNotebook}
              setCartelaJumpId={setCartelaJumpId}
              setForoSource={setForoSource}
            />
          } />

          {/* Rutas protegidas (requieren sesión) */}
          <Route element={<ProtectedRoute user={user} />}>

            <Route path="/biblioteca" element={
              <Biblioteca
                user={user}
                lastOpenedBookIds={lastOpenedBookIds}
                onSignOut={handleSignOut}
                onOpenBook={handleOpenBook}
                onGoTienda={() => navigate('/tienda')}
                onGoPerfil={() => navigate('/perfil')}
                onGoForo={(book) => {
                  setCurrentBook(book)
                  setForoSource('biblioteca')
                  navigate(`/foro/${book.slug || book.id}`)
                }}
                onGoNotebook={handleGoNotebook}
              />
            } />

            <Route path="/perfil" element={
              <Perfil
                user={user}
                onGoBack={() => navigate('/biblioteca')}
                onSignOut={handleSignOut}
              />
            } />

            {/* Cartelera y Foro dependen de currentBook en esta fase.
                Si se accede directamente sin book en estado, redirige a biblioteca. */}
            <Route path="/cartelera/:slug" element={
              currentBook
                ? <Cartelera
                    onGoBack={() => navigate(`/libro/${currentBook.slug || currentBook.id}`)}
                    book={currentBook}
                    user={user}
                    onGoForo={() => {
                      setForoSource('cartelera')
                      navigate(`/foro/${currentBook.slug || currentBook.id}`)
                    }}
                    onGoBiblioteca={() => navigate('/biblioteca')}
                    jumpToItemId={cartelaJumpId}
                    onJumpConsumed={() => setCartelaJumpId(null)}
                    isSuperuser={isSuperuser}
                  />
                : <Navigate to="/biblioteca" replace />
            } />

            <Route path="/foro/:slug" element={
              currentBook
                ? <Foro
                    book={currentBook}
                    user={user}
                    onGoBack={() => {
                      const dest = foroSource === 'cartelera'
                        ? `/cartelera/${currentBook.slug || currentBook.id}`
                        : foroSource === 'lectura'
                          ? `/libro/${currentBook.slug || currentBook.id}`
                          : '/biblioteca'
                      navigate(dest)
                    }}
                    onGoLectura={() => navigate(`/libro/${currentBook.slug || currentBook.id}`)}
                    onGoBiblioteca={() => navigate('/biblioteca')}
                    onGoCartelera={() => navigate(`/cartelera/${currentBook.slug || currentBook.id}`)}
                  />
                : <Navigate to="/biblioteca" replace />
            } />

          </Route>

          {/* Cualquier ruta desconocida → raíz */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Suspense>
      <TourResume />
    </>
  )
}
