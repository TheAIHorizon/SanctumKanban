'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const shortcuts = [
  { key: 'N', description: 'Create new ticket (when viewing a team)' },
  { key: 'Esc', description: 'Close dialog / Clear search' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: '/', description: 'Focus search' },
  { key: 'M', description: 'Toggle "My Tickets" filter' },
  { key: 'E', description: 'Toggle compact/expanded view' },
]

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted rounded border">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Shortcuts are disabled when typing in text fields.
        </p>
      </DialogContent>
    </Dialog>
  )
}
