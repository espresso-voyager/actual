// CUSTOM: tests for statement-cycle math
import { computeCycleAmounts, lastCloseDate, nextPayDate } from './cycle';

describe('lastCloseDate', () => {
  it('uses this month when the close day has passed', () => {
    // MC-style 9th close, today July 12
    expect(lastCloseDate(new Date(2026, 6, 12), 9)).toBe('2026-07-09');
  });

  it('uses last month when the close day is still ahead', () => {
    expect(lastCloseDate(new Date(2026, 6, 5), 9)).toBe('2026-06-09');
  });

  it('treats 31 as end-of-month and clamps short months', () => {
    // TAC-style end-of-month close, today July 12 → closed June 30
    expect(lastCloseDate(new Date(2026, 6, 12), 31)).toBe('2026-06-30');
    // end of February
    expect(lastCloseDate(new Date(2026, 2, 5), 31)).toBe('2026-02-28');
  });

  it('close day equal to today counts as closed', () => {
    expect(lastCloseDate(new Date(2026, 6, 9), 9)).toBe('2026-07-09');
  });
});

describe('nextPayDate', () => {
  it('pays later the same month when the pay day follows the close', () => {
    // TAC: closes June 30, debited July 13
    expect(nextPayDate('2026-06-30', 13)).toBe('2026-07-13');
  });

  it('pays the following month when the pay day precedes the close day', () => {
    // MC: closes July 9... paid Aug 6
    expect(nextPayDate('2026-07-09', 6)).toBe('2026-08-06');
  });
});

describe('computeCycleAmounts', () => {
  it('splits statement due from current accrual', () => {
    // Owed 23,000 at close; no payments yet; 12,000 new charges
    expect(computeCycleAmounts(-2_300_000, 0, -1_200_000)).toEqual({
      due: 2_300_000,
      accrual: 1_200_000,
    });
  });

  it('payments after close settle the statement', () => {
    expect(computeCycleAmounts(-2_300_000, 2_300_000, -1_200_000)).toEqual({
      due: 0,
      accrual: 1_200_000,
    });
  });

  it('partial payment leaves a remainder due', () => {
    expect(computeCycleAmounts(-2_300_000, 1_000_000, 0)).toEqual({
      due: 1_300_000,
      accrual: 0,
    });
  });

  it('excess payments reduce the accrual, never go negative', () => {
    expect(computeCycleAmounts(-2_300_000, 3_000_000, -500_000)).toEqual({
      due: 0,
      accrual: 0,
    });
  });

  it('account in credit at close has nothing due', () => {
    expect(computeCycleAmounts(500, 0, -1_000)).toEqual({
      due: 0,
      accrual: 1_000,
    });
  });
});
