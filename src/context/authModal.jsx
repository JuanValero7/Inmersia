// Contexto mínimo para abrir el pop-up de autenticación desde cualquier
// parte del árbol sin ir pasando callbacks por props. El estado y el render
// del modal viven en App.jsx; aquí solo se expone `openAuth(tab)`.
import { createContext, useContext } from 'react'

// Valor por defecto no-op: si algún componente llama openAuth fuera del
// Provider (no debería), simplemente no hace nada en vez de romper.
const AuthModalContext = createContext(() => {})

export function AuthModalProvider({ openAuth, children }) {
  return (
    <AuthModalContext.Provider value={openAuth}>
      {children}
    </AuthModalContext.Provider>
  )
}

// Devuelve openAuth(tab?: 'login' | 'registro').
export function useOpenAuth() {
  return useContext(AuthModalContext)
}
