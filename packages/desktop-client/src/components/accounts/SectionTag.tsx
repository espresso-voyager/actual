// CUSTOM: assigns an off-budget account to a named top-level sidebar group
// (e.g. "US accounts"). Free text — typing a new name creates a new group,
// clearing it returns the account to the default "Investments" group. Stored
// as the synced pref `sidebar-section-${accountId}`. Independent of the
// account's currency flag.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { theme } from '@actual-app/components/theme';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useSyncedPrefs } from '#hooks/useSyncedPrefs';

type SectionTagProps = {
  account?: AccountEntity;
};

export function SectionTag({ account }: SectionTagProps) {
  const { t } = useTranslation();
  const [prefs, savePrefs] = useSyncedPrefs();
  const [editing, setEditing] = useState(false);

  if (!account || account.offbudget !== 1) {
    return null;
  }

  const current = prefs[`sidebar-section-${account.id}`] || '';

  function commit(value: string) {
    if (account) {
      savePrefs({ [`sidebar-section-${account.id}`]: value.trim() });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        defaultValue={current}
        placeholder={t('Section name')}
        autoFocus
        onEnter={value => commit(value)}
        onBlur={e => commit(e.currentTarget.value)}
        style={{ width: 120, fontSize: 12, padding: '1px 4px' }}
      />
    );
  }

  return (
    <Button
      variant="bare"
      onPress={() => setEditing(true)}
      style={{ fontSize: 12, color: theme.pageTextSubdued }}
    >
      {current
        ? t('Section: {{section}}', { section: current })
        : t('Set section')}
    </Button>
  );
}
