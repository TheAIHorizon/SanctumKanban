# Choose and connect an AI service

SanctumKanban does **not** require CoyoteGPT, a particular model, or a GPU in the Kanban server. CoyoteGPT is one installation's service name, not a dependency. You choose where inference runs. The same server configuration is shared by all users; students do not enter individual API keys.

Start with [the installation guide](../DEPLOY.md). This guide covers fresh setups; for an existing student site, preserve its settings and follow [OPERATIONS.md](../OPERATIONS.md) before changing containers.

## Choose a path

| Your situation | Suggested path | Where AI processes the submitted text |
|---|---|---|
| Explore boards, classes, reports and exports first | Leave AI unconfigured | No hosted AI is configured; unavailable local requests fall back where supported |
| Have suitable local hardware | Ollama or LM Studio's model server | Your machine |
| Have a shared lab/GPU server | Its OpenAI-compatible endpoint, optionally through Bionic or OmniRoute | The server or upstream provider you configure |
| Laptop/NAS cannot run a suitable model | OpenAI API or OpenRouter with a supported model | The selected hosted provider(s) |
| Want to use an Anthropic API key | Configure it in a compatible gateway, or evaluate Anthropic's compatibility endpoint with the caveats below | Anthropic, via the chosen connection |

Boards, ticket editing, class enrollment, reports and printing work without AI. Coaching falls back to keyword guidance; cohort explanations have templates. **Assessment generation requires a working model and a separate worker**; it cannot invent a test from a keyword fallback. Existing saved assessments remain readable without inference. Unset AI settings mean a local Ollama default, not a global disable switch; leave automated review disabled until configured.

Local AI is the privacy-first default. Choosing an external endpoint deliberately sends feature inputs outside your server. Manual coaching sends the ticket draft and retrieved DCWF excerpts; enabled nightly review sends saved ticket evidence; assessments send selected work/notes and optional instructor reference text; cohort rationale sends student names, skill strengths and shared availability. Sensitive details typed into task fields can travel too. Use a provider approved for your institution's data and understand its retention and billing rules. A local gateway that forwards to a cloud model is **not** local inference.

## Set every model setting

Edit the gitignored `.env` on your server; keep keys out of Git, browser code, tickets, screenshots and shared logs. Do not add `NEXT_PUBLIC_` to secret settings.

```dotenv
AI_BASE_URL="http://host.docker.internal:11434/v1"
AI_API_KEY=""
AI_MODEL="your-exact-served-model-id"
AI_COACH_MODEL="your-exact-served-model-id"
AI_ASSESSMENT_MODEL="your-exact-served-model-id"
AI_TIMEOUT_MS="90000"
```

Replace placeholders with the exact model identifier advertised by your provider. Initially all three model values can be identical; they need not be.

| Setting | Used by |
|---|---|
| `AI_BASE_URL` | Shared API base, **without** `/chat/completions` at the end |
| `AI_API_KEY` | Shared Bearer token for that endpoint, blank only when it permits unauthenticated access |
| `AI_MODEL` | General AI calls, including cohort rationale |
| `AI_COACH_MODEL` | Manual DCWF coaching and the nightly reviewer |
| `AI_ASSESSMENT_MODEL` | Assessment worker, independently of `AI_MODEL` |
| `AI_TIMEOUT_MS` | Calls without a feature-specific timeout; it does **not** extend coach or assessment limits |

Legacy fallback names remain in code for existing installations: general `qwen3.8:27b`, coach `laguna-s`, assessment `nemotron-3-super`. These are **not universal recommendations or automatically installed models**. New installations should set all three explicitly. There is one base URL/key per process; use a gateway if different models need different upstream providers.

### What the endpoint must accept

Kanban sends `POST <AI_BASE_URL>/chat/completions`, with Bearer authentication when a key is set, string system/user message content, `temperature`, `max_tokens`, and `stream: false`. Structured tasks also send `response_format: {"type":"json_object"}`. It expects a string in `choices[0].message.content`. No tools are requested. A native Ollama `/api/chat`, Anthropic `/v1/messages`, or Responses-only endpoint is not interchangeable with this route.

Choose a model/route that accepts this request shape. Some reasoning models require different token or sampling parameters, or return empty final content while spending the budget on reasoning. The adapter does not automatically translate those requirements or turn thinking off. Provider API compatibility is a starting point, not proof that a model can produce a valid, useful exam.

## Ollama (local or lab server)

Install Ollama, download an instruction/chat model that fits the machine, and start its service. Use the exact name from `ollama list` for all three model settings. Kanban does not download models. Base URL:

- App running directly on the same host: `http://127.0.0.1:11434/v1`.
- App in Docker Desktop, Ollama on its host: `http://host.docker.internal:11434/v1`.
- Ollama on another trusted machine: `http://MODEL_SERVER:11434/v1` (replace `MODEL_SERVER`).

A standard local Ollama service normally needs no key. Ensure the service listens on an interface reachable from the app; firewall it to trusted clients instead of exposing an unauthenticated model API publicly. See [Ollama's compatibility documentation](https://docs.ollama.com/api/openai-compatibility).

Small models can be useful for suggestions, but may struggle with 25 grounded questions and consistent JSON. Model size, quantization, context length, RAM/VRAM, and concurrent load all affect results. Test on invented tickets rather than assuming a parameter count guarantees quality. A shared GPU machine or hosted model avoids requiring a GPU in each student's computer or in the NAS.

## Bionic and LM Studio

There are two products with this name; use the instructions matching yours.

**LM Studio Bionic:** its model picker chooses models for Bionic sessions; that alone does not establish an API endpoint for Kanban. For Kanban, run the LM Studio/llmster OpenAI-compatible model server, load a model, and copy its served identifier. The documented server example uses `http://127.0.0.1:1234/v1`; from Docker Desktop use `http://host.docker.internal:1234/v1`. Set `AI_API_KEY` to the server token if authentication is enabled, and use the loaded model ID for all three settings. Verify the address and port shown by your installed version. A Bionic cloud subscription/model selection is not assumed to expose the same local API. See [Bionic model choices](https://lmstudio.ai/docs/bionic/models) and [LM Studio server API](https://lmstudio.ai/docs/developer/openai-compat).

**Bionic-GPT:** create an API key in your Bionic installation. Its documented routes are `/v1/models` and `/v1/chat/completions`; use `https://YOUR_BIONIC_HOST/v1` as the base, its API key, and a model ID available to that key. Bionic can route to local or hosted inference, so verify the actual destination and JSON support. See [Bionic-GPT API setup](https://bionic-gpt.com/docs/guides/api/).

## OmniRoute (gateway)

Install [OmniRoute](https://github.com/diegosouzapw/OmniRoute), connect the intended upstream provider using your credentials, and copy the API endpoint/key/model from its dashboard. Its documented default base is `http://127.0.0.1:20128/v1`; use the reachable host address from Docker.

```dotenv
AI_BASE_URL="http://host.docker.internal:20128/v1"
AI_API_KEY="replace-with-your-omniroute-key"
AI_MODEL="replace-with-exact-dashboard-model-id"
AI_COACH_MODEL="replace-with-exact-dashboard-model-id"
AI_ASSESSMENT_MODEL="replace-with-exact-dashboard-model-id"
```

The gateway key goes into Kanban; upstream OpenAI/Anthropic keys go into the gateway. Prefer a fixed tested model route for assessment reproducibility. Check routing/fallback destinations and that JSON mode, string content, sampling, token budgets and the response format survive translation. Installing a router supplies neither model compute nor provider credits. A successful chat in its dashboard is not a full Kanban assessment test.

## OpenRouter (hosted model catalog)

Create an OpenRouter API key and configure billing/limits as needed. Use its API base and a supported model slug, including its provider prefix:

```dotenv
AI_BASE_URL="https://openrouter.ai/api/v1"
AI_API_KEY="replace-with-your-openrouter-key"
AI_MODEL="openai/gpt-4.1-mini"
AI_COACH_MODEL="openai/gpt-4.1-mini"
AI_ASSESSMENT_MODEL="openai/gpt-4.1-mini"
```

This is a configuration example, not a measured exam-quality endorsement. Confirm current model availability and support for the request fields above. Select Claude or another model using its exact OpenRouter slug if preferred. The key here is an **OpenRouter** key. To bring an upstream key, configure that in OpenRouter's supported provider settings first; do not substitute an Anthropic key into the OpenRouter authorization field. See [OpenRouter's quickstart](https://openrouter.ai/docs/quickstart).

## OpenAI API (direct)

Create a project API key in your OpenAI API account and configure API billing/access. A ChatGPT subscription is not the credential for this connection. A compatible non-reasoning example is:

```dotenv
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="replace-with-your-openai-api-key"
AI_MODEL="gpt-4.1-mini"
AI_COACH_MODEL="gpt-4.1-mini"
AI_ASSESSMENT_MODEL="gpt-4.1-mini"
```

This example uses the existing Chat Completions adapter. It does not mean every OpenAI model supports the same parameters, or that this model is the latest or best exam writer. Check [model capabilities](https://developers.openai.com/api/docs/models/gpt-4.1-mini) and [JSON mode limitations](https://developers.openai.com/api/docs/guides/structured-outputs). JSON mode alone does not validate the question schema or correctness; Kanban performs its own validation.

## Anthropic API keys and Claude

For a gateway setup, store your Anthropic API key in the gateway's Anthropic provider connection, then use the gateway's OpenAI-compatible base URL, gateway key and exact Claude alias in Kanban as described above. Verify that gateway/model combination with the checks below; a gateway does not automatically guarantee structured output.

Anthropic also documents a direct OpenAI-compatibility endpoint. For evaluation, the corresponding settings are:

```dotenv
AI_BASE_URL="https://api.anthropic.com/v1"
AI_API_KEY="replace-with-your-anthropic-api-key"
AI_MODEL="replace-with-an-available-claude-model-id"
AI_COACH_MODEL="replace-with-an-available-claude-model-id"
AI_ASSESSMENT_MODEL="replace-with-an-available-claude-model-id"
```

**Limitations:** Anthropic describes this compatibility layer as primarily for evaluation, and ignores `response_format`. JSON therefore depends on the prompt and Kanban's validation. Keys needing an additional workspace-selection header are not supported by Kanban's current two-header client; use an appropriate workspace-scoped key or a gateway. This is not a native Messages API integration, and has not been certified end-to-end here. See [Anthropic's compatibility reference](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk).

## Docker networking and workers

`localhost` inside a container means that container, not your laptop or NAS. For containers sharing a Docker network use the AI service name; for a different machine use its reachable hostname/IP. Docker Desktop supplies `host.docker.internal`. On Linux Engine, add this mapping to **each** app/reviewer/assessment service that needs a host service, in your private Compose override:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

The host model server must listen on an address reachable from that bridge. A NAS container cannot reach a laptop's loopback service just because Tailscale is running; the hostname, listener and firewall must all permit the connection.

For a **fresh installation** using the included Compose files, after editing `.env`:

```bash
docker compose -f docker-compose.yml -f docker-compose.assessments.yml up -d --build app assessments
```

This starts/recreates the web app and assessment worker with the selected settings. Both use the same database/network. If also enabling scheduled reviews:

```bash
docker compose -f docker-compose.yml -f docker-compose.assessments.yml --profile nightly up -d reviewer
```

Enable review separately in each class's settings. Setting an API key does not opt a class into nightly processing. Keep using the same Compose files/project name when managing the deployment. A plain `docker compose restart` does **not** apply edited environment values. On an existing site, use its actual Compose overrides and the operations runbook instead of these fresh-install commands.

Without Docker, export the same variables to your worker process, including `DATABASE_URL`, and run `ASSESSMENT_RUNNER=1 npm run assessments:worker`. The standalone worker does not automatically load Next.js `.env` files. Do not place the runner flag in the web process.

## Verify without sending student data

After configuration, run:

```bash
docker compose exec app npm run ai:check
docker compose -f docker-compose.yml -f docker-compose.assessments.yml exec assessments npm run ai:check
```

Or run `npm run ai:check` from a source checkout; this diagnostic loads `.env` using Next.js environment-file precedence. It sends three tiny invented prompts using the actual client, never reads the database, prints setting names/results instead of keys or provider output, and exits unsuccessfully on a failure. Provider charges may apply. Passing means basic connectivity and JSON response parsing only.

Then create an isolated demo class/student, document several substantive invented activities, and generate a complete assessment. Confirm 25 questions, grounding, plausible distinct options and correct answers. Test coaching too. Review the exam before assigning it. No hosted provider or personal API key has been exercised as part of this documentation update; examples are based on provider documentation and the app's request contract.

Normal assessments use five sequential five-question calls, up to 180 seconds per call. Failed batches may split into two/two/one questions; total time and cost can increase. Coaching has a shorter deadline. Budget for repeated evidence in each batch, practice generations and nightly jobs—not just a single prompt. Do not promise a fixed generation time or cost for another server.

| Symptom | What to check |
|---|---|
| Queued indefinitely | Start the assessment worker; confirm its database/network and `ASSESSMENT_RUNNER=1` |
| Coach falls back but chat elsewhere works | Check `AI_COACH_MODEL`, DCWF reference import, response structure and latency |
| Exam fails while coach works | Check `AI_ASSESSMENT_MODEL` in the worker, not only `AI_MODEL` in the web app |
| HTTP 401/403 | Endpoint's own key, permissions, and any unsupported extra-header requirement |
| HTTP 404 | Base path, model alias, provider prefix; do not append `/chat/completions` twice |
| HTTP 400/422 | Model rejects `temperature`, `max_tokens`, or JSON mode; choose a compatible route/model |
| HTTP 429 | Credits/rate limit/concurrency; check provider or gateway settings |
| Network/timeout | Reachability from the failing container, model loaded, available memory and upstream load |
| Invalid JSON/questions or truncated output | Model/route suitability, context capacity, reasoning budget; all validation remains enforced |
| Insufficient evidence | Improve activity descriptions/date selection or instructor references |

Provider documentation checked October 2, 2026. Availability and capabilities can change; verify your chosen route before using it with a real class.
