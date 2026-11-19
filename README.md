# Claude LLM Experimentation

A Node.js learning project. It sends a messy email and a messy invoice
to the Claude API, gets back structured JSON, and compares models and
temperatures on the same inputs: accuracy against known answers,
token usage, latency and cost.

## Setup

```bash
npm install
cp .env.example .env   # then put your API key in .env
```

`.env` settings:

| Variable | Example | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic API key (never commit `.env`) |
| `CLAUDE_MODELS` | `claude-haiku-4-5,claude-sonnet-4-6` | Models to compare |
| `TEMPERATURES` | `0,0.7,1` | Temperatures to compare (0 to 1) |
| `RUNS_PER_CONFIG` | `3` | Repeats of each combination, to see consistency |

## Run

```bash
npm start   # real API calls, costs money
npm test    # unit tests only, no API calls
```

The default config makes 36 requests: 2 models × 3 temperatures ×
2 samples × 3 runs. With Haiku 4.5 and Sonnet 4.6 that should cost
roughly $0.20 (an estimate; the summary shows the real figure).

Output:

- One progress line per request with its status and accuracy.
- A summary table per model + temperature: valid runs, errors,
  average accuracy, average latency, total tokens, total cost.
- Full details for every request in
  `results/experiment-<timestamp>.json` (git-ignored), including the
  extracted JSON and which fields were wrong.

## How accuracy is measured

Each sample in `samples/` can have a `<name>.expected.json` with the
correct answers. Only the fields in that file are scored. The
comparison ignores case, extra spaces and tiny rounding differences,
but a wrong date or amount counts as wrong. Free-text fields like
`summary` aren't scored because there's no single right answer.

To add a sample, create `samples/email-2.txt` or `samples/invoice-2.txt`
(the part before the first `-` picks the schema) and, optionally,
`samples/email-2.expected.json`. Use made-up data only.

## Things this project shows

- **Structured outputs:** the request includes a JSON schema
  (`output_config.format`), so the API constrains Claude's reply to
  that shape. The code still parses and checks the reply, because a
  response can be cut off (`max_tokens`) or refused.
- **Hallucinations:** the prompt asks for `null` when a value isn't in
  the document. The samples contain decoys (a PO number next to the
  invoice number, a disputed $2,300 invoice in the email) to see whether
  models pick the wrong value.
- **Temperature:** with `RUNS_PER_CONFIG` above 1 you can see whether
  higher temperatures give less consistent answers on the same input.
- **Tokens and cost:** input and output tokens come from each API
  response; cost = tokens × the per-million price in `src/pricing.js`.
  Output tokens cost 5× more than input tokens.

## Limitation: temperature on newer models

The current API version (`2026-10-21`, which SDK 1.x sends by default)
rejects `temperature` on every model, so `src/claude.js` pins the older
version `2023-06-01`. Claude 4.7 and later models (including Opus 5.5,
Sonnet 5.5 and Haiku 5.5) still reject custom temperatures. If you add
one to `CLAUDE_MODELS`, its runs show `api_error` instead of results.
To compare newer models, test them without a temperature setting.

## Project layout

- `src/claude.js` — the Claude API call
- `src/extract.js` — schemas, prompt, JSON validation, accuracy scoring
- `src/pricing.js` — prices per model
- `src/logger.js` — summary table and results file
- `src/index.js` — reads config and samples, runs the experiment

See [CLAUDE.md](CLAUDE.md) for coding conventions and project rules.
