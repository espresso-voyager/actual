// CUSTOM: JPY valuation helpers for USD off-budget accounts (display-layer
// only — no ledger math). Rates are stored as synced prefs; conversion
// happens at render time.

/** Parse a user-entered USD→JPY rate. Returns null unless a finite, positive number. */
export function parseRate(value: string | undefined): number | null {
  if (value == null || value.trim() === '') {
    return null;
  }
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Convert a USD balance in cents to whole yen at the given rate. */
export function computeJpyEquivalent(usdCents: number, rate: number): number {
  return Math.round((usdCents * rate) / 100);
}

/** Format whole yen with a sign and thousands separators, e.g. -¥1,234,567. */
export function formatJpy(yen: number): string {
  const sign = yen < 0 ? '-' : '';
  return `${sign}¥${Math.abs(yen).toLocaleString('en-US')}`;
}

/** Convert a JPY balance in stored units (yen × 100) to USD cents at the given rate. */
export function computeUsdEquivalentCents(
  jpyStored: number,
  rate: number,
): number {
  return Math.round(jpyStored / rate);
}

/**
 * Combined net wealth across JPY-native and USD-native balances, expressed
 * in both currencies at one rate so the two totals are always consistent.
 * Inputs are stored units (currency × 100); output is whole yen and USD cents.
 */
export function computeNetWealth(
  jpyStored: number,
  usdCents: number,
  rate: number,
): { yen: number; usdCents: number } {
  return {
    yen: Math.round(jpyStored / 100) + computeJpyEquivalent(usdCents, rate),
    usdCents: usdCents + computeUsdEquivalentCents(jpyStored, rate),
  };
}
