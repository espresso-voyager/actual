// CUSTOM: replaces the stock "Available funds / Overspent / Budgeted / For
// next month" strip in the budget-month header with a recap in Colucci's
// spreadsheet style:
//
//   Available funds  — income available this month (stock binding)
//   Family           — owed on accounts tagged 'family' + envelope balance
//                      of the category group named "Family" (e.g. Rent)
//   Personal         — owed on accounts tagged 'personal' + group "Personal"
//   Savings          — envelope balance of the category group named "Savings"
//
// Accounts are tagged from the account header ("Add to recap" toggle);
// categories join by being placed in a group with the matching name.
// NOTE: put only bank-paid categories (rent, dues) in Family/Personal groups;
// card-paid spending is already counted via the tagged card's owed balance.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Trans } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { View } from '@actual-app/components/view';
import { q } from '@actual-app/core/shared/query';

import { EnvelopeCellValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValueText } from '#components/spreadsheet/CellValue';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPrefs } from '#hooks/useSyncedPrefs';
import { aqlQuery } from '#queries/aqlQuery';
import { envelopeBudget } from '#spreadsheet/bindings';

import { accountIdsForBucket, findGroupIdByName, owedCents } from './recap';

type BucketAmountProps = {
  owed: number;
  groupId?: string;
};

function BucketWithGroup({ owed, groupId }: { owed: number; groupId: string }) {
  const groupBalance = useSheetValue<'envelope-budget', 'group-leftover'>(
    envelopeBudget.groupBalance(groupId),
  );
  return <BucketText amount={owed + (groupBalance ?? 0)} />;
}

function BucketText({ amount }: { amount: number }) {
  const format = useFormat();
  return (
    <PrivacyFilter>
      <Block style={{ fontWeight: 600 }}>{format(amount, 'financial')}</Block>
    </PrivacyFilter>
  );
}

function BucketAmount({ owed, groupId }: BucketAmountProps) {
  return groupId ? (
    <BucketWithGroup owed={owed} groupId={groupId} />
  ) : (
    <BucketText amount={owed} />
  );
}

type RecapListProps = {
  style?: CSSProperties;
};

export function RecapList({ style }: RecapListProps) {
  const { data: accounts = [] } = useAccounts();
  const { data: { grouped: categoryGroups } = { grouped: [] } } =
    useCategories();
  const [prefs] = useSyncedPrefs();
  const [balances, setBalances] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const { data } = await aqlQuery(
        q('transactions')
          .filter({ tombstone: false })
          .groupBy('account')
          .select(['account', { amount: { $sum: '$amount' } }]),
      );
      if (!cancelled) {
        const map = new Map<string, number>();
        for (const row of data as Array<{ account: string; amount: number }>) {
          map.set(row.account, row.amount ?? 0);
        }
        setBalances(map);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const familyOwed = owedCents(
    accountIdsForBucket(accounts, prefs, 'family'),
    balances,
  );
  const personalOwed = owedCents(
    accountIdsForBucket(accounts, prefs, 'personal'),
    balances,
  );

  const familyGroupId = findGroupIdByName(categoryGroups, 'Family');
  const personalGroupId = findGroupIdByName(categoryGroups, 'Personal');
  const savingsGroupId = findGroupIdByName(categoryGroups, 'Savings');

  return (
    <View
      style={{
        flexDirection: 'row',
        lineHeight: 1.5,
        justifyContent: 'center',
        ...styles.smallText,
        ...style,
      }}
    >
      <View
        style={{
          textAlign: 'right',
          marginRight: 10,
          minWidth: 50,
        }}
      >
        <EnvelopeCellValue
          binding={envelopeBudget.incomeAvailable}
          type="financial"
        >
          {props => <CellValueText {...props} style={{ fontWeight: 600 }} />}
        </EnvelopeCellValue>

        <BucketAmount owed={familyOwed} groupId={familyGroupId} />
        <BucketAmount owed={personalOwed} groupId={personalGroupId} />
        <BucketAmount owed={0} groupId={savingsGroupId} />
      </View>

      <View>
        <Block>
          <Trans>Available funds</Trans>
        </Block>

        <Block>
          <Trans>Family</Trans>
        </Block>

        <Block>
          <Trans>Personal</Trans>
        </Block>

        <Block>
          <Trans>Savings</Trans>
        </Block>
      </View>
    </View>
  );
}
