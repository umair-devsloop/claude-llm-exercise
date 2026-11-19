const test = require('node:test');
const assert = require('node:assert');
const { SCHEMAS, parseAndValidate, scoreAgainstExpected } = require('../src/extract');
const { estimateCostUsd } = require('../src/pricing');

const invoiceSchema = SCHEMAS.invoice;
const validInvoice = Object.fromEntries(invoiceSchema.required.map((key) => [key, null]));

test('parseAndValidate classifies every failure mode', () => {
  assert.strictEqual(parseAndValidate(JSON.stringify(validInvoice), invoiceSchema, 'end_turn').status, 'valid');
  assert.strictEqual(parseAndValidate('{"invoice_number": "X"', invoiceSchema, 'end_turn').status, 'invalid_json');
  assert.strictEqual(parseAndValidate('{"invoice_number": "X"}', invoiceSchema, 'end_turn').status, 'schema_mismatch');
  assert.strictEqual(parseAndValidate('[]', invoiceSchema, 'end_turn').status, 'schema_mismatch');
  assert.strictEqual(parseAndValidate('null', invoiceSchema, 'end_turn').status, 'schema_mismatch');
  assert.strictEqual(parseAndValidate('{"a":', invoiceSchema, 'max_tokens').status, 'truncated');
  assert.strictEqual(parseAndValidate('', invoiceSchema, 'refusal').status, 'refused');
});

test('scoreAgainstExpected ignores case, whitespace and float noise but not wrong values', () => {
  const expected = { vendor_name: 'PixelForge Studio LLC', total: 1976.4, due_date: '2026-12-03' };
  const actual = { vendor_name: '  PIXELFORGE   studio llc ', total: 1976.400001, due_date: '2026-11-03' };
  const score = scoreAgainstExpected(actual, expected);
  assert.strictEqual(score.matched, 2);
  assert.strictEqual(score.total, 3);
  assert.deepStrictEqual(score.mismatchedFields, ['due_date']);
});

test('scoreAgainstExpected treats a missing field as a mismatch, not a match on undefined', () => {
  const score = scoreAgainstExpected({}, { deadline: null });
  assert.strictEqual(score.matched, 0);
});

test('estimateCostUsd uses per-million pricing and returns null for unknown models', () => {
  assert.strictEqual(estimateCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000), 6);
  assert.strictEqual(estimateCostUsd('claude-sonnet-4-6', 1000, 500), 0.0105);
  assert.strictEqual(estimateCostUsd('not-a-model', 1000, 500), null);
});
