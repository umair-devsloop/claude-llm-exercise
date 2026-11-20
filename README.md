# Claude LLM Experimentation

A Node.js learning project that uses the Claude API to extract
structured JSON from a messy email and a messy invoice, then compares
models and temperature settings on the same inputs. Each request is
measured for accuracy against known answers, token usage, latency and
cost.

This is an educational project, not a production application. All
sample data is synthetic.

## Results so far

First live run (2026-11-20): 2 models × 3 temperatures × 2 samples
× 1 run = 12 requests.

| | Claude Haiku 4.5 | Claude Sonnet 4.6 |
|---|---|---|
| Valid JSON | 6/6 | 6/6 |
| Field accuracy | 100% | 100% |
| Latency per request | 2.8–7.1 s | 2.8–5.9 s |
| Cost per request | ~$0.002 | ~$0.006 |

The whole run cost $0.052.

**What this tells us:** both models extracted every scored field
correctly at every temperature, including the decoy values. Sonnet
costs about 3× more per request than Haiku here, with no accuracy gain
on these samples. The samples are too easy to tell the models apart,
so the next step is harder samples (ambiguous dates, missing fields,
conflicting totals) and more runs per setting to measure consistency.

## Requirements

- Node.js 22 or later
- An Anthropic API key with credits. API usage is prepaid and billed
  separately from claude.ai subscriptions.

## Setup

```bash
npm install
cp .env.example .env   # then put your API key in .env
```

| Variable | Example | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic API key. `.env` is git-ignored; never commit it. |
| `CLAUDE_MODELS` | `claude-haiku-4-5,claude-sonnet-4-6` | Models to compare |
| `TEMPERATURES` | `0,0.7,1` | Temperatures to compare (0 to 1) |
| `RUNS_PER_CONFIG` | `3` | Repeats of each combination (default 1) |

## Run

```bash
npm start   # real API calls, costs money
npm test    # unit tests only, no API calls
```

The script sends one request for every combination of sample × model
× temperature × run, one at a time. Requests run sequentially so that
latency figures stay comparable and rate limits are avoided. With the
`.env.example` values that is 2 × 2 × 3 × 3 = 36 requests, about $0.16
based on the first run.

Output:

- One progress line per request with its status and accuracy.
- A summary table per model + temperature: valid runs, errors,
  average accuracy, average latency, total tokens, total cost.
- Full details for every request in
  `results/experiment-<timestamp>.json` (git-ignored): extracted JSON,
  tokens, cost, timing, status, errors and which fields were wrong.
  Each run creates a new file. Results are saved only when the run
  finishes.

## How it works

1. `src/index.js` reads and validates the `.env` settings and loads the
   samples. Invalid settings stop the script before any API call.
2. `src/extract.js` builds the prompt and the JSON schema for the
   document type (`email` or `invoice`).
3. `src/claude.js` sends the request using **structured outputs**
   (`output_config.format`), so the API constrains the reply to the
   schema. The SDK retries rate-limit and server errors up to 4 times.
4. `src/extract.js` still parses and checks the reply, because a
   response can be cut off or refused. Each run gets a status:
   `valid`, `invalid_json`, `schema_mismatch`, `truncated`, `refused`
   or `api_error`. A failed request is recorded and the run continues.
5. The reply is scored against the expected answers, cost is
   calculated from the token counts in `src/pricing.js`, and
   `src/logger.js` prints the summary and writes the results file.

## How accuracy is measured

Each sample in `samples/` has a `<name>.expected.json` with the correct
answers. Only the fields in that file are scored. The comparison
ignores case, extra spaces and tiny rounding differences, but a wrong
date or amount counts as wrong. Free-text fields like `summary` aren't
scored because there's no single right answer.

The prompt tells the model to return `null` rather than guess when a
value isn't in the document. The samples include decoys to catch
wrong picks: a PO number next to the invoice number, and an unrelated
disputed $2,300 invoice in the email.

To add a sample, create `samples/email-2.txt` or `samples/invoice-2.txt`
(the part before the first `-` picks the schema) and a matching
`samples/email-2.expected.json`. Use made-up data only.

## Known limitation: temperature on newer models

The current API version (`2026-10-21`, which SDK 1.x sends by default)
rejects `temperature` on every model, so `src/claude.js` pins the older
version `2023-06-01`. Claude 4.7 and later models (including Opus 5.5,
Sonnet 5.5 and Haiku 5.5) reject custom temperatures on any version.
This tool always sends a temperature, so those models can't be compared
with it: if you add one to `CLAUDE_MODELS`, its runs show `api_error`.

Prices in `src/pricing.js` were checked against Anthropic's pricing
page in November 2026. A model missing from that file shows
"unknown model price" instead of a cost.

## Project layout

- `src/index.js` — reads config and samples, runs the experiment
- `src/claude.js` — the Claude API call
- `src/extract.js` — schemas, prompt, JSON validation, accuracy scoring
- `src/pricing.js` — prices per model
- `src/logger.js` — summary table and results file
- `samples/` — synthetic inputs and their expected answers
- `test/` — unit tests for validation, scoring and pricing
- `results/` — experiment output (git-ignored)

See [CLAUDE.md](CLAUDE.md) for coding conventions and project rules.
