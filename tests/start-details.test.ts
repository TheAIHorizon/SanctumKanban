import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { TicketStartDetails } from '../src/components/kanban/TicketStartDetails'

test('actual start is read-only and compares against a genuine planned start', () => {
  const html = renderToStaticMarkup(React.createElement(TicketStartDetails, {
    startedAt: '2026-09-12T12:34:00.000Z',
    startDate: '2026-09-10',
    startDateAutoFilled: false,
  }))
  assert.match(html, /Actual start/)
  assert.match(html, /2026-09-12T12:34:00.000Z/)
  assert.match(html, /Started 2 days late/)
  assert.doesNotMatch(html, /<input|<select/)
})

test('automatic start is not falsely described as on plan', () => {
  const html = renderToStaticMarkup(React.createElement(TicketStartDetails, {
    startedAt: '2026-09-10T12:34:00.000Z',
    startDate: '2026-09-10',
    startDateAutoFilled: true,
  }))
  assert.match(html, /no original plan/i)
  assert.doesNotMatch(html, /on plan/i)
})

test('not-yet-started tickets explain automatic recording', () => {
  const html = renderToStaticMarkup(React.createElement(TicketStartDetails, {
    startedAt: null, startDate: '2026-09-10', startDateAutoFilled: false,
  }))
  assert.match(html, /automatically/)
})
