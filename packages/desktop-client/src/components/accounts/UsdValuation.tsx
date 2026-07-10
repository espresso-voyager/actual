// CUSTOM: JPY valuation for USD off-budget accounts (M3).
// Display-layer only: the account stores native USD amounts; this widget
// shows the JPY equivalent of the current balance at a USD→JPY rate kept
// in synced prefs. The rate can be typed in manually (works fully offline)
// or refreshed from the free frankfurter.dev API.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgClose, SvgRefresh } from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { Query } from '@actual-app/core/shared/query';
import type { AccountEntity } from '@actual-app/core/types/models';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPrefs } from '#hooks/useSyncedPrefs';
import type { Binding } from '#spreadsheet';

import { computeJpyEquivalent, formatJpy, parseRate } from './fxUsdJpy';

const FX_API_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY';

type UsdValuationProps = {
  account?: AccountEntity;
  balanceQuery: { name: `balance-query-${string}`; query: Query };
};

export function UsdValuation({ account, balanceQuery }: UsdValuationProps) {
  const { t } = useTranslation();
  const [prefs, savePrefs] = useSyncedPrefs();
  const [rateText, setRateText] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  const balance = useSheetValue<'balance', `balance-query-${string}`>({
    ...balanceQuery,
    value: 0,
  } as Binding<'balance', `balance-query-${string}`>);

  // Off-budget accounts only; budgeted accounts stay JPY-native.
  if (!account || account.offbudget !== 1) {
    return null;
  }

  const enabled = prefs[`usd-account-${account.id}`] === 'true';
  const savedRate = parseRate(prefs['fx-usdjpy-rate']);
  const rateSource = prefs['fx-usdjpy-source'];

  if (!enabled) {
    return (
      <Button
        variant="bare"
        onPress={() => savePrefs({ [`usd-account-${account.id}`]: 'true' })}
        style={{ color: theme.pageTextSubdued, fontSize: 12 }}
      >
        Show ¥
      </Button>
    );
  }

  function commitRate(text: string) {
    const rate = parseRate(text);
    if (rate != null) {
      savePrefs({
        'fx-usdjpy-rate': String(rate),
        'fx-usdjpy-source': 'manual',
      });
      setFetchFailed(false);
    }
    setRateText(null);
  }

  async function fetchRate() {
    setFetching(true);
    setFetchFailed(false);
    try {
      const res = await fetch(FX_API_URL);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const rate = parseRate(String(data?.rates?.JPY));
      if (rate == null) {
        throw new Error('no JPY rate in response');
      }
      savePrefs({
        'fx-usdjpy-rate': String(rate),
        'fx-usdjpy-source': `api ${data.date || ''}`.trim(),
      });
    } catch {
      // Offline or API down: keep the last-known/manual rate untouched.
      setFetchFailed(true);
    } finally {
      setFetching(false);
    }
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 4,
        padding: '4px 6px',
        color: theme.pillText,
        backgroundColor: theme.pillBackground,
      }}
    >
      <Text>
        ≈{' '}
        <PrivacyFilter>
          <Text style={{ fontWeight: 600 }}>
            {savedRate != null && balance != null
              ? formatJpy(computeJpyEquivalent(balance, savedRate))
              : '¥ —'}
          </Text>
        </PrivacyFilter>
      </Text>
      <Text style={{ color: theme.pageTextSubdued }}>@</Text>
      <Input
        value={rateText ?? (savedRate != null ? String(savedRate) : '')}
        placeholder="rate"
        onChangeValue={setRateText}
        onBlur={() => rateText != null && commitRate(rateText)}
        onEnter={() => rateText != null && commitRate(rateText)}
        style={{ width: 60, fontSize: 12, padding: '1px 4px' }}
      />
      <Button
        variant="bare"
        isDisabled={fetching}
        onPress={fetchRate}
        aria-label={t('Fetch latest USD/JPY rate')}
      >
        <SvgRefresh style={{ width: 11, height: 11 }} />
      </Button>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 11 }}>
        {fetching
          ? 'fetching…'
          : fetchFailed
            ? 'offline — using saved rate'
            : rateSource || 'manual'}
      </Text>
      <Button
        variant="bare"
        onPress={() => savePrefs({ [`usd-account-${account.id}`]: 'false' })}
        aria-label={t('Hide JPY valuation')}
      >
        <SvgClose style={{ width: 9, height: 9 }} />
      </Button>
    </View>
  );
}
