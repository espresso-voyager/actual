// CUSTOM: helpers for the budget-header recap strip (Family / Personal /
// Savings buckets). Accounts join a bucket via the synced pref
// `coverage-group-${accountId}` ('family' | 'personal'); categories join via
// the name of the category group they belong to.

export type RecapBucket = 'family' | 'personal';

type AccountLike = { id: string; closed: boolean | 0 | 1 };
type GroupLike = { id: string; name: string; is_income?: boolean | 0 | 1 };

/** Open accounts tagged into the given bucket. */
export function accountIdsForBucket(
  accounts: AccountLike[],
  prefs: Record<string, string | undefined>,
  bucket: RecapBucket,
): string[] {
  return accounts
    .filter(a => !a.closed && prefs[`coverage-group-${a.id}`] === bucket)
    .map(a => a.id);
}

/**
 * Amount owed across the given accounts, in cents. Card/expense accounts
 * carry negative balances when money is owed, so owed = -balance; an account
 * in credit reduces the total.
 */
export function owedCents(
  ids: string[],
  balances: Map<string, number>,
): number {
  let total = 0;
  for (const id of ids) {
    total += -(balances.get(id) ?? 0);
  }
  return total;
}

/** Find a non-income category group by case-insensitive name. */
export function findGroupIdByName(
  groups: GroupLike[],
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  return groups.find(g => !g.is_income && g.name.toLowerCase() === target)?.id;
}
