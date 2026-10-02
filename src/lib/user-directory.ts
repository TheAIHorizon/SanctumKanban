export interface DirectoryClass {
  id: string
  name: string
  code: string | null
  term: string | null
  archivedAt: string | null
}
export interface DirectoryUser {
  id: string
  firstName: string
  lastName: string
  email: string
  contactInfo: string | null
  role: string
  createdAt: string
  classMemberships: { classWorkspace: DirectoryClass }[]
  teamMemberships: { team: { id: string; name: string; classWorkspaceId: string | null } }[]
}
export type UserSortColumn = 'name' | 'email' | 'contact' | 'role' | 'classes' | 'teams' | 'joined'
export type SortDirection = 'asc' | 'desc'
export const NO_CLASS = '__no_class__'
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
export const classLabel = (course: DirectoryClass) => [course.name, course.code, course.term, course.archivedAt ? 'Archived' : ''].filter(Boolean).join(' · ')
export function directoryTeams(user: DirectoryUser, classId: string) {
  return user.teamMemberships.filter(m => !classId || (classId !== NO_CLASS && m.team.classWorkspaceId === classId))
    .slice().sort((a, b) => collator.compare(a.team.name, b.team.name))
}
export function directoryClasses(user: DirectoryUser) {
  return user.classMemberships.map(m => m.classWorkspace).slice().sort((a, b) => collator.compare(classLabel(a), classLabel(b)))
}
const normalized = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').trim()
export function selectDirectoryUsers<T extends DirectoryUser>(users: readonly T[], options: { classId: string; search: string; column: UserSortColumn; direction: SortDirection }): T[] {
  const words = normalized(options.search).split(/[\s,]+/).filter(Boolean)
  const filtered = users.filter(user => {
    // Class enrollment is authoritative: students without a team still appear.
    if (options.classId === NO_CLASS ? user.classMemberships.length !== 0 : options.classId && !user.classMemberships.some(m => m.classWorkspace.id === options.classId)) return false
    const identity = normalized(`${user.firstName} ${user.lastName} ${user.email}`)
    return words.every(word => identity.includes(word))
  })
  function value(user: T): string | number {
    switch (options.column) {
      case 'name': return `${user.lastName}\u0000${user.firstName}`
      case 'email': return user.email
      case 'contact': return user.contactInfo?.trim() || ''
      case 'role': return user.role.replace(/_/g, ' ')
      case 'classes': return directoryClasses(user).map(classLabel).join('\u0000')
      case 'teams': return directoryTeams(user, options.classId).map(m => m.team.name).join('\u0000')
      case 'joined': return Number.isFinite(Date.parse(user.createdAt)) ? Date.parse(user.createdAt) : ''
    }
  }
  return filtered.sort((a, b) => {
    const av = value(a), bv = value(b)
    // Put empty cells last in either direction, with stable name/ID tie breaks.
    if (av === '' && bv !== '') return 1
    if (bv === '' && av !== '') return -1
    const compared = typeof av === 'number' && typeof bv === 'number' ? av - bv : collator.compare(String(av), String(bv))
    return compared * (options.direction === 'asc' ? 1 : -1) || collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName) || collator.compare(a.id, b.id)
  })
}
