'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { useGlobalKeyboardHandler } from '@/hooks/useKeyboardShortcuts'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'

interface KeyboardContextValue {
  showHelp: () => void
  hideHelp: () => void
  registerCreateTicketHandler: (handler: () => void) => void
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null)

export function useKeyboardContext() {
  const context = useContext(KeyboardContext)
  if (!context) {
    throw new Error('useKeyboardContext must be used within KeyboardShortcutsProvider')
  }
  return context
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [createTicketHandler, setCreateTicketHandler] = useState<(() => void) | null>(null)

  // Initialize global keyboard handler
  useGlobalKeyboardHandler()

  const showHelp = useCallback(() => setHelpOpen(true), [])
  const hideHelp = useCallback(() => setHelpOpen(false), [])

  const registerCreateTicketHandler = useCallback((handler: () => void) => {
    setCreateTicketHandler(() => handler)
  }, [])

  const value: KeyboardContextValue = {
    showHelp,
    hideHelp,
    registerCreateTicketHandler,
  }

  return (
    <KeyboardContext.Provider value={value}>
      {children}
      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </KeyboardContext.Provider>
  )
}
