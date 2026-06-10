/**
 * scan-secrets.mjs
 * Escanea src/ y archivos .env en busca de secretos hardcodeados o variables
 * de entorno expuestas al cliente (VITE_/REACT_APP_) con sufijos peligrosos.
 * Exits 0 → limpio. Exits 1 → hallazgos críticos o altos.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Subir un nivel desde scripts/ al root del proyecto
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── Patrones de secretos hardcodeados en código fuente ───────────────────────
const SECRET_PATTERNS = [
  {
    name: 'Clave privada (bloque PEM)',
    severity: 'CRITICAL',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY/,
  },
  {
    name: 'Supabase service_role JWT hardcodeado',
    severity: 'CRITICAL',
    // JWT con role=service_role en el payload (base64 contiene "service_role")
    re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/,
  },
  {
    name: 'JWT hardcodeado en código fuente (no en import.meta.env)',
    severity: 'HIGH',
    // Cualquier JWT literal que NO sea una referencia a env var
    re: /(?<!import\.meta\.env\.\w{0,60})(?<![`'"]VITE_\w{0,60}['"`]\s*[=:]\s*)['"`](eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)['"`]/,
  },
  {
    name: 'Stripe secret key',
    severity: 'CRITICAL',
    re: /sk_(?:live|test)_[A-Za-z0-9]{20,}/,
  },
  {
    name: 'OpenAI API key',
    severity: 'CRITICAL',
    re: /sk-[A-Za-z0-9]{32,}/,
  },
  {
    name: 'AWS access key ID',
    severity: 'CRITICAL',
    re: /AKIA[0-9A-Z]{16}/,
  },
  {
    name: 'GitHub token',
    severity: 'HIGH',
    re: /gh[pousr]_[A-Za-z0-9]{36,}/,
  },
  {
    name: 'SendGrid API key',
    severity: 'HIGH',
    re: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/,
  },
  {
    name: 'Credencial hardcodeada (password/secret/token = literal)',
    severity: 'HIGH',
    re: /(?:password|secret|token|api_?key)\s*[:=]\s*['"`][A-Za-z0-9!@#$%^&*_\-+=]{16,}['"`]/i,
  },
]

// ── Sufijos de variable de entorno que NO deben exponerse al cliente ──────────
// VITE_ y REACT_APP_ son embebidos en el bundle → visibles para el usuario final
const DANGEROUS_ENV_SUFFIXES = [
  'SERVICE_ROLE',
  'SERVICE_KEY',
  'ADMIN_KEY',
  'ADMIN_SECRET',
  'SECRET',
  'PRIVATE',
  'PRIVATE_KEY',
  'BACKEND',
  'WEBHOOK_SECRET',
  'SIGNING_SECRET',
  'SIGNING_KEY',
]

// Nombres VITE_ seguros por diseño (claves públicas de Supabase)
const SAFE_ENV_NAMES = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_ANON_KEY',
])

const IGNORE_DIRS  = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'scripts'])
const SRC_EXTS     = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs'])

const findings = []

// ── Escaneo de código fuente (src/) ──────────────────────────────────────────
function scanSourceFile(filePath) {
  const ext = path.extname(filePath)
  if (!SRC_EXTS.has(ext)) return

  const rel  = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/')
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split('\n')

  for (const { name, severity, re } of SECRET_PATTERNS) {
    const regex = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let match
    while ((match = regex.exec(text)) !== null) {
      const lineIdx = text.slice(0, match.index).split('\n').length - 1
      const line    = lines[lineIdx] || ''
      // Ignorar líneas comentadas o que referencian variables de entorno
      if (/^\s*(\/\/|\*)/.test(line)) continue
      if (line.includes('import.meta.env')) continue
      if (line.includes('process.env')) continue
      findings.push({ severity, file: rel, line: lineIdx + 1, rule: name, snippet: line.trim().slice(0, 120) })
    }
  }
}

function walkSrc(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkSrc(full)
    else scanSourceFile(full)
  }
}

// ── Escaneo de archivos .env ──────────────────────────────────────────────────
function scanEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const rel   = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/')
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (!raw || raw.startsWith('#') || !raw.includes('=')) continue

    const eqIdx   = raw.indexOf('=')
    const varName = raw.slice(0, eqIdx).trim()
    const value   = raw.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!value || value.length < 10) continue

    const upper = varName.toUpperCase()
    const isClientExposed = upper.startsWith('VITE_') || upper.startsWith('REACT_APP_')
    if (!isClientExposed) continue
    if (SAFE_ENV_NAMES.has(varName)) continue

    const hasDangerousSuffix = DANGEROUS_ENV_SUFFIXES.some(s => upper.endsWith(s) || upper.includes('_' + s + '_'))
    if (hasDangerousSuffix) {
      findings.push({
        severity: 'CRITICAL',
        file: rel,
        line: i + 1,
        rule: `Variable de entorno peligrosa expuesta al cliente: ${varName}`,
        snippet: `${varName}=***REDACTED***`,
      })
    }
  }
}

// ── Ejecutar ──────────────────────────────────────────────────────────────────
const srcDir = path.join(PROJECT_ROOT, 'src')
if (fs.existsSync(srcDir)) walkSrc(srcDir)

// Escanear todos los .env* en la raíz
for (const f of fs.readdirSync(PROJECT_ROOT)) {
  if (f.startsWith('.env')) scanEnvFile(path.join(PROJECT_ROOT, f))
}

// ── Reporte ───────────────────────────────────────────────────────────────────
const critical = findings.filter(f => f.severity === 'CRITICAL')
const high     = findings.filter(f => f.severity === 'HIGH')

console.log('\n── Inmersia Secret Scanner ──────────────────────────────')
if (findings.length === 0) {
  console.log('✓ Sin hallazgos. Código fuente limpio.\n')
  process.exit(0)
}

function print(label, items) {
  if (!items.length) return
  console.log(`\n[${label}] ${items.length} hallazgo(s):`)
  for (const f of items) {
    console.log(`  ${f.file}:${f.line}  →  ${f.rule}`)
    console.log(`  ${f.snippet}`)
  }
}

print('CRITICAL', critical)
print('HIGH', high)
console.log(`\nResumen: ${critical.length} críticos, ${high.length} altos`)

if (critical.length > 0 || high.length > 0) {
  console.error('\n✗ Se encontraron secretos. Corrige los hallazgos antes de continuar.\n')
  process.exit(1)
}

process.exit(0)
