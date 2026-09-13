export interface UserUpdatePrincipal {
  id: string
  role: string
}

export interface UserUpdateFields {
  email?: unknown
  role?: unknown
  password?: unknown
  currentPassword?: unknown
}

export type UserUpdateAuthorization =
  | { allowed: true; verifyCurrentPassword?: boolean }
  | { allowed: false; status: 400 | 403; error: string }

export function canAccessProfileSettings(role: string | undefined): boolean {
  return role !== undefined && role !== 'OBSERVER'
}

export function authorizeUserTargetUpdate(
  principal: UserUpdatePrincipal,
  targetUserId: string
): UserUpdateAuthorization {
  if (principal.role === 'OBSERVER') {
    return {
      allowed: false,
      status: 403,
      error: 'Observers cannot update profiles',
    }
  }

  if (principal.role !== 'ADMIN' && principal.id !== targetUserId) {
    return {
      allowed: false,
      status: 403,
      error: 'You can only update your own profile',
    }
  }

  return { allowed: true }
}

export function authorizeUserFieldUpdate(
  principal: UserUpdatePrincipal,
  fields: UserUpdateFields
): UserUpdateAuthorization {
  const isAdmin = principal.role === 'ADMIN'

  if (!isAdmin && (fields.role !== undefined || fields.email !== undefined)) {
    return {
      allowed: false,
      status: 403,
      error: 'Only admins can change user roles or email addresses',
    }
  }

  if (!isAdmin && fields.password !== undefined) {
    if (typeof fields.currentPassword !== 'string' || !fields.currentPassword) {
      return {
        allowed: false,
        status: 400,
        error: 'Current password is required',
      }
    }
    return { allowed: true, verifyCurrentPassword: true }
  }

  return { allowed: true, verifyCurrentPassword: false }
}
