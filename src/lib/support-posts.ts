import { z } from 'zod'
export const SUPPORT_KINDS = { BUG: 'Bug report', FEATURE: 'Feature request' } as const
export const SUPPORT_STATUSES = { NEW: 'New', PLANNED: 'Planned', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' } as const
export const supportKind = z.enum(['BUG', 'FEATURE'])
export const supportStatus = z.enum(['NEW', 'PLANNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
export const createSupportPost = z.object({
  kind: supportKind,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10000),
  steps: z.string().trim().max(5000).optional().default(''),
}).strict()
export const updateSupportPost = z.object({ status: supportStatus, staffReply: z.string().trim().max(10000), updatedAt: z.string().datetime() }).strict()
export const canUseSupport = (role: string) => ['ADMIN', 'TEAM_LEAD', 'MEMBER'].includes(role)
export const supportWhere = (user: { id: string; role: string }) => user.role === 'ADMIN' ? {} : { authorId: user.id }
export interface SupportPostView {
  id: string; kind: keyof typeof SUPPORT_KINDS; title: string; description: string; steps: string
  status: keyof typeof SUPPORT_STATUSES; staffReply: string; createdAt: string; updatedAt: string
  author: { firstName: string; lastName: string } | null
}
