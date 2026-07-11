// CUSTOM: statement-cycle math for card/expense accounts (M2).
// A cycle is defined by its close day (1–31; values ≥ 28 clamp to the last
// day of shorter months, so 31 means "end of month") and a payment day.
// "Due" is what remains of the last closed statement; "accrual" is new
// spending since the close.

/** Clamp a day-of-month to the number of days in that month. */
function clampedDate(year: number, month: number, day: number): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, daysInMonth));
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The most recent statement close date on or before `today` (ISO date). */
export function lastCloseDate(today: Date, closeDay: number): string {
  const candidate = clampedDate(
    today.getFullYear(),
    today.getMonth(),
    closeDay,
  );
  if (candidate.getTime() <= today.getTime()) {
    return toISO(candidate);
  }
  return toISO(
    clampedDate(today.getFullYear(), today.getMonth() - 1, closeDay),
  );
}

/** The first payment date strictly after the close date (ISO date). */
export function nextPayDate(closeISO: string, payDay: number): string {
  const [y, m, d] = closeISO.split('-').map(Number);
  const close = new Date(y, m - 1, d);
  const sameMonth = clampedDate(close.getFullYear(), close.getMonth(), payDay);
  if (sameMonth.getTime() > close.getTime()) {
    return toISO(sameMonth);
  }
  return toISO(clampedDate(close.getFullYear(), close.getMonth() + 1, payDay));
}

/**
 * Split an account's owed balance into "statement due" and "current accrual".
 * Inputs are stored-unit sums over the account's transactions:
 *  - sumThroughClose: all amounts dated on/before the close (negative = owed)
 *  - paymentsAfterClose: positive amounts after the close (settlements)
 *  - chargesAfterClose: negative amounts after the close (new spending)
 * Payments settle the oldest debt first; any excess reduces the accrual.
 */
export function computeCycleAmounts(
  sumThroughClose: number,
  paymentsAfterClose: number,
  chargesAfterClose: number,
): { due: number; accrual: number } {
  const owedAtClose = Math.max(0, -sumThroughClose);
  const due = Math.max(0, owedAtClose - paymentsAfterClose);
  const excessPayments = Math.max(0, paymentsAfterClose - owedAtClose);
  const accrual = Math.max(0, -chargesAfterClose - excessPayments);
  return { due, accrual };
}
