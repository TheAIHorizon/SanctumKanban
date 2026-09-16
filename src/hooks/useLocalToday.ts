'use client'

import { useEffect, useState } from 'react'

export interface LocalDayClock {
  now: () => Date
  setTimeout: (callback: () => void, delay: number) => unknown
  clearTimeout: (timer: unknown) => void
}

export interface LocalDayEventTarget {
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

interface LocalDayWatcherOptions {
  clock?: LocalDayClock
  windowTarget?: LocalDayEventTarget
  documentTarget?: LocalDayEventTarget
}

const systemClock: LocalDayClock = {
  now: () => new Date(),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: timer => window.clearTimeout(timer as number),
}

export function getLocalDay(now: () => Date = () => new Date()): Date {
  const value = now()
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}

export function watchLocalDay(
  onDayChange: (day: Date) => void,
  {
    clock = systemClock,
    windowTarget = window,
    documentTarget = document,
  }: LocalDayWatcherOptions = {}
): () => void {
  let currentDay = getLocalDay(clock.now)
  let timer: unknown

  const scheduleNextMidnight = () => {
    if (timer !== undefined) clock.clearTimeout(timer)
    const now = clock.now()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)
    timer = clock.setTimeout(refresh, Math.max(1, nextMidnight.getTime() - now.getTime()))
  }

  const refresh = () => {
    const nextDay = getLocalDay(clock.now)
    if (nextDay.getTime() !== currentDay.getTime()) {
      currentDay = nextDay
      onDayChange(nextDay)
    }
    scheduleNextMidnight()
  }

  windowTarget.addEventListener('focus', refresh)
  documentTarget.addEventListener('visibilitychange', refresh)
  scheduleNextMidnight()

  return () => {
    if (timer !== undefined) clock.clearTimeout(timer)
    windowTarget.removeEventListener('focus', refresh)
    documentTarget.removeEventListener('visibilitychange', refresh)
  }
}

export function useLocalToday(): Date {
  const [today, setToday] = useState(getLocalDay)

  useEffect(() => watchLocalDay(setToday), [])

  return today
}
