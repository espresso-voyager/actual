// CUSTOM: statement-cycle readout + config for card/expense accounts (M2).
// Shows "Due M/D: X · New this cycle: Y" on the account header once the
// account's close day and payment day are configured. The sidebar shows a
// compact "due" line for the same accounts (see sidebar/Accounts.tsx).
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPrefs } from '#hooks/useSyncedPrefs';

import { parseCycleDay, useCycleAmounts } from './useCycleAmounts';

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

type CycleInfoProps = {
  account?: AccountEntity;
};

export function CycleInfo({ account }: CycleInfoProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const [prefs, savePrefs] = useSyncedPrefs();
  const [editing, setEditing] = useState(false);
  const closeDay = parseCycleDay(prefs[`cycle-close-day-${account?.id}`]);
  const payDay = parseCycleDay(prefs[`cycle-pay-day-${account?.id}`]);
  const [closeDraft, setCloseDraft] = useState('');
  const [payDraft, setPayDraft] = useState('');
  const amounts = useCycleAmounts(account?.id, closeDay, payDay);

  if (!account) {
    return null;
  }

  function startEditing() {
    setCloseDraft(closeDay != null ? String(closeDay) : '');
    setPayDraft(payDay != null ? String(payDay) : '');
    setEditing(true);
  }

  function commit() {
    if (!account) {
      return;
    }
    const close = parseCycleDay(closeDraft);
    const pay = parseCycleDay(payDraft);
    savePrefs({
      [`cycle-close-day-${account.id}`]: close != null ? String(close) : '',
      [`cycle-pay-day-${account.id}`]: pay != null ? String(pay) : '',
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          <Trans>Closes day</Trans>
        </Text>
        <Input
          value={closeDraft}
          placeholder="31"
          onChangeValue={setCloseDraft}
          onEnter={commit}
          onEscape={() => setEditing(false)}
          style={{ width: 40, fontSize: 12, padding: '2px 4px' }}
        />
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          <Trans>paid day</Trans>
        </Text>
        <Input
          value={payDraft}
          placeholder="25"
          onChangeValue={setPayDraft}
          onEnter={commit}
          onEscape={() => setEditing(false)}
          style={{ width: 40, fontSize: 12, padding: '2px 4px' }}
        />
        <Button
          variant="bare"
          onPress={commit}
          style={{ fontSize: 12, color: theme.pageTextSubdued }}
        >
          <Trans>Save</Trans>
        </Button>
      </View>
    );
  }

  if (closeDay == null || payDay == null) {
    return (
      <Button
        variant="bare"
        onPress={startEditing}
        style={{ fontSize: 12, color: theme.pageTextSubdued }}
      >
        <Trans>Set cycle</Trans>
      </Button>
    );
  }

  return (
    <Button
      variant="bare"
      onPress={startEditing}
      aria-label={t('Edit statement cycle')}
      style={{
        fontSize: 12,
        color: theme.pillText,
        backgroundColor: theme.pillBackground,
        borderRadius: 4,
        padding: '2px 6px',
      }}
    >
      {amounts == null ? (
        '…'
      ) : (
        <PrivacyFilter>
          <Trans
            values={{
              date: shortDate(amounts.payDate),
              due: format(amounts.due, 'financial'),
              accrual: format(amounts.accrual, 'financial'),
            }}
          >
            Due {'{{date}}'}: {'{{due}}'} · New this cycle: {'{{accrual}}'}
          </Trans>
        </PrivacyFilter>
      )}
    </Button>
  );
}
