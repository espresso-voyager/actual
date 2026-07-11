# CUSTOM.md — Colucci fork of Actual Budget

This fork carries a small set of personal customizations on branch `custom/main`.
`master` tracks upstream (`actualbudget/actual`) only — never commit custom work to it.

## Branch model

- `master` — mirrors upstream `actualbudget/actual` master. No custom commits.
- `custom/main` — all custom work. Rebased onto `master` when pulling upstream (optional; skipping upstream entirely is acceptable).

## Custom diffs (M1)

**Encoding-aware CSV import (Shift-JIS support)** — banks in Japan export CSV in Shift-JIS (really CP932/Windows-31J); upstream reads all CSVs as UTF-8, producing mojibake payees.

| File                                                                                                | Change                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/loot-core/src/server/transactions/import/parse-file.ts`                                   | `ParseFileOptions.encoding?: 'utf8' \| 'shift_jis'` (`CsvEncoding`); `parseCSV` reads the file as binary and decodes via `TextDecoder` when a non-UTF-8 encoding is selected. No new dependency: WHATWG `TextDecoder('shift_jis')` implements CP932 and is available in both the browser and Node ≥ full-ICU builds (verified in both runtimes). |
| `packages/loot-core/src/types/prefs.ts`                                                             | New synced pref key `csv-encoding-${accountId}` (remembers the per-account choice).                                                                                                                                                                                                                                                              |
| `packages/desktop-client/src/components/modals/ImportTransactionsModal/ImportTransactionsModal.tsx` | "Encoding:" select (UTF-8 / Shift-JIS) in CSV OPTIONS; changing it re-parses the file; choice saved to prefs on import.                                                                                                                                                                                                                          |
| `packages/loot-core/src/mocks/files/shift-jis.csv`                                                  | Test fixture: CP932-encoded CSV with Japanese header + payees (not valid UTF-8 by construction).                                                                                                                                                                                                                                                 |
| `packages/loot-core/src/server/transactions/import/parse-file.test.ts`                              | Two tests: decodes Japanese payees correctly with `encoding: 'shift_jis'`; control test proving UTF-8 parsing of the same file does NOT yield the decoded payee.                                                                                                                                                                                 |

## Custom diffs (M3)

**JPY valuation for USD off-budget accounts** — off-budget accounts holding USD show a JPY-equivalent pill next to the balance. Display-layer only: amounts stay native USD, no ledger math, no schema changes.

| File                                                               | Change                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/desktop-client/src/components/accounts/UsdValuation.tsx` | New widget: "Show ¥" toggle on every off-budget account header; when enabled, shows `≈ ¥…` at a USD→JPY rate with an editable manual-rate field (works fully offline), a refresh button that fetches the current rate from api.frankfurter.dev (free, keyless; failures keep the saved rate and show "offline"), and a dismiss button. |
| `packages/desktop-client/src/components/accounts/fxUsdJpy.ts`      | Pure helpers: `parseRate`, `computeJpyEquivalent` (USD cents → whole yen), `formatJpy`.                                                                                                                                                                                                                                                |
| `packages/desktop-client/src/components/accounts/fxUsdJpy.test.ts` | Unit tests for the helpers (9 tests).                                                                                                                                                                                                                                                                                                  |
| `packages/desktop-client/src/components/accounts/Balance.tsx`      | One insertion: renders `<UsdValuation>` in the account header balance row.                                                                                                                                                                                                                                                             |
| `packages/loot-core/src/types/prefs.ts`                            | Synced pref keys: `usd-account-${accountId}` (per-account toggle), `fx-usdjpy-rate`, `fx-usdjpy-source`.                                                                                                                                                                                                                               |

## Custom diffs (M3.5 — Net Wealth card)

**Dual-currency net wealth on the Reports page** — a card above the report dashboard showing total net wealth in BOTH yen and dollars: JPY-native accounts + USD-flagged accounts, cross-converted with the shared USD/JPY rate. Snapshot only (deliberately not the historical net-worth graph, which would need historical rates).

| File                                                               | Change                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/desktop-client/src/components/reports/NetWealthCard.tsx` | New card: sums open-account balances grouped by account via one AQL query, buckets by the `usd-account-*` flag, shows `≈ ¥…` and `≈ $…` plus the rate and its source. Without a saved rate it shows the JPY total and a hint. |
| `packages/desktop-client/src/components/reports/Overview.tsx`      | One insertion above the dashboard grid.                                                                                                                                                                                       |
| `packages/desktop-client/src/components/accounts/fxUsdJpy.ts`      | Added `computeUsdEquivalentCents` and `computeNetWealth` (+5 tests).                                                                                                                                                          |
| `packages/desktop-client/package.json`                             | One `imports` entry so `#components/accounts/fxUsdJpy` resolves (`#components/*` wildcard only maps `.tsx`).                                                                                                                  |

## Custom diffs (M2a — budget-header recap)

**Spreadsheet-style recap on the Budget tab** — replaces the stock "Available funds / Overspent / Budgeted / For next month" strip in each month's summary with: **Available funds · Family · Personal · Savings**, mirroring the Colucci Dashboard spreadsheet's Kaolucci/Colucci totals.

How the buckets are defined (fully in-app, no code edits to change membership):

- **Accounts** (cards, expense accounts): each account header has an "Add to recap" toggle that cycles untagged → Family → Personal. A tagged account contributes its **owed balance** (−balance).
- **Categories** (Rent, dues, new activities, savings buckets): create category groups literally named **Family**, **Personal**, **Savings** (case-insensitive) — every category in the group contributes its **envelope balance**. Adding a new activity = adding a category to the group.
- **Rule to avoid double counting**: only put bank-paid categories in the Family/Personal groups. Card-paid spending is already counted through the tagged card's owed balance.

| File                                                                                              | Change                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/desktop-client/src/components/budget/envelope/budgetsummary/RecapList.tsx`              | The recap strip (renders in place of `TotalsList` in the expanded month summary; the stock TotalsList still exists and still backs the To Budget tooltip). |
| `packages/desktop-client/src/components/budget/envelope/budgetsummary/recap.ts` + `recap.test.ts` | Pure helpers: `accountIdsForBucket`, `owedCents`, `findGroupIdByName` (7 tests).                                                                           |
| `packages/desktop-client/src/components/accounts/CoverageTag.tsx`                                 | The "Add to recap" cycle toggle on account headers.                                                                                                        |
| `packages/desktop-client/src/components/budget/envelope/budgetsummary/BudgetSummary.tsx`          | Two-line swap: renders `RecapList` instead of `TotalsList`.                                                                                                |
| `packages/desktop-client/src/components/accounts/Balance.tsx`                                     | One insertion for `CoverageTag`.                                                                                                                           |
| `packages/loot-core/src/types/prefs.ts`                                                           | Synced pref key `coverage-group-${accountId}`.                                                                                                             |

Note: account owed balances are live totals (all statements), not per-cycle. Statement-cycle windows (10th→9th) remain the M2b follow-up.

## Custom diffs (M2a.2 — sidebar Investments + income-first budget)

- **Sidebar:** grouping is fully decoupled from on/off-budget status AND currency. Order: **On budget** (default group for budgeted accounts) → **Investments** (default for off-budget) → **named groups** (alphabetical), which can hold ANY account regardless of budget status. All group headers — including empty ones — render identically (title style + underline) with a **live summed balance** (custom binding `accountSetBalance`). Accounts move between groups by **drag-and-drop** (onto an account in another group or onto a group header; `Account.tsx` drop targets accept both budget types) or via "Set section". **"Add group"** at the bottom of the account list creates empty groups (`sidebar-groups` pref). Every account row carries a **(¥)/($)** badge toggled by the **¥/$ pill** on the account header (`usd-account-*` pref).
- **On/off budget after creation:** the account header has an **"On budget"/"Off budget" toggle** (`BudgetStatusTag.tsx`); `account-update` in `loot-core/server/accounts/app.ts` extended to persist `offbudget`. Flipping to on-budget makes historical transactions participate in envelope math (uncategorized ones surface as needing categories). Caveat: keep USD accounts off-budget — a USD on-budget account feeds raw dollar amounts into envelope math.
- **Group management:** the `sidebar-groups` pref is the group ORDER — drag a group header onto another header to reorder whole groups. Right-click a group header → **Rename group**: named groups are truly renamed (order list + member prefs migrate); On budget / Investments keep their identity and get a display-label override (`sidebar-group-labels` pref). **"+ Add group"** lives at the sidebar bottom, directly above "+ Add account".
- **Budget tab:** the Income group renders **above** the expense groups (spreadsheet order: income first, then allocations).

| File                                                                 | Change                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/desktop-client/src/components/sidebar/Accounts.tsx`        | Rename + section grouping + currency badges.                                                     |
| `packages/desktop-client/src/components/accounts/SectionTag.tsx`     | "Set section" inline editor on off-budget account headers (pref `sidebar-section-${accountId}`). |
| `packages/desktop-client/src/components/budget/BudgetCategories.tsx` | Income items prepended instead of appended.                                                      |
| `packages/desktop-client/src/components/accounts/Balance.tsx`        | One insertion for `SectionTag`.                                                                  |
| `packages/loot-core/src/types/prefs.ts`                              | Synced pref key `sidebar-section-${accountId}`.                                                  |

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
