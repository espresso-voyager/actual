import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { q } from '#shared/query';

beforeEach(global.emptyDatabase());

test('date $lte includes transactions dated exactly on the boundary', async () => {
  await db.insertAccount({ id: 'acct', name: 'acct' });
  await db.insertPayee({ id: 'p', name: 'p' });
  await db.insertTransaction({
    id: 't1',
    account: 'acct',
    amount: -30574500,
    date: '2026-07-10',
    payee: 'p',
  });

  const { data: lte } = await aqlQuery(
    q('transactions')
      .filter({ account: 'acct', date: { $lte: '2026-07-10' } })
      .options({ splits: 'none' })
      .calculate({ $sum: '$amount' })
      .serialize(),
  );
  const { data: gt } = await aqlQuery(
    q('transactions')
      .filter({
        account: 'acct',
        date: { $gt: '2026-07-10' },
        amount: { $lt: 0 },
      })
      .options({ splits: 'none' })
      .calculate({ $sum: '$amount' })
      .serialize(),
  );
  expect(lte).toBe(-30574500);
  expect(gt).toBe(0);
});
