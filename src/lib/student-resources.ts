export const RESOURCE_DEFINITIONS = [
  { key: 'NETWORK_MAP', label: 'Network map' },
  { key: 'RED_HAT', label: 'Red Hat' },
  { key: 'PROJECT_TUTORIAL', label: 'Project tutorial' },
  { key: 'VISIO_TUTORIAL', label: 'Visio tutorial' },
  { key: 'REQUIREMENTS_LIST', label: 'Requirements list' },
  { key: 'LAB_LINK', label: 'Lab link' },
  { key: 'EXTRAS', label: 'Extras' },
] as const

export const MAX_RESOURCE_URL_LENGTH = 2_048

export type ResourceKey = (typeof RESOURCE_DEFINITIONS)[number]['key']
export interface ResourceEntry { key: ResourceKey; url: string }
type Principal = { id: string; role: string }

const RESOURCE_KEYS = new Set<string>(RESOURCE_DEFINITIONS.map(({ key }) => key))

export function canReadClassResources(principal: Principal, memberUserIds: string[]): boolean {
  return principal.role === 'ADMIN' || principal.role === 'OBSERVER' || memberUserIds.includes(principal.id)
}

export function canWriteClassResources(principal: Principal, archived: boolean): boolean {
  return principal.role === 'ADMIN' && !archived
}

export function validateResourceUrl(value: string): boolean {
  if (!value || value.length > MAX_RESOURCE_URL_LENGTH) return false
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

export function resourceEntriesEqual(a: ResourceEntry[], b: ResourceEntry[]): boolean {
  if (a.length !== b.length) return false
  const byKey = new Map(a.map(({ key, url }) => [key, url]))
  return b.every(({ key, url }) => byKey.get(key) === url)
}

export function normalizeResourceEntries(value: unknown): ResourceEntry[] {
  if (!Array.isArray(value)) throw new Error('Resources must be an array')
  if (value.length > RESOURCE_DEFINITIONS.length) throw new Error('Resources must contain at most 7 entries')

  const seen = new Set<string>()
  return value.flatMap((entry): ResourceEntry[] => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid resource entry')
    const { key, url } = entry as { key?: unknown; url?: unknown }
    if (typeof key !== 'string' || !RESOURCE_KEYS.has(key)) throw new Error('Unknown resource')
    if (seen.has(key)) throw new Error('Duplicate resource')
    seen.add(key)
    if (typeof url !== 'string') throw new Error('Resource URL must be a string')
    const trimmed = url.trim()
    if (!trimmed) return []
    if (!validateResourceUrl(trimmed)) throw new Error('Resource URL must use http or https')
    return [{ key: key as ResourceKey, url: trimmed }]
  })
}
