import React from 'react'

/** Keep the work classification visible even when ticket details are compact. */
export function WorkflowBadges({ names }: { names: string[] }) {
  const labels = Array.from(new Set(names.filter(name => name === 'Required' || name === 'Bonus / Extra')))
  if (!labels.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {labels.map(label => (
        <span key={label} className="rounded border border-current px-1 text-[10px] font-medium">{label}</span>
      ))}
    </div>
  )
}
