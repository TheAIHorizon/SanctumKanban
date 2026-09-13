import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authorizeUserFieldUpdate,
  authorizeUserTargetUpdate,
  canAccessProfileSettings,
} from '../src/lib/user-profile-security'

const observer = { id: 'guest-observer', role: 'OBSERVER' }
const member = { id: 'member-1', role: 'MEMBER' }
const admin = { id: 'admin-1', role: 'ADMIN' }

test('observer receives 403 when updating its own shared guest profile', () => {
  assert.deepEqual(authorizeUserTargetUpdate(observer, observer.id), {
    allowed: false,
    status: 403,
    error: 'Observers cannot update profiles',
  })
})

test('profile settings are hidden from observers but available to authenticated account roles', () => {
  assert.equal(canAccessProfileSettings('OBSERVER'), false)
  assert.equal(canAccessProfileSettings('MEMBER'), true)
  assert.equal(canAccessProfileSettings('TEAM_LEAD'), true)
  assert.equal(canAccessProfileSettings('ADMIN'), true)
})

test('non-admin users may update only themselves while admins retain user management', () => {
  assert.equal(authorizeUserTargetUpdate(member, member.id).allowed, true)
  const crossUser = authorizeUserTargetUpdate(member, 'member-2')
  assert.equal(crossUser.allowed, false)
  if (crossUser.allowed) assert.fail('cross-user update unexpectedly allowed')
  assert.equal(crossUser.status, 403)
  assert.equal(authorizeUserTargetUpdate(admin, 'member-2').allowed, true)
})

test('non-admin profile writes cannot change email or role', () => {
  const emailChange = authorizeUserFieldUpdate(member, { email: 'new@example.test' })
  const roleChange = authorizeUserFieldUpdate(member, { role: 'ADMIN' })
  assert.equal(emailChange.allowed, false)
  assert.equal(roleChange.allowed, false)
  if (emailChange.allowed || roleChange.allowed) assert.fail('protected field update unexpectedly allowed')
  assert.equal(emailChange.status, 403)
  assert.equal(roleChange.status, 403)
  assert.equal(authorizeUserFieldUpdate(admin, { email: 'new@example.test', role: 'TEAM_LEAD' }).allowed, true)
})

test('self-service password changes require the current password while admin resets do not', () => {
  assert.deepEqual(authorizeUserFieldUpdate(member, { password: 'new-password' }), {
    allowed: false,
    status: 400,
    error: 'Current password is required',
  })
  assert.deepEqual(
    authorizeUserFieldUpdate(member, {
      password: 'new-password',
      currentPassword: 'old-password',
    }),
    { allowed: true, verifyCurrentPassword: true }
  )
  assert.deepEqual(authorizeUserFieldUpdate(admin, { password: 'reset-password' }), {
    allowed: true,
    verifyCurrentPassword: false,
  })
})
