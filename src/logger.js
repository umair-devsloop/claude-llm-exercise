const fs = require('fs')
const path = require('path')

const RESULTS_DIR = path.join(__dirname, '..', 'results')

function saveResults(records) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const fileName = `experiment-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const filePath = path.join(RESULTS_DIR, fileName)
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2))
  return filePath
}

const sum = (numbers) => numbers.reduce((a, b) => a + b, 0)
const average = (numbers) => (numbers.length ? sum(numbers) / numbers.length : null)

function summarizeGroup(group) {
  // Failed API calls return no usage and are not billed, so only answered runs count.
  const answered = group.filter((r) => r.status !== 'api_error')
  const accuracies = answered.map((r) => r.accuracy?.accuracy).filter((a) => typeof a === 'number')
  const avgAccuracy = average(accuracies)
  const costs = answered.map((r) => r.costUsd)
  return {
    model: group[0].model,
    temperature: group[0].temperature,
    runs: group.length,
    valid: answered.filter((r) => r.status === 'valid').length,
    errors: group.length - answered.length,
    avgAccuracy: avgAccuracy === null ? 'n/a' : `${(avgAccuracy * 100).toFixed(1)}%`,
    avgMs: Math.round(average(group.map((r) => r.durationMs))),
    inputTokens: sum(answered.map((r) => r.inputTokens)),
    outputTokens: sum(answered.map((r) => r.outputTokens)),
    costUsd: costs.includes(null) ? 'unknown model price' : sum(costs).toFixed(6),
  }
}

// One row per model + temperature, aggregated over all samples and runs.
function printSummary(records) {
  const groups = Object.groupBy(records, (r) => `${r.model}@${r.temperature}`)
  console.table(Object.values(groups).map(summarizeGroup))
}

module.exports = { saveResults, printSummary }
