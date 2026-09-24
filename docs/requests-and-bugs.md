# Feature requests and bug reports

Open **Requests & bugs** in the header to submit a Bug report or Feature request. Enter a short title and description; bug reports also have optional reproduction steps. Avoid passwords, keys, and private student information. Text is stored on the existing self-hosted database; it is not sent to an external issue tracker or AI service.

Members and team leads see only their own submissions. Staff (ADMIN) see all submissions. Observers cannot read or submit posts. This is application-wide, independent of course membership and class archive state.

Select a post to see its status and staff response. Filter by type or status, use pagination, and refresh to load updates. Staff can set New, Planned, In progress, Resolved, or Closed and write a response. Conflicting staff saves are rejected until refreshed. Original submissions are retained; attachments, voting, and threaded discussion are not part of this version. Submissions survive deletion of their author's account and remain available to staff.

Each signed-in account can create up to 20 posts in a rolling 24-hour period. Titles are limited to 160 characters, descriptions and staff responses to 10,000, and reproduction steps to 5,000.

Deployment adds only the SupportPost table, its indexes, and an optional author foreign key. Use the existing protected backup, restored-copy rehearsal, and data-preservation procedure in OPERATIONS.md. All workers must pause during the final backup and schema change. Rollbacks must bypass startup schema synchronization to retain new submissions.
