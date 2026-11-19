require('dotenv').config({ quiet: true })

const fs = require('fs')
const path = require('path')
const { SCHEMAS, extractDocument, scoreAgainstExpected } = require('./extract')
const { estimateCostUsd } = require('./pricing')
const { saveResults, printSummary } = require('./logger')

const SAMPLES_DIR = path.join(__dirname, '..', 'samples')

function parseList(name) {
  return (process.env[name] || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function loadConfig() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Please set it in your environment or in a .env file.')
  }

  const models = parseList('CLAUDE_MODELS')
  if (models.length === 0) {
    throw new Error('CLAUDE_MODELS is empty. Example: CLAUDE_MODELS=claude-haiku-4-5,claude-sonnet-4-6')
  }

  const temperatures = parseList('TEMPERATURES').map(Number)
  if (temperatures.length === 0 || temperatures.some((t) => Number.isNaN(t) || t < 0 || t > 1)) {
    throw new Error('TEMPERATURES must be a comma-separated list of numbers between 0 and 1. Example: 0,0.7,1')
  }

  const runs = Number(process.env.RUNS_PER_CONFIG || 1)
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error('RUNS_PER_CONFIG must be a whole number of at least 1.')
  }

  return { models, temperatures, runs }
}

// Sample files are named <docType>[-anything].txt, with optional <same name>.expected.json.
function loadSamples() {
  const samples = []
  for (const fileName of fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.txt')).sort()) {
    const name = path.basename(fileName, '.txt')
    const docType = name.split('-')[0]
    if (!SCHEMAS[docType]) {
      console.warn(`Skipping ${fileName}: no schema for "${docType}" (expected: ${Object.keys(SCHEMAS).join(', ')}).`)
      continue
    }
    const text = fs.readFileSync(path.join(SAMPLES_DIR, fileName), 'utf8').trim()
    if (!text) {
      console.warn(`Skipping ${fileName}: file is empty.`)
      continue
    }
    const expectedPath = path.join(SAMPLES_DIR, `${name}.expected.json`)
    let expected = null
    if (fs.existsSync(expectedPath)) {
      try {
        expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'))
      } catch (error) {
        throw new Error(`Invalid JSON in ${path.basename(expectedPath)}: ${error.message}`)
      }
    }
    samples.push({ name, docType, text, expected })
  }
  if (samples.length === 0) {
    throw new Error(`No usable samples found in ${SAMPLES_DIR}.`)
  }
  return samples
}

async function runExperiment({ model, temperature, sample, runIndex }) {
  const record = { sample: sample.name, model, temperature, run: runIndex }
  const startedAt = performance.now()
  const elapsedMs = () => Math.round(performance.now() - startedAt)
  try {
    const result = await extractDocument({ model, temperature, docType: sample.docType, text: sample.text })
    return {
      ...record,
      durationMs: elapsedMs(),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: estimateCostUsd(model, result.inputTokens, result.outputTokens),
      status: result.status,
      error: result.error,
      accuracy: sample.expected && result.data ? scoreAgainstExpected(result.data, sample.expected) : null,
      extracted: result.data,
      rawText: result.status === 'valid' ? undefined : result.text,
    }
  } catch (error) {
    // API failures (bad model id, auth, rate limit after retries) are recorded, not fatal.
    const status = error.status ? ` ${error.status}` : ''
    return { ...record, durationMs: elapsedMs(), status: 'api_error', error: `${error.constructor.name}${status}: ${error.message}` }
  }
}

async function main() {
  const { models, temperatures, runs } = loadConfig()
  const samples = loadSamples()
  const total = models.length * temperatures.length * samples.length * runs
  console.log(`Running ${total} requests: ${models.length} models x ${temperatures.length} temperatures x ${samples.length} samples x ${runs} runs`)

  const records = []
  // Sequential on purpose: keeps latency numbers clean and avoids rate limits.
  for (const sample of samples) {
    for (const model of models) {
      for (const temperature of temperatures) {
        for (let runIndex = 1; runIndex <= runs; runIndex++) {
          const record = await runExperiment({ model, temperature, sample, runIndex })
          const score = record.accuracy ? ` accuracy=${record.accuracy.matched}/${record.accuracy.total}` : ''
          console.log(`[${records.length + 1}/${total}] ${sample.name} ${model} t=${temperature} -> ${record.status}${score}${record.error ? ` (${record.error})` : ''}`)
          records.push(record)
        }
      }
    }
  }

  printSummary(records)
  console.log(`Saved ${records.length} results to ${saveResults(records)}`)

  if (records.every((r) => r.status === 'api_error')) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
