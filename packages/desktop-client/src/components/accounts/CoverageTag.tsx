// CUSTOM: tags an account into a budget-header recap bucket (Family /
// Personal). Click cycles: untagged → Family → Personal → untagged. The tag
// is stored as the synced pref `coverage-group-${accountId}` and consumed by
// the RecapList strip on the Budget tab.
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useSyncedPrefs } from '#hooks/useSyncedPrefs';

type CoverageTagProps = {
  account?: AccountEntity;
};

export function CoverageTag({ account }: CoverageTagProps) {
  const { t } = useTranslation();
  const [prefs, savePrefs] = useSyncedPrefs();

  if (!account) {
    return null;
  }

  const current = prefs[`coverage-group-${account.id}`];

  function cycle() {
    if (!account) {
      return;
    }
    const next =
      current === 'family'
        ? 'personal'
        : current === 'personal'
          ? ''
          : 'family';
    savePrefs({ [`coverage-group-${account.id}`]: next });
  }

  return (
    <Button
      variant="bare"
      onPress={cycle}
      style={{
        fontSize: 12,
        color: current ? theme.pillText : theme.pageTextSubdued,
        ...(current && {
          backgroundColor: theme.pillBackground,
          borderRadius: 4,
          padding: '2px 6px',
        }),
      }}
    >
      {current === 'family'
        ? t('Recap: Family')
        : current === 'personal'
          ? t('Recap: Personal')
          : t('Add to recap')}
    </Button>
  );
}
