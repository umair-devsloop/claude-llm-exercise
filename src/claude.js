const Anthropic = require('@anthropic-ai/sdk')

// SDK 1.x defaults to API version 2026-10-21, which rejects `temperature`. 2023-06-01 still accepts it.
const client = new Anthropic({
  maxRetries: 4,
  defaultHeaders: { 'anthropic-version': '2023-06-01' },
})

async function requestStructuredJson({ model, temperature, system, userText, schema, maxTokens }) {
  const response = await client.messages.create({
    model,
    temperature,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userText }],
    output_config: { format: { type: 'json_schema', schema } },
  })

  return {
    text: response.content.find((block) => block.type === 'text')?.text ?? '',
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

module.exports = { requestStructuredJson }
