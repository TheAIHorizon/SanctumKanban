'use client'

import { useEffect, useCallback } from 'react'

type ShortcutHandler = () => void

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: ShortcutHandler
  description: string
}

// Global registry for shortcuts
const shortcuts: ShortcutConfig[] = []

export function useKeyboardShortcuts(config: ShortcutConfig[]) {
  useEffect(() => {
    // Register shortcuts
    config.forEach((shortcut) => {
      if (!shortcuts.find((s) => s.key === shortcut.key && s.ctrl === shortcut.ctrl)) {
        shortcuts.push(shortcut)
      }
    })

    return () => {
      // Unregister shortcuts
      config.forEach((shortcut) => {
        const index = shortcuts.findIndex(
          (s) => s.key === shortcut.key && s.ctrl === shortcut.ctrl
        )
        if (index !== -1) {
          shortcuts.splice(index, 1)
        }
      })
    }
  }, [config])
}

export function useGlobalKeyboardHandler() {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable

    // Always allow Escape
    if (event.key === 'Escape') {
      const shortcut = shortcuts.find((s) => s.key === 'Escape')
      if (shortcut) {
        event.preventDefault()
        shortcut.handler()
      }
      return
    }

    // Don't trigger other shortcuts in inputs
    if (isInput) return

    // Find matching shortcut
    const shortcut = shortcuts.find((s) => {
      const keyMatch = s.key.toLowerCase() === event.key.toLowerCase()
      const ctrlMatch = s.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
      const shiftMatch = s.shift ? event.shiftKey : !event.shiftKey
      const altMatch = s.alt ? event.altKey : !event.altKey
      return keyMatch && ctrlMatch && shiftMatch && altMatch
    })

    if (shortcut) {
      event.preventDefault()
      shortcut.handler()
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Get all registered shortcuts for help display
export function getRegisteredShortcuts(): ShortcutConfig[] {
  return [...shortcuts]
}

// Common shortcut key display
export function formatShortcut(shortcut: ShortcutConfig): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')
  parts.push(shortcut.key.toUpperCase())
  return parts.join(' + ')
}
