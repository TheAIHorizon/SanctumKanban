# DCWF Reference Data

This directory holds the **DoD Cyber Workforce Framework (DCWF)** reference data
that powers Sanctum Kanban's task-alignment feature. It is imported into the
database with:

```bash
npm run db:import-dcwf
```

The import is **idempotent** — re-run it any time to update after editing the
source data or dropping in a newer framework version.

## What's here

The default data is the official **DCWF v5.2** ((U)/unclassified, publicly
released by the DoD), split into four files:

| File | Records | Contents |
|---|---|---|
| `elements.json` | 7 | Top-level categories (IT, Cybersecurity, Cyber Effects, Intel, Cyber Enablers, Data/AI, Software Engineering) |
| `work-roles.json` | 76 | Work roles, e.g. `451 – System Administrator`, each tied to an element |
| `ksats.json` | 3037 | KSATs — 1315 **Task**, 906 Knowledge, 469 Skill, 347 Ability |
| `mapping.json` | 6925 | Which KSATs belong to which work role (Core / Additional / Unassigned) |

## Bring your own workbook

You are **not** limited to the bundled data. Provide your own framework (a newer
DCWF release, a customized role set, or an entirely different competency model)
in **either** of two shapes.

### Option A — one combined file (recommended for custom data)

```bash
npm run db:import-dcwf -- --file /path/to/my-dcwf.json
```

```jsonc
{
  "version": "5.3",                     // optional, informational
  "elements": [
    { "name": "Cybersecurity",          // required, unique
      "code": "CS",                     // optional
      "opr": "DoW CIO",                 // optional
      "description": "..." }            // optional
  ],
  "workRoles": [
    { "code": "451",                    // required, unique (string; keep leading digits)
      "title": "System Administrator",  // required
      "element": "IT (Cyberspace)",     // optional — must match an element "name"
      "description": "..." }            // optional
  ],
  "ksats": [
    { "id": "781",                      // required, unique (string; suffixes like "701A" are fine)
      "type": "Task",                   // "Task" | "Knowledge" | "Skill" | "Ability"
      "description": "Plan, execute, and verify data redundancy..." }
  ],
  "mapping": [
    { "workRoleCode": "451",            // must match a workRoles[].code
      "ksatId": "781",                  // must match a ksats[].id
      "coreOrAdditional": "Core" }      // optional: "Core" | "Additional" | "Unassigned"
  ]
}
```

### Option B — four separate files (the bundled layout)

Replace the four files in this directory (`elements.json`, `work-roles.json`,
`ksats.json`, `mapping.json`) using the same field names as the combined format
above (the mapping file also accepts `workRole` as an alias for `workRoleCode`),
then run `npm run db:import-dcwf` with no arguments.

## Rules & notes

- **IDs are strings.** Never cast `ksats[].id` or `workRoles[].code` to a number
  — some carry letter suffixes (`701A`, `1027A`) or leading zeros.
- **Idempotent upserts** by natural key: element `name`, role `code`, ksat `id`.
  Editing a description and re-importing updates it in place; it never
  duplicates.
- **Unknown references are skipped, not fatal.** A `mapping` row whose
  `workRoleCode` or `ksatId` doesn't resolve is counted and skipped, and the
  import still succeeds. Check the printed `skipped` count if a mapping looks
  short.
- **In-scope roles.** The importer flags a curated set of ~16 work roles as
  `inScope = true` (the enterprise-build + week-13 pentest/hardening/IR roles
  relevant to the course). Edit `IN_SCOPE_CODES` in `prisma/import-dcwf.ts` to
  change the default set. Instructors can also toggle any of the full 76 roles
  in-scope from the app.

## Regenerating the bundled JSON from the Excel workbook

The bundled files were extracted from `DCWF Tool vX.Y.xlsx` with `openpyxl`.
To regenerate from a new workbook release, read the `Elements`, `Work Roles`,
`KSATs`, and `DCWF Tool` sheets and emit the field names documented above.
