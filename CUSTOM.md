# CUSTOM.md — Colucci fork of Actual Budget

This fork carries a small set of personal customizations on branch `custom/main`.
`master` tracks upstream (`actualbudget/actual`) only — never commit custom work to it.

## Branch model

- `master` — mirrors upstream `actualbudget/actual` master. No custom commits.
- `custom/main` — all custom work. Rebased onto `master` when pulling upstream (optional; skipping upstream entirely is acceptable).

## Custom diffs (M1)

**Encoding-aware CSV import (Shift-JIS support)** — banks in Japan export CSV in Shift-JIS (really CP932/Windows-31J); upstream reads all CSVs as UTF-8, producing mojibake payees.

| File | Change |
|---|---|
| `packages/loot-core/src/server/transactions/import/parse-file.ts` | `ParseFileOptions.encoding?: 'utf8' \| 'shift_jis'` (`CsvEncoding`); `parseCSV` reads the file as binary and decodes via `TextDecoder` when a non-UTF-8 encoding is selected. No new dependency: WHATWG `TextDecoder('shift_jis')` implements CP932 and is available in both the browser and Node ≥ full-ICU builds (verified in both runtimes). |
| `packages/loot-core/src/types/prefs.ts` | New synced pref key `csv-encoding-${accountId}` (remembers the per-account choice). |
| `packages/desktop-client/src/components/modals/ImportTransactionsModal/ImportTransactionsModal.tsx` | "Encoding:" select (UTF-8 / Shift-JIS) in CSV OPTIONS; changing it re-parses the file; choice saved to prefs on import. |
| `packages/loot-core/src/mocks/files/shift-jis.csv` | Test fixture: CP932-encoded CSV with Japanese header + payees (not valid UTF-8 by construction). |
| `packages/loot-core/src/server/transactions/import/parse-file.test.ts` | Two tests: decodes Japanese payees correctly with `encoding: 'shift_jis'`; control test proving UTF-8 parsing of the same file does NOT yield the decoded payee. |

All custom code is marked with `// CUSTOM:` comments to make diffs greppable: `git grep -n "CUSTOM:"`.

## Upstream rebase procedure

Executed once against a no-op pull to prove it works:

```bash
git checkout master
git pull upstream master        # remote 'upstream' = actualbudget/actual
git checkout custom/main
git rebase master
yarn install                    # lockfile may have changed
yarn test                       # full suite must pass before using the build
```

Conflict likelihood is low: custom diffs touch one parser function, one type union, and one modal component. If upstream restructures the import modal or parse-file, re-apply the diff by hand using the table above as the spec.

## Backup / restore and machine migration

**Rule: export the budget before the first run of any new build.**

- **Export:** in-app — Settings → Export budget → saves a `.zip` (all data, unencrypted). Store it off-machine.
- **Restore:** on the file-management screen → Import budget → Actual file → select the `.zip`.
- **Data directory (browser dev build):** budget data lives in the browser's IndexedDB/OPFS for `localhost:3001`, not on disk. Export zips are the durable copy.
- **Machine migration:** clone the fork on the new machine, `yarn install`, `yarn start:browser`, then import the latest export zip. Nothing else transfers.

## Work-machine wipe checklist (interim period)

1. Delete the repo folder (`~/Documents/actual-fork/`).
2. Clear browser site data for `localhost:3001` (IndexedDB holds the dummy budget).
3. Delete any export zips.
4. Revoke the personal-account PAT (github.com → Settings → Developer settings → Tokens) and remove any stored git credential (`git credential-osxkeychain erase`).
5. Only fabricated dummy data is ever used on this machine — real financial data never touches it.

## Dev quickstart

```bash
corepack yarn install     # yarn 4 via corepack; Node >= 22.18 (see .nvmrc)
corepack yarn start:browser   # dev server on http://localhost:3001
corepack yarn test        # full suite (lage across workspaces)
```
