const PRICES_PER_MILLION_TOKENS = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 }, // rate for prompts up to 100K tokens
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
}

// Returns null for unknown models so a missing price is never reported as $0.
function estimateCostUsd(model, inputTokens, outputTokens) {
  const price = PRICES_PER_MILLION_TOKENS[model]
  if (!price) {
    return null
  }
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

module.exports = { estimateCostUsd }
