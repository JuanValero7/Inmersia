// Formato: Plain JavaScript (.jsx)
// Gato de la Cartelera: puramente decorativo (esquina inferior izquierda del
// cuaderno). La navegación de vuelta al landing vive en la pestaña grande.
export default function Signpost({ gatoColor = 'negro' }) {
  return (
    <div className="cart-signpost" aria-hidden="true">
      <img className="cart-sign-img" src={`/assets/cartelera/gato-${gatoColor}-2.webp`} alt="" />
    </div>
  )
}
