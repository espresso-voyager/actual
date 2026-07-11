import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useMoveAccountMutation } from '#accounts';
import { isAccountFailedSync } from '#accounts/syncStatus';
import { useAccounts } from '#hooks/useAccounts';
import { useClosedAccounts } from '#hooks/useClosedAccounts';
import { useLocalPref } from '#hooks/useLocalPref';
import { useOffBudgetAccounts } from '#hooks/useOffBudgetAccounts';
import { useOnBudgetAccounts } from '#hooks/useOnBudgetAccounts';
import { useSyncedPrefs } from '#hooks/useSyncedPrefs';
import { useUpdatedAccounts } from '#hooks/useUpdatedAccounts';
import { useSelector } from '#redux';
import * as bindings from '#spreadsheet/bindings';

import { Account } from './Account';
import { SecondaryItem } from './SecondaryItem';

const fontWeight = 600;

export function Accounts() {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const { data: accounts = [] } = useAccounts();
  const updatedAccounts = useUpdatedAccounts();
  const { data: offbudgetAccounts = [] } = useOffBudgetAccounts();
  const { data: onBudgetAccounts = [] } = useOnBudgetAccounts();
  const { data: closedAccounts = [] } = useClosedAccounts();
  const syncingAccountIds = useSelector(state => state.account.accountsSyncing);
  // CUSTOM: sidebar sections + currency badges for Investments accounts
  const [prefs] = useSyncedPrefs();
  const isUsd = (account: AccountEntity) =>
    prefs[`usd-account-${account.id}`] === 'true';
  const sectionFor = (account: AccountEntity) =>
    prefs[`sidebar-section-${account.id}`] ||
    (isUsd(account) ? t('US accounts') : '');
  const investmentSections: Array<{ section: string; items: AccountEntity[] }> =
    [];
  for (const account of offbudgetAccounts) {
    const section = sectionFor(account);
    const existing = investmentSections.find(s => s.section === section);
    if (existing) {
      existing.items.push(account);
    } else {
      investmentSections.push({ section, items: [account] });
    }
  }
  // Unsectioned accounts list first, directly under the Investments header
  investmentSections.sort((a, b) =>
    a.section === '' ? -1 : b.section === '' ? 1 : 0,
  );

  const getAccountPath = (account: AccountEntity) => `/accounts/${account.id}`;

  const [showClosedAccounts, setShowClosedAccountsPref] = useLocalPref(
    'ui.showClosedAccounts',
  );

  function onDragChange(drag: { state: string }) {
    setIsDragging(drag.state === 'start');
  }

  const moveAccount = useMoveAccountMutation();

  const makeDropPadding = (i: number) => {
    if (i === 0) {
      return {
        paddingTop: isDragging ? 15 : 0,
        marginTop: isDragging ? -15 : 0,
      };
    }
    return undefined;
  };

  async function onReorder(
    id: string,
    dropPos: 'top' | 'bottom' | null,
    targetId: string,
  ) {
    let targetIdToMove: string | null = targetId;
    if (dropPos === 'bottom') {
      const idx = accounts.findIndex(a => a.id === targetId) + 1;
      targetIdToMove = idx < accounts.length ? accounts[idx].id : null;
    }

    moveAccount.mutate({ id, targetId: targetIdToMove });
  }

  const onToggleClosedAccounts = () => {
    setShowClosedAccountsPref(!showClosedAccounts);
  };

  return (
    <View
      style={{
        flexGrow: 1,
        '@media screen and (max-height: 480px)': {
          minHeight: 'auto',
        },
      }}
    >
      <View
        style={{
          height: 1,
          backgroundColor: theme.sidebarItemBackgroundHover,
          marginTop: 15,
          flexShrink: 0,
        }}
      />

      <View style={{ overflow: 'auto' }}>
        <Account
          name={t('All accounts')}
          to="/accounts"
          query={bindings.allAccountBalance()}
          style={{ fontWeight, marginTop: 15 }}
          isExactPathMatch
          balanceTestId="sidebar-all-accounts-balance"
        />

        {onBudgetAccounts.length > 0 && (
          <Account
            name={t('On budget')}
            to="/accounts/onbudget"
            query={bindings.onBudgetAccountBalance()}
            style={{
              fontWeight,
              marginTop: 13,
              marginBottom: 5,
            }}
            titleAccount
            balanceTestId="sidebar-on-budget-balance"
          />
        )}

        {onBudgetAccounts.map((account, i) => (
          <Account
            key={account.id}
            name={account.name}
            account={account}
            connected={!!account.bank}
            pending={syncingAccountIds.includes(account.id)}
            failed={isAccountFailedSync(account)}
            updated={updatedAccounts.includes(account.id)}
            to={getAccountPath(account)}
            query={bindings.accountBalance(account.id)}
            onDragChange={onDragChange}
            onDrop={onReorder}
            outerStyle={makeDropPadding(i)}
          />
        ))}

        {offbudgetAccounts.length > 0 && (
          <Account
            name={t('Investments')}
            to="/accounts/offbudget"
            query={bindings.offBudgetAccountBalance()}
            style={{
              fontWeight,
              marginTop: 13,
              marginBottom: 5,
            }}
            titleAccount
            balanceTestId="sidebar-off-budget-balance"
          />
        )}

        {/* CUSTOM: Investments accounts grouped into named sections, with a
            ¥/$ currency badge per account */}
        {investmentSections.map(({ section, items }) => (
          <View key={section || '__unsectioned__'}>
            {section !== '' && (
              <View style={{ marginTop: 8, marginBottom: 2, marginLeft: 20 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: theme.sidebarItemText,
                    opacity: 0.7,
                  }}
                >
                  {section}
                </Text>
              </View>
            )}
            {items.map((account, i) => (
              <Account
                key={account.id}
                name={`${account.name} ${isUsd(account) ? '($)' : '(¥)'}`}
                account={account}
                connected={!!account.bank}
                pending={syncingAccountIds.includes(account.id)}
                failed={isAccountFailedSync(account)}
                updated={updatedAccounts.includes(account.id)}
                to={getAccountPath(account)}
                query={bindings.accountBalance(account.id)}
                onDragChange={onDragChange}
                onDrop={onReorder}
                outerStyle={makeDropPadding(i)}
              />
            ))}
          </View>
        ))}

        {closedAccounts.length > 0 && (
          <SecondaryItem
            style={{ marginTop: 15 }}
            title={
              showClosedAccounts
                ? t('Closed accounts')
                : t('Closed accounts...')
            }
            onClick={onToggleClosedAccounts}
            bold
          />
        )}

        {showClosedAccounts &&
          closedAccounts.map(account => (
            <Account
              key={account.id}
              name={account.name}
              account={account}
              to={getAccountPath(account)}
              query={bindings.accountBalance(account.id)}
              onDragChange={onDragChange}
              onDrop={onReorder}
            />
          ))}
      </View>
    </View>
  );
}
