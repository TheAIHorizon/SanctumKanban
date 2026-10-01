# Team exports and course assessments

This release adds collapsed team panels, per-team print/HTML exports, and personalized assessment versions. Research Kanban and Slack integration remain a separate project.

## Team boards and printing

Detailed starts with all team panels collapsed. Open any team independently; filters survive collapsing/reopening during the visit. Expand all and Collapse all are available. My Teams and focused boards retain their expanded presentation.

Export is available beside each team in Detailed, My Teams, focused view and Gantt. Exports always contain **one team**. Choose the view, inclusive date range (maximum 366 days), and landscape Letter (11 × 8.5 inches) or Tabloid (17 × 11 inches). Print / Save PDF opens a standalone document. Choose the matching size in the browser's print dialog. Download HTML saves an offline copy. A physical printer must support the selected paper.

The export uses all matching active tickets, independently of on-screen search filters. Scheduled tickets qualify when their schedule/recorded event span overlaps the range. Partly dated or unscheduled work qualifies by its dates or creation/update activity. Long charts split horizontally into 14-day Letter or 28-day Tabloid slices and vertically into manageable row groups. An appendix lists complete titles and dates. Private instructor feedback, individual reports and archived tickets are excluded. Permissions follow the existing class-visible board policy.

## Student practice

Practice tests are private to the student and ADMIN instructional staff. Student team leads have no access to other students' tests or exam drafts.

Choose the course and work range, then Generate new practice test. Each accepted request creates a saved version in a persistent queue. There is one pending request per student and a one-minute interval between requests. Generation can be canceled. Leaving the page does not cancel it. The worker must be running; the UI distinguishes queued, generating, ready and failed versions.

A test contains 25 four-choice questions with one best answer: five concepts, ten applications and ten troubleshooting scenarios. Exact stems from the last five successful versions of the same test type are excluded; repeated topics and similar questions remain possible. The model uses the user's existing self-hosted AI configuration. It receives only the selected evidence and optional instructor references, not credentials, private feedback, other students' profiles or whole-team reflections.

Evidence is the student's assigned Doing/Done work with recorded creation/update/start/completion activity in the chosen UTC date range, plus their own DCWF task notes created in that range. Creating someone else's ticket does not count as performing it. Up to 30 substantive recent tickets are used, including archived tickets, with bounded text excerpts (24,000 characters in total). The stored snapshot is immutable even if a ticket later changes. Sparse evidence or invalid model output produces an explicit failure rather than an invented test. Assignment and status are claims, not proof of mastery.

Students answer all questions and submit once. Answer keys and explanations are withheld from their API responses until submission. Scores are study feedback, not official grades. Model-generated answers may be wrong. Practice results are not added to student performance grades automatically.

## Instructor exams

ADMIN staff choose the student/course/date range and generate an exam draft. Optional reference material is pasted text (up to 20,000 characters); URLs are not fetched. Staff may inspect the source snapshot, edit questions/options/answers/explanations, save edits, or accept the default directly.

Accept exam freezes the version and records the accepting instructor/time plus whether edits were saved or the generated default was accepted. Acceptance does not certify correctness. Printing the student exam excludes answers; a separate answer-key export includes explanations. Students never receive instructor exam drafts or keys through the application. Online final-exam delivery, proctoring and official grading are outside this first release.

Archived classes allow reading existing versions and approved exam exports but reject new generation, submissions, edits and acceptance. A pending generation fails if the class is archived before the result is saved.

## Runtime and update requirements

The only database addition is `Assessment` plus its indexes and foreign keys to User and ClassWorkspace. The reviewed additive SQL is [schema/assessments-additive.sql](schema/assessments-additive.sql). Always compare against the actual NAS schema; this file is not permission to skip that check. Deleting a user or class also deletes associated assessments, consistent with those existing deletion semantics. Archiving preserves them.

The web process enqueues work; a separate worker runs `npm run assessments:worker` with `ASSESSMENT_RUNNER=1` and an explicit database URL. It uses `AI_ASSESSMENT_MODEL` if supplied, otherwise the exact alias `nemotron-3-super`. Assessments no longer fall back to the general `AI_MODEL`; configure the chosen endpoint to serve the assessment model. Coaching and nightly review retain their own model configuration. It polls every five seconds and processes one job at a time. Jobs use ownership tokens and ten-minute leases renewed between batches and before retries. Normal generation makes five sequential requests of five questions, retaining the final 5/10/10 distribution. Each background inference request is capped at three minutes. A transient connection/time-out/server failure or invalid response triggers one bounded recovery round: replace that failed five-question batch with requests for two, two and one questions. A failed recovery request ends generation; there are at most twenty requests per exam. Normal requests use temperature 0.8 and recovery requests 0.2, with `max_tokens: 4000`, `stream: false` and JSON-object response mode throughout. Authentication/configuration errors and an explicit model response indicating insufficient evidence fail immediately. Cancellation is checked before a retry. The general `AI_TIMEOUT_MS` setting does not override this assessment deadline. Interrupted generations fail and can be requested again. No database transaction spans AI inference. No worker port is exposed.

`docker-compose.assessments.yml` is an optional override. Attach its service to the same network as the existing database, preserve existing NAS configuration, and pin the same reviewed image as the web app. Do not overwrite the NAS Compose file with development settings. Stop the app, nightly reviewer, and assessment worker before the final backup/write pause. Preserve the database container/volume and authentication URL/secrets.

Follow [OPERATIONS.md](../OPERATIONS.md) for backup, restored-copy rehearsal, migration review, integrity fingerprints, image replacement and rollback. Rollback the application image while retaining the additive table; never overwrite newer student writes with an older dump automatically.

## Diagnosing failed generation

An October 1, 2026 diagnostic using invented SSH/DNS/network lab activities reproduced the former generic failure: the deployed worker completed 15 valid questions (individual batches took approximately 110, 135 and 105 seconds), then failed on the first troubleshooting request at the 180-second deadline. Inference errors bypassed the correction loop, and the outer catch discarded their cause. This establishes a reproducible timeout failure, not the exact cause of every historical failed exam. Controlled follow-up requests with a 300-second deadline timed out for both the configured model and the existing coaching-model alternative. A subsequent minimal, non-JSON request for a one-word reply also timed out after 45 seconds. These observations point to AI-service latency/unavailability; they do not identify the internal model-server fault. Increasing the timeout alone was not sufficient, so the three-minute deadline remains unchanged. The hardening patch preserves diagnostic categories and recovers failed five-question batches using requests of at most two questions. Deployment should wait for a healthy AI service and a successful fresh, full 25-question generation using the intended production configuration and authorized test evidence.

New failures save a specific, safe explanation and the selected model on the assessment. The worker logs `assessment_generation_failed` with the assessment ID, model, failure code, completed question count, failing batch size, recovery status, elapsed milliseconds, and HTTP status when available. `assessment_batch_retry` records the safe failure category and replacement batch sizes. It never logs student evidence, instructor references, model output, credentials or raw exception messages. Existing historical failures retain their original generic message; their precise cause cannot be recovered from that message alone.

- `timeout`: a batch exceeded the three-minute deadline despite retrying. Check model latency/load; raising the web app's `AI_TIMEOUT_MS` does not change this worker limit.
- `network` / `http` / `unavailable`: check the worker's AI endpoint, model and credentials. HTTP 401/403 requires correcting access; temporary server failures are retried.
- `invalid_response` / `invalid_json` / `truncated` / `invalid_questions`: the service returned unreadable, incomplete or invalid question data. Responses stopped at the output token limit are rejected rather than silently accepted.
- `insufficient_evidence`: the model explicitly declined to generate confidently. Review descriptions, dates and optional instructor references.
- `scope_changed` / `authorization`: check course archival, enrollment and the requesting instructor's permissions.
- `internal`: investigate the worker's environment and database health without dumping student data into logs.

The system prompt forbids Markdown code fences and explicitly requires all nine fields on every question, including the requested `kind` and an eligible `sourceId`. A recovery request repeats that requirement; missing fields are never silently filled in. The parser accepts a complete leading question object or root JSON array, ignoring appended text; it also tolerates a surrounding fence. JSON syntax is checked independently of `finish_reason`, including when the server reports `stop`. Previously, a root array was mistakenly read as only its first question. Only the envelope is normalized; exact counts, question fields, unique stems, distinct choices, answer indices and eligible evidence IDs are still validated. Truncated JSON is never repaired or accepted.

Generation either saves a complete validated 25-question test or fails; partial tests are never published. Once the underlying issue is resolved, request a new version. Do not rewrite an existing approved exam or requeue a failed version directly in the database.

## Verification

Unit tests cover date/range validation, HTML escaping, pagination, question schema/grounding, answer redaction and grading. `scripts/assessment-integration-check.ts` is guarded to the existing loopback QA database and application. It creates and cleans up synthetic fixtures for role isolation, browser completion, instructor editing, exam exports, cancellation fencing and archived-class behavior. `ASSESSMENT_REAL_AI=1` additionally exercises the configured user-owned model with synthetic work; it never sends live student work for testing.

October 1, 2026 verification: all 251 automated tests and the production build passed. A complete authorized student-evidence replay using `nemotron-3-super` produced 25 validated questions in five requests (191.443 seconds), with all job writes confined to memory. An earlier replay correctly rejected omitted `kind` fields, including on recovery; the prompt now explicitly requires every field on every question. This is measured validation success, not a guarantee of factual correctness or a promised generation time. No student identity or evidence is included in this repository.
