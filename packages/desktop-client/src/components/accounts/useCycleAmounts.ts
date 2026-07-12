// CUSTOM: live statement-cycle amounts for an account (M2). Splits the
// account's owed balance into "statement due" (last closed cycle, minus
// payments made since) and "current accrual" (new spending since the close).
// Recomputes whenever the transactions table changes (sync events), so the
// sidebar/header stay current as entries are added or edited.
import { useEffect, useState } from 'react';

import { listen } from '@actual-app/core/platform/client/connection';
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
      const amounts = await fetchCycleAmounts(accountId!, closeDay!, payDay!);
      if (!cancelled) {
        setResult(amounts);
      }
    }
    void run();
    const unlisten = listen('sync-event', event => {
      if (
        (event.type === 'applied' || event.type === 'success') &&
        event.tables?.includes('transactions')
      ) {
        void run();
      }
    });
    return () => {
      cancelled = true;
      unlisten();
    };
  }, [accountId, closeDay, payDay]);

  return result;
}

export function parseCycleDay(value: string | undefined): number | null {
  const n = parseInt(value || '', 10);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}
