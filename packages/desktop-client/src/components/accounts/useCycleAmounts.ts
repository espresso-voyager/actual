// CUSTOM: live statement-cycle amounts for an account (M2). Splits the
// account's owed balance into "statement due" (last closed cycle, minus
// payments made since) and "current accrual" (new spending since the close).
import { useEffect, useState } from 'react';

import { q } from '@actual-app/core/shared/query';

import { aqlQuery } from '#queries/aqlQuery';

import { computeCycleAmounts, lastCloseDate, nextPayDate } from './cycle';

type CycleAmounts = {
  due: number;
  accrual: number;
  closeDate: string;
  payDate: string;
};

async function sumAmounts(
  accountId: string,
  filter: Record<string, unknown>,
): Promise<number> {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ account: accountId, ...filter })
      .options({ splits: 'none' })
      .calculate({ $sum: '$amount' }),
  );
  return (data as number | null) ?? 0;
}

/** One-shot fetch of the cycle split for an account (also used outside hooks). */
export async function fetchCycleAmounts(
  accountId: string,
  closeDay: number,
  payDay: number,
): Promise<CycleAmounts> {
  const close = lastCloseDate(new Date(), closeDay);
  const pay = nextPayDate(close, payDay);
  const [throughClose, paymentsAfter, chargesAfter] = await Promise.all([
    sumAmounts(accountId, { date: { $lte: close } }),
    sumAmounts(accountId, { date: { $gt: close }, amount: { $gt: 0 } }),
    sumAmounts(accountId, { date: { $gt: close }, amount: { $lt: 0 } }),
  ]);
  const { due, accrual } = computeCycleAmounts(
    throughClose,
    paymentsAfter,
    chargesAfter,
  );
  return { due, accrual, closeDate: close, payDate: pay };
}

export function useCycleAmounts(
  accountId: string | undefined,
  closeDay: number | null,
  payDay: number | null,
): CycleAmounts | null {
  const [result, setResult] = useState<CycleAmounts | null>(null);

  useEffect(() => {
    if (!accountId || closeDay == null || payDay == null) {
      setResult(null);
      return;
    }
    let cancelled = false;
    async function run() {
      // Recomputed on mount; typing in this render cycle's params is guarded
      const amounts = await fetchCycleAmounts(accountId!, closeDay!, payDay!);
      if (!cancelled) {
        setResult(amounts);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [accountId, closeDay, payDay]);

  return result;
}

export function parseCycleDay(value: string | undefined): number | null {
  const n = parseInt(value || '', 10);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}
