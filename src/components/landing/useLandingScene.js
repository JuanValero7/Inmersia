// src/components/landing/useLandingScene.js
// ─────────────────────────────────────────────────────────────
// Efectos de la landing, encapsulados para Landing.jsx y LandingMobile.jsx:
//  1) reveal-on-scroll (IntersectionObserver sobre [data-reveal])
//  2) rotación de mundos del portal + reposicionado de los chips
// Porta 1:1 la lógica del prototipo estático. Manipula el DOM dentro
// de `rootRef` para no requerir estado React por cada frame.
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import { CHIP_POS, CHIP_WORLDS } from './landingData.js'

export function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
        })
      },
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    // Fallback: si algo no disparó (p.ej. layout corto), revela todo.
    const t = setTimeout(() => {
      root.querySelectorAll('[data-reveal]:not(.in)').forEach((el) => el.classList.add('in'))
    }, 1300)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [rootRef])
}

export function usePortal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const worlds = Array.from(root.querySelectorAll('.inm-world'))
    const chips = [root.querySelector('.inm-chip.cA'), root.querySelector('.inm-chip.cB')]
    if (!worlds.length || !chips[0]) return

    const place = (chip, item) => {
      chip.querySelector('.inm-d').style.background = item.c
      chip.querySelector('.inm-t').textContent = item.t
      const a = CHIP_POS[item.a]
      chip.style.left = a.left || ''
      chip.style.right = a.right || ''
      chip.style.top = a.top || ''
      chip.style.bottom = a.bottom || ''
      chip.classList.toggle('anchor-left', a.side === 'left')
      chip.classList.toggle('anchor-right', a.side === 'right')
    }
    const timers = []
    const paint = (i, animate) => {
      CHIP_WORLDS[i].forEach((item, k) => {
        const chip = chips[k]
        if (!chip) return
        if (animate) {
          chip.classList.add('swap')
          timers.push(setTimeout(() => { place(chip, item); chip.classList.remove('swap') }, 400))
        } else {
          place(chip, item)
        }
      })
    }
    paint(0, false)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let interval
    if (!reduce && worlds.length > 1) {
      let i = 0
      interval = setInterval(() => {
        worlds[i].classList.remove('active')
        i = (i + 1) % worlds.length
        worlds[i].classList.add('active')
        paint(i, true)
      }, 5200)
    }
    return () => { if (interval) clearInterval(interval); timers.forEach(clearTimeout) }
  }, [rootRef])
}
