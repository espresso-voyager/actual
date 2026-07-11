// CUSTOM: dual-currency net wealth card (Reports page).
// Sums current balances of all open accounts, bucketed by the per-account
// currency flag (unflagged = JPY-native, `usd-account-*` = USD-native), and
// shows the combined net wealth in BOTH currencies at the shared USD/JPY
// rate. Snapshot valuation only — no ledger math, no stored widgets, and
// deliberately not the historical net-worth graph (that would need
// historical rates).
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { q } from '@actual-app/core/shared/query';

import {
  computeNetWealth,
  formatJpy,
  parseRate,
} from '#components/accounts/fxUsdJpy';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useAccounts } from '#hooks/useAccounts';
import { useSyncedPrefs } from '#hooks/useSyncedPrefs';
import { aqlQuery } from '#queries/aqlQuery';

function formatUsd(usdCents: number): string {
  const sign = usdCents < 0 ? '-' : '';
  const abs = Math.abs(usdCents);
  return `${sign}$${(abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function NetWealthCard() {
  const { t } = useTranslation();
  const { data: accounts = [] } = useAccounts();
  const [prefs] = useSyncedPrefs();
  const [balances, setBalances] = useState<Map<string, number> | null>(null);

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

  const rate = parseRate(prefs['fx-usdjpy-rate']);
  const rateSource = prefs['fx-usdjpy-source'];

  let jpyStored = 0;
  let usdCents = 0;
  if (balances) {
    for (const account of accounts) {
      if (account.closed) {
        continue;
      }
      const cents = balances.get(account.id) ?? 0;
      if (prefs[`usd-account-${account.id}`] === 'true') {
        usdCents += cents;
      } else {
        jpyStored += cents;
      }
    }
  }

  const totals =
    rate != null ? computeNetWealth(jpyStored, usdCents, rate) : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 15,
        backgroundColor: theme.tableBackground,
        borderRadius: 2,
        padding: '15px 20px',
        marginBottom: 10,
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: 600 }}>
        <Trans>Net wealth</Trans>
      </Text>
      {balances == null ? (
        <Text style={{ color: theme.pageTextSubdued }}>…</Text>
      ) : totals != null ? (
        <>
          <PrivacyFilter>
            <Text style={{ fontSize: 22, fontWeight: 500 }}>
              ≈ {formatJpy(totals.yen)}
            </Text>
          </PrivacyFilter>
          <PrivacyFilter>
            <Text style={{ fontSize: 22, fontWeight: 500 }}>
              ≈ {formatUsd(totals.usdCents)}
            </Text>
          </PrivacyFilter>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            @ {rate} · {rateSource || t('manual')}
          </Text>
        </>
      ) : (
        <>
          <PrivacyFilter>
            <Text style={{ fontSize: 22, fontWeight: 500 }}>
              {formatJpy(Math.round(jpyStored / 100))}
            </Text>
          </PrivacyFilter>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>
              Set a USD/JPY rate (open a USD account) to see combined totals
            </Trans>
          </Text>
        </>
      )}
    </View>
  );
}
