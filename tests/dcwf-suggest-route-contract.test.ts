import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/api/dcwf/suggest/route.ts', 'utf8')
const helper = readFileSync('src/lib/dcwf-suggest.ts', 'utf8')

test('suggest API enforces ticket-scoped authorization before inference', () => {
  assert.match(source, /ticketId is required/)
  assert.match(source, /authorizeDcwfSuggestion/)
  assert.ok(source.indexOf('authorizeDcwfSuggestion') < source.indexOf('await generateAdvice('))
  assert.match(source, /role === 'OBSERVER'/)
})

test('suggest API retrieves every eligible Task then locally bounds positive candidates', () => {
  assert.match(source, /type:\s*'Task'/)
  assert.match(source, /rankDcwfTasks\(text, importedTasks, 20\)/)
  const retrieval = source.slice(source.indexOf('dcwfKsat.findMany'), source.indexOf('rankDcwfTasks'))
  assert.doesNotMatch(retrieval, /take:/)
  assert.doesNotMatch(source, /candidates\.slice\(0, 5\)[\s\S]*fallback/)
})

test('suggest API uses bounded dedicated coaching inference and complete response metadata', () => {
  assert.match(source, /AI_COACH_MODEL\s*\|\|\s*'laguna-s'/)
  assert.match(helper, /maxTokens:\s*1800/)
  assert.match(helper, /timeoutMs:\s*45_000/)
  assert.match(source, /text\.length\s*>\s*12_000/)
  assert.match(source, /candidateCount:\s*candidates\.length/)
  assert.match(source, /model:\s*generated\.model/)
})
