# Bulk student enrollment

In **Classes**, create the new class. The import panel opens automatically. For an existing active class, choose **Import students** on its card. This feature is for ADMIN instructors; student team leads do not have import privileges.

## Prepare a CSV

Download the template from the import panel and replace its example rows. Use exactly three columns, in any order:

```csv
First name,Last name,Email
Alex,Example,alex@example.edu
Jamie,Example,jamie@example.edu
```

In Excel, use **Save As → CSV UTF-8**. Upload a `.csv` file under 100 KB with at most 100 students. Split larger classes into additional files. Commas inside a name must be quoted, as Excel does automatically. The parser supports a UTF-8 BOM, quoted commas/escaped quotation marks, and Windows or Unix line endings. `firstName`, `lastName`, and `email` are also accepted headers. Blank records are ignored. Duplicate email addresses, missing names, malformed quotations, extra columns and invalid emails reject the whole file with a record-specific error. Do not include passwords, roles, grades or survey answers.

## Preview and import

1. Select **Student roster CSV** and choose the file.
2. For an individual-work class, check **One Kanban per student**. Leave it unchecked to enroll students without creating boards. Select **Preview roster**; no accounts, enrollments or boards are written yet.
3. Review each action: create and enroll a new student, enroll an existing student, or skip an already enrolled student. Name differences are shown; existing account names are retained.
4. Select **Import reviewed students**. Account creation and enrollment are saved together in one transaction. If an account match changes after preview, preview again. With the individual-board option checked, boards and memberships are created in the same transaction. Otherwise use **Teams** afterward for group boards.

Existing accounts are matched by email without regard to capitalization. Existing names, passwords, global roles, work, memberships in other classes and team assignments are never overwritten. New accounts use the MEMBER role. Existing MEMBER and TEAM_LEAD accounts can be enrolled. Staff/observer accounts and ambiguous legacy email matches are rejected. Archived classes must be restored before importing.

## Give students their logins

New accounts receive unique cryptographically random initial passwords, stored only as bcrypt hashes. After import, immediately select **Download new student logins**. The private CSV contains credentials only for accounts created by that import. Keep it secure and share each student’s own details individually. Never distribute the entire sheet or put it in Git, a shared ticket, or a public folder. Spreadsheet formula prefixes in exported cells are neutralized.

The application does not email credentials or force a password change. Ask students to change their password in **Profile**. Existing accounts keep their usual credentials. The page retains generated passwords only in memory until you leave; they cannot be retrieved later. If a connection fails after saving, preview again to discover which students are enrolled. Reimporting does not create duplicate accounts or reset passwords. If new passwords were lost, reset those accounts in **Users** and distribute replacements privately.

## Implementation and verification

- UI: `src/components/classes/StudentRosterImport.tsx`, opened from Classes.
- ADMIN-only endpoint: `POST /api/classes/[id]/students/import`, actions `preview` and `import`; import requires the current preview fingerprint.
- Strict parsing/export: `src/lib/student-roster.ts`; database matching, hashing and atomic import: `src/lib/student-roster.server.ts`.
- Preview and credential responses use `private, no-store`; roster content and passwords are not logged. No AI calls, outbound uploads or automatic emails are involved. Individual boards add a nullable owner field and unique class/owner index; see the migration notes below.
- Imports lock the target class and recheck matches within a serializable transaction. Stale previews, duplicate-account races and serialization conflicts return a retryable response instead of silently applying different decisions. Password hashing occurs before the transaction.
- `tests/student-roster.test.ts` covers parsing, validation and spreadsheet formula handling.
- `scripts/student-roster-integration-check.ts` is guarded to the isolated loopback QA app/database. It uses temporary synthetic students to check authentication, previews, stale matches, browser uploads/downloads, working unique passwords, preservation of existing accounts, retries, concurrent imports and archived-class rejection. It cleans up its own fixtures and must never run against the NAS.

Initial standard-roster verification: 260 unit tests passed, along with the guarded browser/API checks, TypeScript checking, lint (existing unrelated warnings only), and the production build. Desktop and mobile previews were inspected. These checks used synthetic records only; no live roster was imported.

## Canvas rosters and Gradebook exports

The same import panel also accepts Canvas CSV files. Prefer **Course Analytics (New Analytics) → Reports → Class Roster → Run Report**. The fields available in this report depend on the institution and your permissions. A Gradebook CSV is another option when it contains actual email addresses.

1. Upload the Canvas CSV (up to 1 MB). Common headers are detected automatically; select **Canvas roster / Gradebook CSV** if needed.
2. Check **Canvas column mapping**. Choose the actual email column. `Email`, `Email Address`, `Student Email`, `SIS Login ID`, and `Login ID` are recognized suggestions, with explicit email columns preferred. A login ID is usable only if it is a complete email address. Usernames and SIS numbers are rejected; the importer never guesses a domain. If emails are unavailable, obtain verified addresses before importing.
3. Choose separate first/last name columns, **Last, First**, or **First Last**. Canvas Gradebook's `Student` column normally contains a sortable name; separate `FirstName`/`LastName` exports also work. Course Analytics headers can vary, so all columns can be selected manually. **First Last** splits at the first whitespace. Review compound names and suffixes, and add separate first/last name columns in Excel if needed.
4. Preview and import as usual. Changing the mapping clears the previous preview. Duplicate emails still reject the file; keep one row per student when section enrollments repeat. Remove any Canvas Test Student record without an email rather than inventing one.

Canvas conversion runs locally in the browser. It discards grades, SIS IDs, sections and all other unselected fields before making a request to the Kanban. The server still receives only the standard three identity columns and applies all existing validation, matching and transaction protections. This does not link Canvas enrollment IDs, synchronize a roster, import grades, or contact Canvas automatically. The individual-board option works with either roster format.

Only recognized **leading** Gradebook metadata (Points Possible and blank-identity posting-policy rows) is skipped, with the count displayed. Arbitrary missing-email rows and Test Student names are not silently dropped. The normalized roster remains limited to 100 students and 100 KB; a large original Gradebook file is not permission to import additional students.

Implementation: `src/lib/canvas-roster.ts` handles header suggestions and conversion. Tests cover Gradebook metadata, separate/sortable/full names, explicit email preference, missing emails, ambiguous names, duplicate students, malformed records, and removal of grade values. The guarded browser check verifies that the request sent to the server contains no grade columns or values and that mapped students are enrolled correctly.

Primary references:

- [Instructure: download Course Analytics reports](https://community.instructure.com/en/kb/articles/660639-how-do-i-view-and-download-reports-in-course-analytics)
- [Instructure: Gradebook exporter source and column formats](https://github.com/instructure/canvas-lms/blob/master/lib/gradebook_exporter.rb)

Institution-specific CSV files have not been tested; verification uses synthetic exports matching the documented formats.

Canvas extension verification: all 264 unit tests, four guarded browser/API check groups, TypeScript checking, lint (existing unrelated warnings only), and the production build passed. Desktop/mobile Canvas mapping previews were inspected. Synthetic Gradebook requests were checked to confirm grade values and SIS identifiers never reached the import endpoint.

## One Kanban per student

For new classes, create the class and check **One Kanban per student** in the import panel before previewing a standard or Canvas roster. Preview shows which individual boards will be created or kept. This option applies to the current import; select it again on later visits when adding students. It is not a class-wide enrollment automation or privacy setting.

For students already enrolled, choose **Classes → One Kanban per student** on the class card, then **Preview individual boards → Create reviewed boards**. Only enrolled MEMBER and TEAM_LEAD accounts are included; instructors/observers are excluded. Empty classes show instructions to import students first. This action supports up to 1,000 enrolled students; larger classes can use roster imports in batches of 100. Repeat after future enrollments to create only missing boards.

Each board is named after the student, with one fixed student member. The student has local board leadership to manage instructor-created tasks, but their account role never changes. Group teams and existing work stay intact. Names are not identifiers: two students with the same name get separate boards; renaming a board does not break reuse. The review lists emails to distinguish same-name students. A student enrolled in two classes has a separate board in each.

These are normal Kanban boards with tickets, reflections, a Gantt chart, exports, feedback and assessment evidence. Newly created tickets default to the owner (the Unassigned choice remains available). Instructor-distributed class deliverables are assigned to the individual owner. Existing work is never reassigned, copied or backfilled. **Classmates can still view these boards** under existing visibility rules; this feature does not make their work private. Private feedback keeps its existing access controls.

An individual board cannot add other students or remove its owner through team membership controls. Use a group board for shared work. Board renaming and normal admin deletion still apply. Deleting a board is not an archive; a later import can create an empty replacement, so retain existing boards to preserve their work. Copying a class's team layout copies only group-board names, never individual boards from its old roster.

### Data model and release notes

- `Team.individualOwnerId` is nullable with a User relation and a unique `(classWorkspaceId, individualOwnerId)` key. Existing teams retain null. Deleting an account clears this marker and preserves its board; it does not transfer ownership to a different account with the same name/email.
- `prisma/migrations/20261001_add_individual_boards/migration.sql` is additive. The live entrypoint synchronizes the schema: review and rehearse the exact delta against a restored backup before an approved release. Prisma may warn about adding a unique constraint; review existing values rather than passing a blanket data-loss flag.
- `src/lib/individual-boards.server.ts` handles identity and existing-roster provisioning. `POST /api/classes/[id]/individual-boards` is ADMIN-only with preview/create actions. Serializable transactions recheck the preview after locking the class; a unique index backs race protection. A stale preview or option change requires a fresh review.
- Roster import accepts an `individualBoards` boolean (default false), includes board decisions in the preview hash, and commits accounts, enrollment and boards atomically. It can create a missing board even when its student is already enrolled. API responses and credential downloads remain private/no-store.

Individual-board verification: all 264 unit tests passed (including individual deliverable attribution), as did six guarded browser/API check groups, TypeScript checking, lint with existing unrelated warnings, and the production build. The checks covered new-account imports, existing enrollment, student dashboard/dialog defaults, own-board editing, cross-board write denial, Gantt export, stable ownership after renaming, cross-class isolation, existing group-work preservation, simultaneous creation, stale previews, archived classes and copying only group-board names. Desktop/mobile setup previews and the student board were inspected. All fixtures were synthetic and removed afterward. Live rollout status is tracked separately in the private operations inventory.

## Find enrolled students in Users

Open **Users** and choose a class from **Class**. Active and archived classes are available, along with **All classes / all users** and **No class enrollment**. This uses actual enrollment, so a student with no team or individual board still appears. A person enrolled in several classes appears once. The Classes column lists all their enrollments; Teams is restricted to the selected class. Filtering does not change enrollment or permissions.

Type a first name, last name, partial name, or email in **Search name or email**. Search ignores capitalization and common accents, accepts either name order, and combines with the class filter. The result count updates immediately. Use **Clear filters** to return to all users.

Click a column heading to sort; click again to reverse. Name sorts by last name then first name. Email, Contact, Role, Classes, Teams, and Joined can also be sorted; Joined means account creation date. Classes and Teams sort alphabetically by their displayed lists, and missing values remain last. Your filter and sort stay selected when you edit an account and the list refreshes. Actions is not a sortable data column.

Implementation: `src/lib/user-directory.ts` provides deterministic filtering/sorting; the existing ADMIN users response adds selected class metadata without adding it to non-admin team-member responses. No schema change is needed for this directory feature. `tests/user-directory.test.ts` covers enrollment without teams, multi-class membership, combined name/email search and all sort directions. `scripts/user-directory-integration-check.ts` is guarded to the local synthetic QA database and verifies the actual page/API; never run it against the NAS.

Directory verification: 267 unit tests, the guarded directory browser/API check, TypeScript, lint (existing unrelated warnings only), and the production build passed. Desktop and mobile layouts were inspected. Browser checks covered active/archived/empty/no-class filters, enrollment without a team, combined search, all sortable headers, admin-only class metadata, and account editing without losing filters or changing passwords. Only synthetic local records were used and cleaned up. This directory feature is part of the roster release; the private operations inventory records live verification.
