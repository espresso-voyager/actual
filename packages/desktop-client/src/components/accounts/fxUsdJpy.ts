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
