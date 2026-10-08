# Team exports and course assessments

This release adds collapsed team panels, per-team print/HTML exports, and personalized assessment versions. Research Kanban and Slack integration remain a separate project.

## Team boards and printing

Detailed starts with all team panels collapsed. Open any team independently; filters survive collapsing/reopening during the visit. Expand all and Collapse all are available. My Teams and focused boards retain their expanded presentation.

Export is available beside each team in Detailed, My Teams, focused view and Gantt. Exports always contain **one team**. Choose the view, inclusive date range (maximum 366 days), and landscape Letter (11 × 8.5 inches) or Tabloid (17 × 11 inches). Print / Save PDF opens a standalone document. Choose the matching size in the browser's print dialog. Download HTML saves an offline copy. A physical printer must support the selected paper.

The export uses all matching active tickets, independently of on-screen search filters. Scheduled tickets qualify when their schedule/recorded event span overlaps the range. Partly dated or unscheduled work qualifies by its dates or creation/update activity. Long charts split horizontally into 14-day Letter or 28-day Tabloid slices and vertically into manageable row groups. An appendix lists complete titles and dates. Private instructor feedback, individual reports and archived tickets are excluded. Permissions follow the existing class-visible board policy.

## Student practice

Practice tests are private to the student and ADMIN instructional staff. Student team leads have no access to other students' tests or exam drafts.

Choose the course and work range, then Generate new practice test. Each accepted request creates a saved version in a persistent queue. There is one pending request per student and a one-minute interval between requests. Generation can be canceled. Leaving the page does not cancel it. The worker must be running; the UI distinguishes queued, generating, ready and failed versions.

A test contains 25 four-choice questions with one best answer: five concepts, ten applications and ten troubleshooting scenarios. Exact stems from the last five successful versions of the same test type are excluded; repeated topics and similar questions remain possible. The model uses the operator-selected AI endpoint, which may be local, institutional or hosted. See [AI setup](ai-setup.md) for provider configuration and data handling. It receives only the selected evidence and optional instructor references, not credentials, private feedback, other students' profiles or whole-team reflections.

Evidence is the student's assigned Doing/Done work with recorded creation/update/start/completion activity in the chosen UTC date range, plus their own DCWF task notes created in that range. Creating someone else's ticket does not count as performing it. Up to 30 substantive recent tickets are used, including archived tickets, with bounded text excerpts (24,000 characters in total). The stored snapshot is immutable even if a ticket later changes. Sparse evidence or invalid model output produces an explicit failure rather than an invented test. Assignment and status are claims, not proof of mastery.

Students answer all questions and submit once. Answer keys and explanations are withheld from their API responses until submission. Scores are study feedback, not official grades. Model-generated answers may be wrong. Practice results are not added to student performance grades automatically.

## Instructor exams

ADMIN staff choose the student/course/date range and generate an exam draft. Optional reference material is pasted text (up to 20,000 characters); URLs are not fetched. Staff may inspect the source snapshot, edit questions/options/answers/explanations, save edits, or accept the default directly.

Accept exam freezes the version and records the accepting instructor/time plus whether edits were saved or the generated default was accepted. Acceptance does not certify correctness. Printing the student exam excludes answers; a separate answer-key export includes explanations. Students never receive instructor exam drafts or keys through the application. Online final-exam delivery, proctoring and official grading are outside this first release.

Archived classes allow reading existing versions and approved exam exports but reject new generation, submissions, edits and acceptance. A pending generation fails if the class is archived before the result is saved.

## Runtime and update requirements

The only database addition is `Assessment` plus its indexes and foreign keys to User and ClassWorkspace. The reviewed additive SQL is [schema/assessments-additive.sql](schema/assessments-additive.sql). Always compare against the actual NAS schema; this file is not permission to skip that check. Deleting a user or class also deletes associated assessments, consistent with those existing deletion semantics. Archiving preserves them.

The web process enqueues work; a separate worker runs `npm run assessments:worker` with `ASSESSMENT_RUNNER=1` and an explicit database URL. It uses `AI_ASSESSMENT_MODEL` if supplied, otherwise the legacy alias `nemotron-3-super`. New installations must explicitly set an available model from their own provider; see [AI setup](ai-setup.md). Assessments no longer fall back to the general `AI_MODEL`; configure the chosen endpoint to serve the assessment model. Coaching and nightly review retain their own model configuration. It polls every five seconds and processes one job at a time. Jobs use ownership tokens and ten-minute leases renewed between batches and before retries. Normal generation makes five sequential requests of five questions, retaining the final 5/10/10 distribution. Each background inference request is capped at three minutes. A transient connection/time-out/server failure or invalid response triggers one bounded recovery round: replace that failed five-question batch with requests for two, two and one questions. A failed recovery request ends generation; there are at most twenty requests per exam. Normal requests use temperature 0.8 and recovery requests 0.2, with `max_tokens: 4000`, `stream: false` and JSON-object response mode throughout. Authentication/configuration errors and an explicit model response indicating insufficient evidence fail immediately. Cancellation is checked before a retry. The general `AI_TIMEOUT_MS` setting does not override this assessment deadline. Interrupted generations fail and can be requested again. No database transaction spans AI inference. No worker port is exposed.

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

## Assessment library and Canvas exports

Every version is stored in PostgreSQL, including failed generation attempts until instructional staff explicitly delete them. The Assessment library is paginated (25 rows per page) rather than limited to the newest 50 versions. Instructional staff can browse all courses, filter to a course or student, and filter by type/status or search names/version IDs. Library lists contain version metadata only; questions, answers, evidence and references are fetched only when an authorized person opens a version. Staff retain historical read/export access after unenrollment; generation and edits still require active enrollment. Student/team-lead accounts see only their own practice history in accessible courses. Observer accounts are denied.

**Opening a version:** choose **Open assessment** in its library row. The page moves keyboard focus and scrolls to the selected test below the library, showing a loading message or a retryable load error. Reopening the current version preserves unsaved question edits or practice answers. Acceptance, print and single-quiz export controls appear above the questions. Checkboxes only select assessments for batch export. Failed versions show their error and cannot be exported; generate a new version after resolving the cause.

**Failed-attempt cleanup:** instructional staff can open a failed version and choose **Delete failed attempt**, or select a specific active course and choose **Delete failed attempts for this class**. Both ask for confirmation. Class cleanup ignores student/type/search/page filters and removes all failed attempts in that class. The API (`DELETE /api/assessments/failed`) requires ADMIN, a specific class ID, and either an assessment ID or `allFailed: true`. It deletes only rows whose status is still FAILED, preserves successful and running versions and original student work, and rejects archived classes. Error messages and saved evidence snapshots for deleted versions are permanently removed. No schema change is required.

**Individual export choices:** under **Export this assessment**, choose Classic Quizzes or New Quizzes and set points per question. Both engines use the same single-quiz QTI ZIP; the selected engine controls the displayed import instructions. Accepted exams also have student/key print links; use the browser print dialog for paper or Save as PDF.

A single Canvas download is a QTI 1.2 ZIP with a manifest, one assessment, 25 four-choice items, answer mappings, question point values and explanation feedback. Four points per question is the default (100 total). The library permits whole-number point values from 1 to 100 per question. Only accepted exams and ready practice versions can be exported. Export revalidates counts, fields, distinct choices/stems, answer indices and evidence references. Invalid or cross-course selections fail completely; nothing is silently omitted. No AI inference occurs during export.

For a specific course, select up to 100 versions across pages or choose **Export latest accepted exams for class** (one most recently generated accepted exam per student across the entire selected course, independently of library filters). Two download formats are provided:

- **Classic Quizzes:** one combined QTI package containing a separate assessment resource per quiz. Import through Course Settings → Import Course Content → QTI .zip file.
- **New Quizzes:** an outer ZIP containing individual QTI ZIPs in `quizzes/`, an instructor guide, and `quiz-index.json` mapping filenames to student/version titles. Extract the outer ZIP; create a new quiz shell and use Build → Options → Import Content for each individual ZIP. Do not import the outer bundle as a quiz. Institution-enabled migration during course import may provide another workflow.

Before publishing, assign each personalized quiz only to its intended Canvas student (remove Everyone); inspect answers, points, feedback settings and dates. QTI files do not carry Canvas enrollment mappings or assignment overrides. Each quiz is separate, so this first version does not consolidate individualized quizzes into one common final-exam Gradebook column. New Quizzes assignment points should match the question total. Students take the assessment in Canvas for Canvas grading; existing Kanban scores/submissions are not transferred or synchronized. Practice exports contain quiz content only; choose their grading settings in Canvas.

Downloads include student names in quiz titles and answer keys and are instructor-only, with private/no-store responses. No student evidence, instructor reference text, student responses, existing scores, credentials or API keys enter the archive. Generated downloads and synthetic QA artifacts must not be committed. No Canvas credentials or automated upload is required. Database schema is unchanged.

Compatibility target: standard QTI 1.2 multiple-choice content. An import in the institution's actual Canvas tenant must still be checked before assigning real exams; local archive/XML validation is not a claim of tenant import acceptance.

Local Canvas verification uses synthetic records only. The guarded integration check covers history beyond 50 versions, class/student isolation, browser downloads, answer mappings, archived/unenrolled history, and latest accepted exams for multiple students. A newer unaccepted draft cannot hide an older accepted exam, and a mixed selection containing a draft fails completely. ZIP/XML checks verify manifests, 25 questions per quiz, four choices, scoring and answer references. No live student data or schema changes are needed for these checks.

October 1, 2026 library/export verification: 257 unit tests, all 11 integration/browser groups, lint (existing unrelated warnings only), and the production build passed. Independent XML parsing checked three exported quizzes and all 75 questions. Desktop and mobile screenshots were inspected. Actual Classic/New Quizzes tenant imports remain unverified.

Primary references:
- [Instructure: Import quizzes from QTI packages](https://community.instructure.com/en/kb/articles/660996-how-do-i-import-quizzes-from-qti-packages)
- [Instructure: Import a QTI quiz into New Quizzes](https://community.instructure.com/en/kb/articles/661050-how-do-i-import-a-quiz-from-a-qti-package-in-new-quizzes)
- [Instructure QTI resource model](https://github.com/instructure/qti/blob/master/lib/qti/models/resource.rb)
