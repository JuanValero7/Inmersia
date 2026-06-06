import { useState, useEffect } from 'react'
import { driver } from 'driver.js'
import { getTourPhase, getPhaseInfo } from './guidedTour.js'

export default function TourResume() {
  const [phase, setPhase] = useState(getTourPhase)

  useEffect(() => {
    const handler = () => setPhase(getTourPhase())
    window.addEventListener('inm-tour-change', handler)
    return () => window.removeEventListener('inm-tour-change', handler)
  }, [])

  if (!phase) return null
  const info = getPhaseInfo(phase)
  if (!info) return null

  const handleClick = () => {
    const d = driver({
      showProgress:  false,
      overlayColor:  'rgba(50, 34, 18, 0.72)',
      smoothScroll:  true,
      allowClose:    true,
      doneBtnText:   '¡Entendido!',
      steps: [{
        popover: {
          title:       `Tu tour · ${info.label}`,
          description: info.hint,
        },
      }],
    })
    d.drive()
  }

  return (
    <button
      onClick={handleClick}
      title="Ver dónde estás en el tutorial"
      style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 2000,
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fffdf8', border: '2px solid #4a3622',
        borderRadius: 999, padding: '9px 16px',
        fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 13,
        color: '#4a3622', cursor: 'pointer',
        boxShadow: '2px 3px 0 rgba(74,54,34,0.25)',
        transition: 'transform .14s, box-shadow .14s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '2px 4px 0 rgba(74,54,34,0.32)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 3px 0 rgba(74,54,34,0.25)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
      </svg>
      Retomar tutorial
    </button>
  )
}
