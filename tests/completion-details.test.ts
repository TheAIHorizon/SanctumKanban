import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TicketCompletionDetails } from '../src/components/kanban/TicketCompletionDetails'

test('completion details are read-only and display the recorded UTC finish', () => {
  const html = renderToStaticMarkup(React.createElement(TicketCompletionDetails, { status: 'DONE', completedAt: '2026-09-15T12:34:00.000Z' }))
  assert.match(html, /Actual completion/)
  assert.match(html, /2026-09-15T12:34:00.000Z/)
  assert.match(html, /UTC/)
  assert.doesNotMatch(html, /<input|<select/)
})

test('legacy completion remains unknown and unfinished tickets explain automatic recording', () => {
  const legacy = renderToStaticMarkup(React.createElement(TicketCompletionDetails, { status: 'DONE', completedAt: null }))
  assert.match(legacy, /Completion date not recorded/)
  const active = renderToStaticMarkup(React.createElement(TicketCompletionDetails, { status: 'DOING', completedAt: null }))
  assert.match(active, /automatically/)
})
