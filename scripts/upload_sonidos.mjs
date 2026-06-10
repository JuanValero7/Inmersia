/**
 * upload_sonidos.mjs
 *
 * Carga los sonidos de un libro a Supabase y los asigna a párrafos.
 *
 * Uso (PowerShell):
 *   node scripts/upload_sonidos.mjs `
 *     --carpeta      "C:\...\Robinson Crusoe - Daniel Defoe" `
 *     --titulo       "Robinson Crusoe" `
 *     --simplificados "C:\...\robinsoncrusoe_sonidos_simplificados.csv" `
 *     --service-key  "eyJ..."
 *
 * VITE_SUPABASE_URL se lee automáticamente de .env.local.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUCKET = 'Biblioteca de Sonidos'

// ─── Args ────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const getArg = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null }

const carpeta        = getArg('--carpeta')
const titulo         = getArg('--titulo')
const simplificados  = getArg('--simplificados')
const serviceKey     = getArg('--service-key')

if (!carpeta || !titulo || !simplificados || !serviceKey) {
  console.error(`
Uso: node scripts/upload_sonidos.mjs \\
  --carpeta       "<ruta del libro>" \\
  --titulo        "<titulo exacto en la DB>" \\
  --simplificados "<ruta a _sonidos_simplificados.csv>" \\
  --service-key   "<service_role key de Supabase>"
`)
  process.exit(1)
}

// ─── Leer .env.local ─────────────────────────────────────────
function loadEnv(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv(join(PROJECT_ROOT, '.env.local'))

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = serviceKey

if (!SUPABASE_URL) {
  console.error('No se encontró VITE_SUPABASE_URL en .env.local.')
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ─── CSV parser ───────────────────────────────────────────────
function parseCSV(path) {
  const text = readFileSync(path, 'utf-8').replace(/^﻿/, '')
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { vals.push(cur); cur = '' }
      else { cur += ch }
    }
    vals.push(cur)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
}

// ─── Auto-detectar manifiesto en la carpeta ──────────────────
let manifiestoPath = null
for (const name of ['sonidos_generados3.csv', 'sonidos_generados2.csv', 'sonidos_generados.csv']) {
  const p = join(carpeta, name)
  if (existsSync(p)) { manifiestoPath = p; break }
}
if (!manifiestoPath) {
  console.error('No encontré sonidos_generados.csv en la carpeta del libro.')
  process.exit(1)
}

// ─── Leer fuentes ─────────────────────────────────────────────
const sfxDir = join(carpeta, 'sfx')
if (!existsSync(sfxDir)) {
  console.error(`No existe la carpeta sfx en: ${carpeta}`)
  process.exit(1)
}

const manRows = parseCSV(manifiestoPath)
const asigRows = parseCSV(simplificados).filter(r => r.libro === titulo)

// Mapa grupo → metadatos del manifiesto
const manMap = {}
manRows.forEach(r => { manMap[r.grupo] = r })

// Archivos MP3 en sfx/
const mp3Files = readdirSync(sfxDir).filter(f => /^grupo_\d+_.+\.mp3$/i.test(f))

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${titulo}
  MP3 en sfx/          : ${mp3Files.length}
  Asignaciones a párrafos: ${asigRows.length}
  Manifiesto             : ${basename(manifiestoPath)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

// ─── FASE 1: Storage + biblioteca_media ──────────────────────
console.log('▶  Fase 1 — Subiendo MP3 y registrando en biblioteca_media\n')

// slug por número de grupo (para usar en Fase 2)
const slugPorGrupo = {}

let subiOk = 0, subiErr = 0
const mediaRows = []

for (const file of mp3Files) {
  // Extraer número de grupo y nombre limpio
  const match = file.match(/^grupo_(\d+)_(.+)\.mp3$/i)
  if (!match) continue
  const grupoNum = match[1]            // "001"
  const cleanName = match[2]           // "quejido"
  const slug = cleanName               // slug = nombre limpio
  const storageFile = `${cleanName}.mp3`
  const localPath = join(sfxDir, file)

  slugPorGrupo[parseInt(grupoNum, 10).toString()] = slug  // "1" → "quejido"

  // Metadata del manifiesto (por número de grupo sin ceros)
  const meta = manMap[parseInt(grupoNum, 10).toString()]

  const buffer = readFileSync(localPath)
  const { error: upErr } = await supa.storage
    .from(BUCKET)
    .upload(storageFile, buffer, { contentType: 'audio/mpeg', upsert: true })

  if (upErr && !upErr.message.includes('already exists') && !upErr.message.includes('Duplicate')) {
    console.error(`  ✗ ${storageFile}: ${upErr.message}`)
    subiErr++
    continue
  }

  const { data: urlData } = supa.storage.from(BUCKET).getPublicUrl(storageFile)

  mediaRows.push({
    slug,
    tipo: 'audio',
    url: urlData.publicUrl,
    titulo: meta?.etiqueta ?? cleanName,
    tags: meta ? [meta.tipo_sonido] : [],
    metadata: meta ? {
      loop: meta.loop === 'True',
      volumen: parseInt(meta.creditos) || 60,
      tipo_sonido: meta.tipo_sonido,
    } : {}
  })

  console.log(`  ✓ ${storageFile}  →  slug: "${slug}"`)
  subiOk++
}

console.log(`\n  Storage: ${subiOk} subidos, ${subiErr} errores`)

// Upsert en biblioteca_media
if (mediaRows.length > 0) {
  const BATCH = 50
  for (let i = 0; i < mediaRows.length; i += BATCH) {
    const { error } = await supa
      .from('biblioteca_media')
      .upsert(mediaRows.slice(i, i + BATCH), { onConflict: 'slug' })
    if (error) console.error(`  ✗ biblioteca_media: ${error.message}`)
  }
  console.log(`  ✓ ${mediaRows.length} entradas en biblioteca_media`)
}

// ─── FASE 2: elementos_interactivos ──────────────────────────
console.log('\n▶  Fase 2 — Asignando sonidos a párrafos\n')

// Verificar que el libro exista
const { data: libro, error: libroErr } = await supa
  .from('libros').select('id').eq('titulo', titulo).single()

if (libroErr || !libro) {
  console.error(`✗ El libro "${titulo}" no existe en la DB. Cargá el libro primero.`)
  process.exit(1)
}

// Traer todos los capítulos y párrafos del libro de una vez
const { data: caps } = await supa
  .from('capitulos').select('id, numero').eq('libro_id', libro.id)

const capMap = {}
caps?.forEach(c => { capMap[c.numero] = c.id })

const { data: parrafos } = await supa
  .from('parrafos').select('id, numero, capitulo_id')
  .in('capitulo_id', Object.values(capMap))

const parIndex = {}
parrafos?.forEach(p => { parIndex[`${p.capitulo_id}:${p.numero}`] = p.id })

// Traer los IDs de biblioteca_media recién insertados
const slugsUsados = [...new Set(Object.values(slugPorGrupo))]
const { data: mediaDB } = await supa
  .from('biblioteca_media').select('id, slug').in('slug', slugsUsados)

const mediaIndex = {}
mediaDB?.forEach(m => { mediaIndex[m.slug] = m.id })

// Construir links
const links = []
const noResueltos = []

for (const a of asigRows) {
  const grupoKey = parseInt(a.grupo, 10).toString()
  const slug     = slugPorGrupo[grupoKey]
  const mediaId  = slug ? mediaIndex[slug] : null
  const capId    = capMap[parseInt(a.capitulo)]
  const parId    = capId ? parIndex[`${capId}:${parseInt(a.parrafo)}`] : null

  if (!mediaId || !parId) {
    noResueltos.push(`cap ${a.capitulo} par ${a.parrafo} grupo ${a.grupo}`)
    continue
  }

  links.push({ parrafo_id: parId, media_id: mediaId })
}

if (noResueltos.length) {
  console.warn(`  ⚠ No resueltos (${noResueltos.length}): ${noResueltos.slice(0, 5).join(' | ')}${noResueltos.length > 5 ? ' ...' : ''}`)
}

if (links.length > 0) {
  const BATCH = 100
  let linkOk = 0
  for (let i = 0; i < links.length; i += BATCH) {
    const { error } = await supa
      .from('elementos_interactivos')
      .upsert(links.slice(i, i + BATCH), { onConflict: 'parrafo_id,media_id', ignoreDuplicates: true })
    if (error) console.error(`  ✗ elementos_interactivos: ${error.message}`)
    else linkOk += links.slice(i, i + BATCH).length
  }
  console.log(`  ✓ ${linkOk} asignaciones insertadas`)
}

// ─── FASE 3: Marcar párrafos como interactivos ───────────────
console.log('\n▶  Fase 3 — Marcando párrafos interactivos\n')

const parIds = [...new Set(links.map(l => l.parrafo_id))]

if (parIds.length > 0) {
  const BATCH = 200
  for (let i = 0; i < parIds.length; i += BATCH) {
    const { error } = await supa
      .from('parrafos')
      .update({ tiene_interactivo: true })
      .in('id', parIds.slice(i, i + BATCH))
  }
  console.log(`  ✓ ${parIds.length} párrafos marcados como interactivos`)
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  Carga completa — ${titulo}
      Storage    : ${subiOk} archivos
      Media DB   : ${mediaRows.length} entradas
      Links DB   : ${links.length} párrafos con sonido
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
