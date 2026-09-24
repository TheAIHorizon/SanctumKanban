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

The web process enqueues work; a separate worker runs `npm run assessments:worker` with `ASSESSMENT_RUNNER=1` and an explicit database URL. It uses `AI_ASSESSMENT_MODEL` if supplied, otherwise the existing general `AI_MODEL` configuration (default: local Ollama’s `qwen3.8:27b`). Coaching and nightly review retain their own model configuration. It polls every five seconds and processes one job at a time. Jobs use ownership tokens and ten-minute leases renewed between batches; each background inference request is capped at three minutes, with at most one correction request per batch. Interrupted generations fail and can be requested again. No database transaction spans AI inference. No worker port is exposed.

`docker-compose.assessments.yml` is an optional override. Attach its service to the same network as the existing database, preserve existing NAS configuration, and pin the same reviewed image as the web app. Do not overwrite the NAS Compose file with development settings. Stop the app, nightly reviewer, and assessment worker before the final backup/write pause. Preserve the database container/volume and authentication URL/secrets.

Follow [OPERATIONS.md](../OPERATIONS.md) for backup, restored-copy rehearsal, migration review, integrity fingerprints, image replacement and rollback. Rollback the application image while retaining the additive table; never overwrite newer student writes with an older dump automatically.

## Verification

Unit tests cover date/range validation, HTML escaping, pagination, question schema/grounding, answer redaction and grading. `scripts/assessment-integration-check.ts` is guarded to the existing loopback QA database and application. It creates and cleans up synthetic fixtures for role isolation, browser completion, instructor editing, exam exports, cancellation fencing and archived-class behavior. `ASSESSMENT_REAL_AI=1` additionally exercises the configured user-owned model with synthetic work; it never sends live student work for testing.
