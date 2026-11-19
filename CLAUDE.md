# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: Claude LLM Experimentation

## Commands

- Install: `npm install`
- Run experiments: `npm start` (makes real, billed API calls)
- Unit tests (no API calls): `npm test` (Node's built-in `node --test`, files in `test/`)
- Single test: `node --test --test-name-pattern="scoreAgainstExpected"`
- No linter is configured.

## Environment

Configured via `.env` (see `.env.example`), loaded with dotenv:

- `ANTHROPIC_API_KEY` — API key.
- `CLAUDE_MODELS` — comma-separated model IDs to compare.
- `TEMPERATURES` — comma-separated numbers in [0, 1].
- `RUNS_PER_CONFIG` — repeats per combination (default 1).

## How It Works

`index.js` runs every sample × model × temperature × run sequentially,
then prints a summary table and writes `results/experiment-<timestamp>.json`.

- Samples: `samples/<docType>[-suffix].txt`. `docType` must be a key
  of `SCHEMAS` in `extract.js` (`email`, `invoice`). An optional
  `<same name>.expected.json` is the ground truth; only fields listed
  in it are scored, so leave free-text fields (`summary`, `line_items`)
  out of it.
- Extraction uses structured outputs (`output_config.format`, JSON
  schema). Schemas must list every property in `required` with
  `additionalProperties: false`; optional values are `nullable(...)`.
- Each run gets a status: `valid`, `invalid_json`, `schema_mismatch`,
  `truncated` (max_tokens), `refused`, or `api_error`. API errors are
  recorded per run and do not stop the experiment.
- Cost is `null` for any model missing from `pricing.js`. Add the
  price there when adding a model.

### Temperature constraint (important)

`@anthropic-ai/sdk` 1.x sends `anthropic-version: 2026-10-21`, which
rejects `temperature` on every model. `claude.js` pins
`2023-06-01` so temperature can be sent. Even then, Claude 4.7+
models (Opus 5.5, Sonnet 5.5, Haiku 5.5, etc.) reject non-default
temperatures, so the temperature comparison only works on models
like `claude-haiku-4-5` and `claude-sonnet-4-6`. Don't remove the
version pin or switch the defaults to newer models without
dropping the temperature experiment.

The git repository root is the parent `Devsloop/` directory, not
this folder.

## 1. Project Overview

This repository is a learning project for understanding Large
Language Models (LLMs) through practical Node.js implementations.

The primary objective is to integrate the Anthropic Claude API
to extract structured information from unstructured emails and
invoices.

The project also compares Claude models and temperature settings
to evaluate output quality, consistency, latency, token usage,
and API cost.

This is an educational project, not a production application.

## 2. Technology Stack

- Runtime: Node.js
- Language: JavaScript (CommonJS)
- AI Provider: Anthropic Claude API
- SDK: @anthropic-ai/sdk
- Environment Variables: dotenv
- Package Manager: npm
- Output Format: JSON
- Version Control: Git

## 3. Coding Conventions

- Use plain JavaScript. Do not introduce TypeScript.
- Use CommonJS modules (require/module.exports).
- Use single quotes for strings.
- Use const by default and let only when reassignment is needed.
- Use async/await for asynchronous operations.
- Keep functions small and focused on one responsibility.
- Use descriptive variable and function names.
- Prefer simple, readable implementations.
- Avoid unnecessary abstractions, custom frameworks, and dependencies.
- Keep API integration separate from business logic.
- Handle errors explicitly.
- Do not silently swallow errors.

## 4. Architecture Rules

- Keep application code inside src/.
- Keep sample input files inside samples/.
- Keep generated experiment results inside results/.
- Keep Claude API communication inside src/claude.js.
- Keep extraction logic inside src/extract.js.
- Keep token pricing calculations inside src/pricing.js.
- Keep experiment logging inside src/logger.js.
- Keep application execution inside src/index.js.

Do not put the entire implementation into one file.

## 5. Claude API Rules

- Use the official @anthropic-ai/sdk package.
- Read API credentials from environment variables.
- Never hardcode API keys.
- Never log API keys or sensitive credentials.
- Keep model identifiers configurable.
- Verify model availability and pricing against official
  Anthropic documentation.
- Capture input_tokens and output_tokens from API responses.
- Record execution time for each request.
- Handle API errors and rate limits gracefully.
- Validate model responses before treating them as valid JSON.
- Do not assume that prompt instructions guarantee valid JSON.
- Prefer Anthropic structured outputs when appropriate.

## 6. Experimentation Rules

Each experiment should record:

- Model identifier
- Temperature
- Input token count
- Output token count
- Execution time in milliseconds
- Estimated API cost in USD
- Extracted JSON
- Parsing or validation status
- Errors, if any

Use the same input data when comparing models and temperatures.

Do not compare model performance using different input data.

Do not claim a model is more accurate based on a single response.
Use known expected outputs as ground truth.

## 7. Security Rules

- Never commit .env files.
- Never expose API keys in logs, source code, or README.
- Maintain .env.example with placeholder values only.
- Do not include real customer emails, invoices, or personal data.
- Use synthetic sample data for experiments.

## 8. Git Rules

- Keep commits small and focused.
- Use descriptive commit messages.
- Do not commit node_modules or generated secrets.
- Do not modify unrelated files.
- Review git diff before committing.
- Never push directly to main without explicit approval.

## 9. Development Workflow

Before implementing a feature:

1. Inspect the existing project structure.
2. Read this CLAUDE.md.
3. Understand existing implementation and conventions.
4. Explain the proposed changes briefly.
5. Implement only what is necessary.
6. Run relevant checks.
7. Report changed files and verification results.

## 10. Learning Objective

When implementing a feature, explain the relevant LLM concepts
where useful.

Prioritize helping the developer understand:

- Tokens and context windows
- Temperature and sampling
- Prompt engineering
- Hallucinations
- Model selection
- Structured outputs
- Token usage and API pricing
- Model evaluation and accuracy
