import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@actual-app/components/input';
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
  // CUSTOM: sidebar groups are fully decoupled from on/off-budget status.
  // An account's group comes ONLY from its section pref — any account (on- or
  // off-budget) can live in any named group. Unsectioned accounts fall back
  // to "On budget" (budgeted) or "Investments" (off-budget). Groups can also
  // be created empty via "Add group" (stored in the 'sidebar-groups' pref)
  // and render in order: On budget, Investments, then named groups.
  // Currency is a separate concern: the usd flag only drives the ¥/$ badge.
  const [prefs, savePrefs] = useSyncedPrefs();
  const [addingGroup, setAddingGroup] = useState(false);
  const isUsd = (account: AccountEntity) =>
    prefs[`usd-account-${account.id}`] === 'true';
  const badge = (account: AccountEntity) => (isUsd(account) ? '($)' : '(¥)');
  const sectionFor = (account: AccountEntity) =>
    prefs[`sidebar-section-${account.id}`] || '';

  let storedGroups: string[] = [];
  try {
    const parsed: unknown = JSON.parse(prefs['sidebar-groups'] || '[]');
    if (Array.isArray(parsed)) {
      storedGroups = parsed.filter(g => typeof g === 'string');
    }
  } catch {
    // ignore malformed pref
  }

  const namedGroupNames = new Set<string>(storedGroups);
  const sectioned = new Map<string, AccountEntity[]>();
  for (const account of [...onBudgetAccounts, ...offbudgetAccounts]) {
    const section = sectionFor(account);
    if (section !== '') {
      namedGroupNames.add(section);
      sectioned.set(section, [...(sectioned.get(section) || []), account]);
    }
  }
  const unsectionedOnBudget = onBudgetAccounts.filter(
    a => sectionFor(a) === '',
  );
  const unsectionedOffBudget = offbudgetAccounts.filter(
    a => sectionFor(a) === '',
  );
  const namedGroups = [...namedGroupNames]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, items: sectioned.get(name) || [] }));

  // Stable cell key per group membership so balances re-register on change
  const groupKey = (section: string, items: AccountEntity[]) => {
    const raw = section + '|' + items.map(a => a.id).join(',');
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
      h = (h * 33) ^ raw.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  };

  function onAddGroup(name: string) {
    const trimmed = name.trim();
    if (trimmed !== '' && !namedGroupNames.has(trimmed)) {
      savePrefs({
        'sidebar-groups': JSON.stringify([...storedGroups, trimmed]),
      });
    }
    setAddingGroup(false);
  }

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

        {/* CUSTOM: On budget (unsectioned budgeted accounts), Investments
            (unsectioned off-budget), then named groups holding ANY account.
            Every account row carries a ¥/$ currency badge. */}
        {unsectionedOnBudget.length > 0 && (
          <Account
            name={t('On budget')}
            to="/accounts/onbudget"
            query={bindings.accountSetBalance(
              groupKey('__onbudget__', unsectionedOnBudget),
              unsectionedOnBudget.map(a => a.id),
            )}
            style={{
              fontWeight,
              marginTop: 13,
              marginBottom: 5,
            }}
            titleAccount
            balanceTestId="sidebar-on-budget-balance"
          />
        )}

        {unsectionedOnBudget.map((account, i) => (
          <Account
            key={account.id}
            name={`${account.name} ${badge(account)}`}
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

        {unsectionedOffBudget.length > 0 && (
          <Account
            name={t('Investments')}
            to="/accounts/offbudget"
            query={bindings.accountSetBalance(
              groupKey('__investments__', unsectionedOffBudget),
              unsectionedOffBudget.map(a => a.id),
            )}
            style={{
              fontWeight,
              marginTop: 13,
              marginBottom: 5,
            }}
            titleAccount
            balanceTestId="sidebar-off-budget-balance"
          />
        )}

        {unsectionedOffBudget.map((account, i) => (
          <Account
            key={account.id}
            name={`${account.name} ${badge(account)}`}
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

        {namedGroups.map(({ name, items }) => (
          <View key={name}>
            {items.length > 0 ? (
              <Account
                name={name}
                to="/accounts"
                query={bindings.accountSetBalance(
                  groupKey(name, items),
                  items.map(a => a.id),
                )}
                style={{
                  fontWeight,
                  marginTop: 13,
                  marginBottom: 5,
                }}
                titleAccount
                isExactPathMatch
                balanceTestId={`sidebar-group-${name}-balance`}
              />
            ) : (
              <View style={{ marginTop: 13, marginBottom: 5, marginLeft: 20 }}>
                <Text style={{ fontWeight, color: theme.sidebarItemText }}>
                  {name}
                </Text>
              </View>
            )}
            {items.map((account, i) => (
              <Account
                key={account.id}
                name={`${account.name} ${badge(account)}`}
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

        {/* CUSTOM: create a new (initially empty) sidebar group */}
        {addingGroup ? (
          <View style={{ margin: '8px 20px 0 20px' }}>
            <Input
              placeholder={t('Group name')}
              autoFocus
              onEnter={value => onAddGroup(value)}
              onBlur={e => onAddGroup(e.currentTarget.value)}
              style={{ fontSize: 13, padding: '2px 6px' }}
            />
          </View>
        ) : (
          <SecondaryItem
            style={{ marginTop: 15 }}
            title={t('Add group')}
            onClick={() => setAddingGroup(true)}
            bold
          />
        )}

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
