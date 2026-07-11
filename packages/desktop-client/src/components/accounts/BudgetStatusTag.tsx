// CUSTOM: toggles an existing account between on- and off-budget (upstream
// only sets this at creation). Flipping to on-budget makes the account's
// transactions participate in envelope math (uncategorized ones will show as
// needing a category); flipping to off-budget removes them from the budget.
// Sidebar grouping is unaffected — it comes from the section pref.
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useUpdateAccountMutation } from '#accounts';

type BudgetStatusTagProps = {
  account?: AccountEntity;
};

export function BudgetStatusTag({ account }: BudgetStatusTagProps) {
  const { t } = useTranslation();
  const updateAccount = useUpdateAccountMutation();

  if (!account) {
    return null;
  }

  return (
    <Button
      variant="bare"
      onPress={() =>
        updateAccount.mutate({
          account: {
            ...account,
            offbudget: account.offbudget === 1 ? 0 : 1,
          },
        })
      }
      aria-label={t('Toggle on/off budget')}
      style={{ fontSize: 12, color: theme.pageTextSubdued }}
    >
      {account.offbudget === 1 ? t('Off budget') : t('On budget')}
    </Button>
  );
}
