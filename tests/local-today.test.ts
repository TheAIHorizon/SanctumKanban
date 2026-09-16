import test from 'node:test'
import assert from 'node:assert/strict'
import { dateKey } from '../src/lib/gantt'
import { getLocalDay, watchLocalDay } from '../src/hooks/useLocalToday'

class FakeEventTarget {
  listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) || new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string) {
    for (const listener of Array.from(this.listeners.get(type) || [])) listener()
  }
}

test('local-day watcher refreshes at midnight and on focus, then cleans up', () => {
  let now = new Date(2026, 8, 16, 23, 59, 59, 900)
  let nextTimerId = 0
  const timers = new Map<number, { callback: () => void; delay: number }>()
  const clock = {
    now: () => now,
    setTimeout: (callback: () => void, delay: number) => {
      const id = ++nextTimerId
      timers.set(id, { callback, delay })
      return id
    },
    clearTimeout: (id: unknown) => timers.delete(id as number),
  }
  const windowTarget = new FakeEventTarget()
  const documentTarget = new FakeEventTarget()
  const observed: string[] = []

  assert.equal(dateKey(getLocalDay(clock.now)), '2026-09-16')
  const stop = watchLocalDay(day => observed.push(dateKey(day)!), {
    clock,
    windowTarget,
    documentTarget,
  })

  assert.equal(timers.size, 1)
  assert.equal(Array.from(timers.values())[0].delay, 100)
  now = new Date(2026, 8, 17, 0, 0, 0, 0)
  Array.from(timers.values())[0].callback()
  assert.deepEqual(observed, ['2026-09-17'])

  now = new Date(2026, 8, 18, 9, 0, 0, 0)
  windowTarget.dispatch('focus')
  assert.deepEqual(observed, ['2026-09-17', '2026-09-18'])

  now = new Date(2026, 8, 19, 9, 0, 0, 0)
  documentTarget.dispatch('visibilitychange')
  assert.deepEqual(observed, ['2026-09-17', '2026-09-18', '2026-09-19'])

  stop()
  assert.equal(timers.size, 0)
  assert.equal(windowTarget.listeners.get('focus')?.size, 0)
  assert.equal(documentTarget.listeners.get('visibilitychange')?.size, 0)
})
