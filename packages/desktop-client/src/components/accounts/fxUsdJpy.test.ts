// CUSTOM: tests for JPY valuation helpers
import {
  computeJpyEquivalent,
  computeNetWealth,
  computeUsdEquivalentCents,
  formatJpy,
  parseRate,
} from './fxUsdJpy';

describe('parseRate', () => {
  it('parses a plain decimal rate', () => {
    expect(parseRate('157.32')).toBe(157.32);
  });

  it('rejects empty, non-numeric, zero and negative values', () => {
    expect(parseRate(undefined)).toBeNull();
    expect(parseRate('')).toBeNull();
    expect(parseRate('  ')).toBeNull();
    expect(parseRate('abc')).toBeNull();
    expect(parseRate('0')).toBeNull();
    expect(parseRate('-5')).toBeNull();
    expect(parseRate('Infinity')).toBeNull();
  });
});

describe('computeJpyEquivalent', () => {
  it('converts USD cents to whole yen', () => {
    // $1,000.00 at 157.32 → ¥157,320
    expect(computeJpyEquivalent(100_000, 157.32)).toBe(157_320);
  });

  it('rounds to the nearest yen', () => {
    // $0.01 at 157.32 → ¥1.5732 → ¥2
    expect(computeJpyEquivalent(1, 157.32)).toBe(2);
  });

  it('handles negative balances', () => {
    expect(computeJpyEquivalent(-50_000, 150)).toBe(-75_000);
  });

  it('handles zero', () => {
    expect(computeJpyEquivalent(0, 150)).toBe(0);
  });
});

describe('computeUsdEquivalentCents', () => {
  it('converts stored yen units to USD cents', () => {
    // ¥1,573,200 (stored 157,320,000) at 157.32 → $10,000.00 (1,000,000 cents)
    expect(computeUsdEquivalentCents(157_320_000, 157.32)).toBe(1_000_000);
  });

  it('handles negative and zero', () => {
    expect(computeUsdEquivalentCents(-15_000, 150)).toBe(-100);
    expect(computeUsdEquivalentCents(0, 150)).toBe(0);
  });
});

describe('computeNetWealth', () => {
  it('cross-converts both buckets with one rate', () => {
    // JPY accounts: ¥3,000,000 (stored 300,000,000)
    // USD accounts: $10,000.00 (1,000,000 cents), rate 150
    const { yen, usdCents } = computeNetWealth(300_000_000, 1_000_000, 150);
    expect(yen).toBe(3_000_000 + 1_500_000); // ¥4,500,000
    expect(usdCents).toBe(1_000_000 + 2_000_000); // $30,000.00
  });

  it('round-trips consistently at the same rate', () => {
    const { yen, usdCents } = computeNetWealth(300_000_000, 1_000_000, 150);
    // yen total / rate ≈ usd total (within rounding of whole yen/cents)
    expect(Math.round((yen / 150) * 100)).toBe(usdCents);
  });

  it('handles one bucket being empty', () => {
    expect(computeNetWealth(0, 1_000_000, 150)).toEqual({
      yen: 1_500_000,
      usdCents: 1_000_000,
    });
    expect(computeNetWealth(300_000_000, 0, 150)).toEqual({
      yen: 3_000_000,
      usdCents: 2_000_000,
    });
  });
});

describe('formatJpy', () => {
  it('formats with yen sign and separators', () => {
    expect(formatJpy(157_320)).toBe('¥157,320');
  });

  it('places the minus sign before the yen sign', () => {
    expect(formatJpy(-75_000)).toBe('-¥75,000');
  });

  it('formats zero', () => {
    expect(formatJpy(0)).toBe('¥0');
  });
});
