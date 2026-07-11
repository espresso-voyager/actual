// CUSTOM: per-account currency toggle (¥ ⇄ $). Drives the `usd-account-*`
// pref, which controls the sidebar currency badge, the JPY valuation pill
// (off-budget accounts), and the Net Wealth card's currency bucketing.
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useSyncedPrefs } from '#hooks/useSyncedPrefs';

type CurrencyTagProps = {
  account?: AccountEntity;
};

export function CurrencyTag({ account }: CurrencyTagProps) {
  const { t } = useTranslation();
  const [prefs, savePrefs] = useSyncedPrefs();

  if (!account) {
    return null;
  }

  const isUsd = prefs[`usd-account-${account.id}`] === 'true';

  return (
    <Button
      variant="bare"
      onPress={() =>
        savePrefs({ [`usd-account-${account.id}`]: isUsd ? 'false' : 'true' })
      }
      aria-label={t('Toggle account currency')}
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: theme.pillText,
        backgroundColor: theme.pillBackground,
        borderRadius: 4,
        padding: '2px 6px',
      }}
    >
      {isUsd ? '$' : '¥'}
    </Button>
  );
}
