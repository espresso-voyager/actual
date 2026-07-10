// CUSTOM: tests for JPY valuation helpers
import { computeJpyEquivalent, formatJpy, parseRate } from './fxUsdJpy';

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
