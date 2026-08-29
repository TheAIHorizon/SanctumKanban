/**
 * DCWF importer — populates the DcwfElement / DcwfWorkRole / DcwfKsat /
 * DcwfRoleKsat reference tables from JSON.
 *
 * Two input shapes are accepted:
 *
 *  A) A single combined file (the documented "bring your own workbook" format):
 *       npm run db:import-dcwf -- --file path/to/dcwf.json
 *     where dcwf.json = {
 *       "version": "5.2",
 *       "elements":  [{ "name","code?","opr?","description?" }],
 *       "workRoles": [{ "code","title","element?","description?" }],
 *       "ksats":     [{ "id","type","description" }],
 *       "mapping":   [{ "workRoleCode","ksatId","coreOrAdditional?" }]
 *     }
 *
 *  B) The four separate files under prisma/dcwf-data/ (default):
 *       elements.json, work-roles.json, ksats.json, mapping.json
 *     (the shape exported from the official DCWF workbook).
 *
 * Idempotent: upserts by natural keys (element name, role code, ksat id).
 * Safe to re-run to update after editing the source data.
 *
 * See prisma/dcwf-data/README.md for the full format spec.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()
const DATA_DIR = join(__dirname, 'dcwf-data')

// Work-role codes marked in-scope for the Enterprise Network course exercise
// (enterprise build + week-13 pentest/hardening/IR). Instructors can toggle
// more roles on later in the app; this is just the sensible default set.
const IN_SCOPE_CODES = new Set([
  '411', // Technical Support Specialist
  '421', // Database Administrator
  '431', // Knowledge Manager
  '441', // Network Operations Specialist
  '451', // System Administrator
  '452', // Secure Configuration Specialist
  '511', // Cyber Defense Analyst
  '521', // Cyber Defense Infrastructure Support Specialist
  '531', // Cyber Defense Incident Responder
  '541', // Vulnerability Assessment Analyst
  '212', // Cyber Defense Forensics Analyst
  '612', // Security Control Assessor
  '621', // Software Developer
  '632', // Systems Developer
  '422', // Data Analyst
  '722', // Information Systems Security Manager
])

interface ElementIn { name: string; code?: string; opr?: string; description?: string }
interface RoleIn { code: string; title: string; element?: string; description?: string }
interface KsatIn { id: string; type: string; description: string }
interface MappingIn { workRoleCode?: string; workRole?: string; ksatId: string; coreOrAdditional?: string }

function loadInput(): { elements: ElementIn[]; workRoles: RoleIn[]; ksats: KsatIn[]; mapping: MappingIn[]; version?: string } {
  const fileArgIdx = process.argv.indexOf('--file')
  if (fileArgIdx !== -1 && process.argv[fileArgIdx + 1]) {
    const p = process.argv[fileArgIdx + 1]
    console.log(`Loading combined DCWF file: ${p}`)
    const doc = JSON.parse(readFileSync(p, 'utf-8'))
    return {
      version: doc.version,
      elements: doc.elements ?? [],
      workRoles: doc.workRoles ?? [],
      ksats: doc.ksats ?? [],
      mapping: doc.mapping ?? [],
    }
  }
  // default: four separate files
  const need = ['elements.json', 'work-roles.json', 'ksats.json', 'mapping.json']
  for (const f of need) {
    if (!existsSync(join(DATA_DIR, f))) {
      throw new Error(`Missing ${f} in ${DATA_DIR}. Provide --file <combined.json> or populate prisma/dcwf-data/.`)
    }
  }
  const read = (f: string) => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8'))
  return {
    elements: read('elements.json'),
    workRoles: read('work-roles.json'),
    ksats: read('ksats.json'),
    mapping: read('mapping.json'),
  }
}

async function main() {
  console.log('Importing DCWF reference data...\n')
  const { elements, workRoles, ksats, mapping, version } = loadInput()
  if (version) console.log(`DCWF version: ${version}`)

  // 1) Elements
  const elementIdByName = new Map<string, string>()
  for (const e of elements) {
    const rec = await prisma.dcwfElement.upsert({
      where: { name: e.name },
      update: { code: e.code ?? null, opr: e.opr ?? null, description: e.description ?? null },
      create: { name: e.name, code: e.code ?? null, opr: e.opr ?? null, description: e.description ?? null },
    })
    elementIdByName.set(e.name, rec.id)
  }
  console.log(`Elements:   ${elements.length}`)

  // 2) Work roles (link to element by name if present)
  const roleIdByCode = new Map<string, string>()
  for (const r of workRoles) {
    const elementId = r.element ? elementIdByName.get(r.element) ?? null : null
    const rec = await prisma.dcwfWorkRole.upsert({
      where: { code: r.code },
      update: { title: r.title, elementId, description: r.description ?? null, inScope: IN_SCOPE_CODES.has(r.code) },
      create: { code: r.code, title: r.title, elementId, description: r.description ?? null, inScope: IN_SCOPE_CODES.has(r.code) },
    })
    roleIdByCode.set(r.code, rec.id)
  }
  console.log(`Work roles: ${workRoles.length}  (in-scope: ${workRoles.filter((r) => IN_SCOPE_CODES.has(r.code)).length})`)

  // 3) KSATs
  const ksatIdByFrameworkId = new Map<string, string>()
  for (const k of ksats) {
    const rec = await prisma.dcwfKsat.upsert({
      where: { ksatId: k.id },
      update: { type: k.type, description: k.description },
      create: { ksatId: k.id, type: k.type, description: k.description },
    })
    ksatIdByFrameworkId.set(k.id, rec.id)
  }
  console.log(`KSATs:      ${ksats.length}`)

  // 4) Mapping (role <-> ksat)
  let mapped = 0
  let skipped = 0
  for (const m of mapping) {
    const code = m.workRoleCode ?? m.workRole
    const roleId = code ? roleIdByCode.get(String(code)) : undefined
    const ksatId = ksatIdByFrameworkId.get(String(m.ksatId))
    if (!roleId || !ksatId) { skipped++; continue }
    await prisma.dcwfRoleKsat.upsert({
      where: { workRoleId_ksatId: { workRoleId: roleId, ksatId } },
      update: { coreOrAdditional: m.coreOrAdditional ?? null },
      create: { workRoleId: roleId, ksatId, coreOrAdditional: m.coreOrAdditional ?? null },
    })
    mapped++
  }
  console.log(`Mapping:    ${mapped} rows${skipped ? ` (skipped ${skipped} with unknown role/ksat)` : ''}`)

  // Summary from DB
  const [e, w, k, rk, scoped, tasks] = await Promise.all([
    prisma.dcwfElement.count(),
    prisma.dcwfWorkRole.count(),
    prisma.dcwfKsat.count(),
    prisma.dcwfRoleKsat.count(),
    prisma.dcwfWorkRole.count({ where: { inScope: true } }),
    prisma.dcwfKsat.count({ where: { type: 'Task' } }),
  ])
  console.log(`\nDB now: elements=${e}, workRoles=${w} (inScope=${scoped}), ksats=${k} (tasks=${tasks}), mapping=${rk}`)
  console.log('DCWF import complete.')
}

main()
  .catch((err) => { console.error('Import failed:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
