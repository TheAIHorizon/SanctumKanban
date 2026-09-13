import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkflowBadges } from '../src/components/kanban/WorkflowBadges'

test('compact workflow badges distinguish required and bonus work without unrelated tags', () => {
  const html = renderToStaticMarkup(React.createElement(WorkflowBadges, { names: ['Required', 'Bonus / Extra', 'Linux'] }))
  assert.match(html, /Required/)
  assert.match(html, /Bonus \/ Extra/)
  assert.doesNotMatch(html, /Linux/)
  assert.equal(renderToStaticMarkup(React.createElement(WorkflowBadges, { names: ['Linux'] })), '')
})
