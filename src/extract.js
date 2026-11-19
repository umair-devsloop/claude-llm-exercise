const { requestStructuredJson } = require('./claude')

const MAX_TOKENS = 2048

const nullable = (type) => ({ anyOf: [{ type }, { type: 'null' }] })

// Structured outputs require every property in `required` and additionalProperties: false.
// Missing values are expressed as null instead.
const strictObject = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

const SCHEMAS = {
  email: strictObject({
    sender_name: nullable('string'),
    sender_email: nullable('string'),
    company: nullable('string'),
    phone: nullable('string'),
    subject: nullable('string'),
    request_type: { type: 'string', enum: ['quote_request', 'order', 'complaint', 'support', 'other'] },
    deadline: nullable('string'),
    budget_amount: nullable('number'),
    currency: nullable('string'),
    summary: { type: 'string' },
    action_items: { type: 'array', items: { type: 'string' } },
  }),
  invoice: strictObject({
    invoice_number: nullable('string'),
    invoice_date: nullable('string'),
    due_date: nullable('string'),
    vendor_name: nullable('string'),
    customer_name: nullable('string'),
    currency: nullable('string'),
    line_items: {
      type: 'array',
      items: strictObject({
        description: { type: 'string' },
        quantity: { type: 'number' },
        unit_price: { type: 'number' },
        line_total: { type: 'number' },
      }),
    },
    subtotal: nullable('number'),
    tax_amount: nullable('number'),
    total: nullable('number'),
  }),
}

function buildSystemPrompt(docType) {
  return [
    `You extract structured data from a messy ${docType}.`,
    'Use only information stated in the document. If a value is missing or unclear, use null. Never guess.',
    'Dates: YYYY-MM-DD. Resolve relative dates (e.g. "net 30") only when the base date is in the document.',
    'Currency: ISO 4217 code (e.g. USD). Amounts: plain numbers without symbols or thousands separators.',
  ].join('\n')
}

function parseAndValidate(text, schema, stopReason) {
  if (stopReason === 'refusal') {
    return { status: 'refused', data: null, error: 'Model refused the request' }
  }
  if (stopReason === 'max_tokens') {
    return { status: 'truncated', data: null, error: `Output hit max_tokens (${MAX_TOKENS})` }
  }

  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    return { status: 'invalid_json', data: null, error: error.message }
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'schema_mismatch', data, error: 'Response is not a JSON object' }
  }
  const missing = schema.required.filter((key) => !(key in data))
  if (missing.length > 0) {
    return { status: 'schema_mismatch', data, error: `Missing fields: ${missing.join(', ')}` }
  }
  return { status: 'valid', data, error: null }
}

// Makes comparison tolerant to case, whitespace and float noise, not to wrong values.
function normalize(value) {
  if (typeof value === 'string') {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
  }
  if (typeof value === 'number') {
    return Math.round(value * 100) / 100
  }
  if (Array.isArray(value)) {
    return value.map(normalize)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]))
  }
  return value
}

// Scores only the fields present in the expected (ground truth) file.
function scoreAgainstExpected(actual, expected) {
  const fields = Object.keys(expected)
  const mismatchedFields = fields.filter(
    (field) => !actual || JSON.stringify(normalize(actual[field])) !== JSON.stringify(normalize(expected[field])),
  )
  const matched = fields.length - mismatchedFields.length
  return {
    matched,
    total: fields.length,
    accuracy: fields.length === 0 ? null : matched / fields.length,
    mismatchedFields,
  }
}

async function extractDocument({ model, temperature, docType, text }) {
  const schema = SCHEMAS[docType]
  const reply = await requestStructuredJson({
    model,
    temperature,
    system: buildSystemPrompt(docType),
    userText: `<document>\n${text}\n</document>`,
    schema,
    maxTokens: MAX_TOKENS,
  })
  return { ...reply, ...parseAndValidate(reply.text, schema, reply.stopReason) }
}

module.exports = { SCHEMAS, extractDocument, parseAndValidate, scoreAgainstExpected }
