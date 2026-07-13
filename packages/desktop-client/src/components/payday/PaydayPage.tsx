// CUSTOM: the Payday page — Colucci's payday allocation ritual as a live
// screen (replaces the spreadsheet's monthly row):
//
//   Income received     sum of income-category deposits this month
//   Rent                planned amount (editable), transfers to the family bank
//   Family              statement dues of accounts tagged 'family' → one transfer
//   Personal            statement dues of accounts tagged 'personal' → one transfer
//   Remaining           income − rent − family − personal
//   Savings buckets     categories in the group named "Savings", each with an
//                       editable planned amount; shows what's left unallocated
//
// Everything is edit-in-place: bucket membership = edit the Savings category
// group; obligations = tag/untag accounts ("Add to recap"); amounts = click
// and type. Destination/source banks are dropdowns, remembered as prefs.
// Recorded transfers are ordinary categoryless transfers, so dues drop
// immediately (cycle amounts listen to sync events).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { listen, send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { AccountEntity } from '@actual-app/core/types/models';

import {
  fetchCycleAmounts,
  parseCycleDay,
} from '#components/accounts/useCycleAmounts';
import { Page } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPrefs } from '#hooks/useSyncedPrefs';
import { aqlQuery } from '#queries/aqlQuery';

const sectionTitle = {
  fontSize: 15,
  fontWeight: 600 as const,
  marginTop: 25,
  marginBottom: 8,
};

const row = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  padding: '4px 0',
};

function yenToStored(yen: number): number {
  return Math.round(yen) * 100;
}

function parseYen(value: string): number {
  const n = parseInt(value.replace(/[,¥\s]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Editable planned amount stored (in whole yen) as a synced pref. */
function PlanAmount({
  prefKey,
  onChangeStored,
}: {
  prefKey: `payday-plan-${string}`;
  onChangeStored?: (stored: number) => void;
}) {
  const format = useFormat();
  const [prefs, savePrefs] = useSyncedPrefs();
  const [editing, setEditing] = useState(false);
  const yen = parseYen(prefs[prefKey] || '0');

  useEffect(() => {
    onChangeStored?.(yenToStored(yen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yen]);

  if (editing) {
    return (
      <Input
        defaultValue={yen ? String(yen) : ''}
        placeholder="0"
        autoFocus
        onEnter={value => {
          savePrefs({ [prefKey]: String(parseYen(value)) });
          setEditing(false);
        }}
        onBlur={e => {
          savePrefs({ [prefKey]: String(parseYen(e.currentTarget.value)) });
          setEditing(false);
        }}
        onEscape={() => setEditing(false)}
        style={{ width: 110, textAlign: 'right' }}
      />
    );
  }
  return (
    <Button
      variant="bare"
      onPress={() => setEditing(true)}
      style={{ fontWeight: 600, fontSize: 14 }}
    >
      <PrivacyFilter>{format(yenToStored(yen), 'financial')}</PrivacyFilter>
    </Button>
  );
}

/** Account picker persisted as a synced pref. */
function AccountSelect({
  prefKey,
  accounts,
  label,
}: {
  prefKey:
    | 'payday-from-account'
    | 'payday-dest-family'
    | 'payday-dest-personal';
  accounts: AccountEntity[];
  label: string;
}) {
  const [prefs, savePrefs] = useSyncedPrefs();
  const options = accounts.map((a): [string, string] => [a.id, a.name]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
        {label}
      </Text>
      <Select
        options={options}
        value={prefs[prefKey] || ''}
        defaultLabel="Choose account…"
        onChange={value => savePrefs({ [prefKey]: value })}
        style={{ width: 150 }}
      />
    </View>
  );
}

type Obligation = {
  accountId: string;
  name: string;
  due: number;
  payDate: string | null;
};

export function PaydayPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: accounts = [] } = useAccounts();
  const { data: { grouped: categoryGroups } = { grouped: [] } } =
    useCategories();
  const [prefs] = useSyncedPrefs();

  const openAccounts = useMemo(
    () => accounts.filter(a => !a.closed),
    [accounts],
  );
  const bankAccounts = useMemo(
    () => openAccounts.filter(a => !a.offbudget),
    [openAccounts],
  );

  const [income, setIncome] = useState(0);
  const [family, setFamily] = useState<Obligation[]>([]);
  const [personal, setPersonal] = useState<Obligation[]>([]);
  const [recorded, setRecorded] = useState<string[]>([]);

  const month = monthUtils.currentMonth();

  const refresh = useCallback(async () => {
    // Income received this month (income categories, deposits)
    const { data: incomeSum } = await aqlQuery(
      q('transactions')
        .filter({
          'category.is_income': true,
          date: { $transform: '$month', $eq: month },
        })
        .options({ splits: 'none' })
        .calculate({ $sum: '$amount' }),
    );
    setIncome((incomeSum as number | null) ?? 0);

    // Obligations per bucket: statement due (cycle) or full owed balance
    async function obligationsFor(bucket: string): Promise<Obligation[]> {
      const result: Obligation[] = [];
      for (const account of openAccounts) {
        if (prefs[`coverage-group-${account.id}`] !== bucket) {
          continue;
        }
        const closeDay = parseCycleDay(prefs[`cycle-close-day-${account.id}`]);
        const payDay = parseCycleDay(prefs[`cycle-pay-day-${account.id}`]);
        if (closeDay != null && payDay != null) {
          const amounts = await fetchCycleAmounts(account.id, closeDay, payDay);
          result.push({
            accountId: account.id,
            name: account.name,
            due: amounts.due,
            payDate: amounts.payDate,
          });
        } else {
          const { data: balance } = await aqlQuery(
            q('transactions')
              .filter({ account: account.id })
              .options({ splits: 'none' })
              .calculate({ $sum: '$amount' }),
          );
          result.push({
            accountId: account.id,
            name: account.name,
            due: Math.max(0, -((balance as number | null) ?? 0)),
            payDate: null,
          });
        }
      }
      return result;
    }

    setFamily(await obligationsFor('family'));
    setPersonal(await obligationsFor('personal'));
  }, [month, openAccounts, prefs]);

  useEffect(() => {
    void refresh();
    const unlisten = listen('sync-event', event => {
      if (
        (event.type === 'applied' || event.type === 'success') &&
        event.tables?.includes('transactions')
      ) {
        void refresh();
      }
    });
    return unlisten;
  }, [refresh]);

  const [rentStored, setRentStored] = useState(0);
  const familyTotal = family.reduce((s, o) => s + o.due, 0);
  const personalTotal = personal.reduce((s, o) => s + o.due, 0);
  const remaining = income - rentStored - familyTotal - personalTotal;

  // Savings buckets: categories in the group named "Savings"
  const savingsGroup = categoryGroups.find(
    g =>
      !g.is_income &&
      (g.name.toLowerCase() === 'savings' ||
        g.name.toLowerCase().includes('savings')),
  );
  const savingsCategories = savingsGroup?.categories ?? [];
  const savingsPlanned = savingsCategories.reduce(
    (s, c) => s + yenToStored(parseYen(prefs[`payday-plan-${c.id}`] || '0')),
    0,
  );
  const unallocated = remaining - savingsPlanned;

  async function recordTransfer(
    label: string,
    destPref: 'payday-dest-family' | 'payday-dest-personal',
    amount: number,
  ) {
    const fromId = prefs['payday-from-account'];
    const toId = prefs[destPref];
    if (!fromId || !toId || fromId === toId || amount <= 0) {
      return;
    }
    const { data: payees } = await aqlQuery(
      q('payees').filter({ transfer_acct: toId }).select(['id']),
    );
    const payeeId = (payees as Array<{ id: string }>)[0]?.id;
    if (!payeeId) {
      return;
    }
    await send('transaction-add', {
      id: crypto.randomUUID(),
      account: fromId,
      amount: -amount,
      payee: payeeId,
      date: monthUtils.currentDay(),
      cleared: false,
    });
    setRecorded(prev => [...prev, label]);
  }

  function TransferButton({
    label,
    destPref,
    amount,
  }: {
    label: string;
    destPref: 'payday-dest-family' | 'payday-dest-personal';
    amount: number;
  }) {
    const done = recorded.includes(label);
    const ready =
      !!prefs['payday-from-account'] &&
      !!prefs[destPref] &&
      prefs['payday-from-account'] !== prefs[destPref] &&
      amount > 0;
    return (
      <Button
        variant={done ? 'bare' : 'primary'}
        isDisabled={done || !ready}
        onPress={() => void recordTransfer(label, destPref, amount)}
        style={{ fontSize: 13 }}
      >
        {done ? <Trans>Recorded ✓</Trans> : <Trans>Record transfer</Trans>}
      </Button>
    );
  }

  const amountText = (value: number) => (
    <PrivacyFilter>
      <Text style={{ fontWeight: 600, fontSize: 14 }}>
        {format(value, 'financial')}
      </Text>
    </PrivacyFilter>
  );

  return (
    <Page header={t('Payday')}>
      <View style={{ maxWidth: 700, paddingBottom: 40 }}>
        {/* Source bank */}
        <View style={{ ...row, marginTop: 15 }}>
          <AccountSelect
            prefKey="payday-from-account"
            accounts={bankAccounts}
            label={t('Transfers come from:')}
          />
        </View>

        {/* Income */}
        <Text style={sectionTitle}>
          <Trans>Income received this month</Trans>
        </Text>
        <View style={row}>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 20, fontWeight: 600 }}>
            <PrivacyFilter>{format(income, 'financial')}</PrivacyFilter>
          </Text>
        </View>

        {/* Rent */}
        <Text style={sectionTitle}>
          <Trans>Rent</Trans>
        </Text>
        <View style={row}>
          <Text style={{ flex: 1 }}>
            <Trans>Planned amount (click to edit)</Trans>
          </Text>
          <PlanAmount
            prefKey="payday-plan-rent"
            onChangeStored={setRentStored}
          />
        </View>

        {/* Family */}
        <Text style={sectionTitle}>
          <Trans>Family obligations</Trans>
        </Text>
        {family.length === 0 && (
          <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
            <Trans>
              No accounts tagged — use "Add to recap" on an account page.
            </Trans>
          </Text>
        )}
        {family.map(o => (
          <View key={o.accountId} style={row}>
            <Text style={{ flex: 1 }}>
              {o.name}
              {o.payDate && (
                <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                  {'  '}due {o.payDate.slice(5).replace('-', '/')}
                </Text>
              )}
            </Text>
            {amountText(o.due)}
          </View>
        ))}
        <View style={{ ...row, borderTop: `1px solid ${theme.tableBorder}` }}>
          <AccountSelect
            prefKey="payday-dest-family"
            accounts={bankAccounts}
            label={t('park in:')}
          />
          <View style={{ flex: 1 }} />
          {amountText(familyTotal)}
          <TransferButton
            label="family"
            destPref="payday-dest-family"
            amount={familyTotal}
          />
        </View>

        {/* Personal */}
        <Text style={sectionTitle}>
          <Trans>Personal obligations</Trans>
        </Text>
        {personal.map(o => (
          <View key={o.accountId} style={row}>
            <Text style={{ flex: 1 }}>
              {o.name}
              {o.payDate && (
                <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                  {'  '}due {o.payDate.slice(5).replace('-', '/')}
                </Text>
              )}
            </Text>
            {amountText(o.due)}
          </View>
        ))}
        <View style={{ ...row, borderTop: `1px solid ${theme.tableBorder}` }}>
          <AccountSelect
            prefKey="payday-dest-personal"
            accounts={bankAccounts}
            label={t('park in:')}
          />
          <View style={{ flex: 1 }} />
          {amountText(personalTotal)}
          <TransferButton
            label="personal"
            destPref="payday-dest-personal"
            amount={personalTotal}
          />
        </View>

        {/* Remaining */}
        <Text style={sectionTitle}>
          <Trans>Remaining after obligations</Trans>
        </Text>
        <View style={row}>
          <View style={{ flex: 1 }} />
          <Text
            style={{
              fontSize: 20,
              fontWeight: 600,
              color:
                remaining < 0 ? theme.numberNegative : theme.numberPositive,
            }}
          >
            <PrivacyFilter>{format(remaining, 'financial')}</PrivacyFilter>
          </Text>
        </View>

        {/* Savings buckets */}
        <Text style={sectionTitle}>
          <Trans>Savings buckets</Trans>
        </Text>
        {savingsCategories.length === 0 ? (
          <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
            <Trans>
              No "Savings" category group found — create one (or rename yours)
              and its categories appear here.
            </Trans>
          </Text>
        ) : (
          savingsCategories.map(c => (
            <View key={c.id} style={row}>
              <Text style={{ flex: 1 }}>{c.name}</Text>
              <PlanAmount prefKey={`payday-plan-${c.id}`} />
            </View>
          ))
        )}
        <View style={{ ...row, borderTop: `1px solid ${theme.tableBorder}` }}>
          <Text style={{ flex: 1, fontWeight: 600 }}>
            <Trans>Unallocated</Trans>
          </Text>
          <Text
            style={{
              fontWeight: 600,
              color:
                unallocated < 0 ? theme.numberNegative : theme.numberPositive,
            }}
          >
            <PrivacyFilter>{format(unallocated, 'financial')}</PrivacyFilter>
          </Text>
        </View>
        <Text
          style={{ color: theme.pageTextSubdued, fontSize: 12, marginTop: 5 }}
        >
          <Trans>
            Buckets follow the "Savings" category group — add or remove
            categories there and this list updates.
          </Trans>
        </Text>
      </View>
    </Page>
  );
}
