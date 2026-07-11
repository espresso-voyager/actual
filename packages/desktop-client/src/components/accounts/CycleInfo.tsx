// CUSTOM: statement-cycle readout + config for card/expense accounts (M2).
// Shows "Due M/D: X · New this cycle: Y" on the account header once the
// account's close day and payment day are configured. The sidebar shows the
// same numbers compactly (see sidebar/Accounts.tsx).
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Select } from '@actual-app/components/select';
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

// 31 doubles as "end of month": lastCloseDate clamps it to short months
const CLOSE_OPTIONS: Array<[string, string]> = [
  ['31', 'End of month'],
  ...Array.from({ length: 30 }, (_, i): [string, string] => [
    String(i + 1),
    String(i + 1),
  ]),
];

const PAY_OPTIONS: Array<[string, string]> = Array.from(
  { length: 31 },
  (_, i): [string, string] => [String(i + 1), String(i + 1)],
);

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
  const [closeDraft, setCloseDraft] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState<string | null>(null);
  const amounts = useCycleAmounts(account?.id, closeDay, payDay);

  if (!account) {
    return null;
  }

  function startEditing() {
    setCloseDraft(closeDay != null ? String(closeDay) : null);
    setPayDraft(payDay != null ? String(payDay) : null);
    setEditing(true);
  }

  function commit(close: string | null, pay: string | null) {
    if (!account) {
      return;
    }
    // Save only once BOTH are chosen; a half-filled form stays open
    if (parseCycleDay(close ?? undefined) == null) {
      return;
    }
    if (parseCycleDay(pay ?? undefined) == null) {
      return;
    }
    savePrefs({
      [`cycle-close-day-${account.id}`]: close!,
      [`cycle-pay-day-${account.id}`]: pay!,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          <Trans>Statement closes:</Trans>
        </Text>
        <Select
          options={CLOSE_OPTIONS}
          value={closeDraft ?? ''}
          defaultLabel={t('Choose…')}
          onChange={value => {
            setCloseDraft(value);
            commit(value, payDraft);
          }}
          style={{ width: 110 }}
        />
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          <Trans>debited on the next day</Trans>
        </Text>
        <Select
          options={PAY_OPTIONS}
          value={payDraft ?? ''}
          defaultLabel={t('Choose…')}
          onChange={value => {
            setPayDraft(value);
            commit(closeDraft, value);
          }}
          style={{ width: 60 }}
        />
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          <Trans>after the close (rolls into the next month by itself)</Trans>
        </Text>
        <Button
          variant="bare"
          onPress={() => setEditing(false)}
          style={{ fontSize: 12, color: theme.pageTextSubdued }}
        >
          <Trans>Cancel</Trans>
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

  const closeLabel =
    closeDay === 31 ? t('end of month') : t('day {{day}}', { day: closeDay });

  return (
    <Button
      variant="bare"
      onPress={startEditing}
      aria-label={t(
        'Closes {{close}}, debited on the {{pay}} — click to edit',
        {
          close: closeLabel,
          pay: payDay,
        },
      )}
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
