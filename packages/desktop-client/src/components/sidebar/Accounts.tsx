import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  // Every open account belongs to exactly one group: its section pref, or a
  // default by budget status ("On budget" / "Investments"). Any account can
  // be moved to any group — by drag-and-drop onto another account or a group
  // header, or via the "Set section" control. "Add group" creates empty
  // groups (persisted in the 'sidebar-groups' pref). Render order:
  // On budget, Investments, then named groups alphabetically.
  // Currency is a separate concern: the usd flag only drives the ¥/$ badge.
  const ON_BUDGET_GROUP = 'On budget';
  const INVESTMENTS_GROUP = 'Investments';
  const [prefs, savePrefs] = useSyncedPrefs();
  const isUsd = (account: AccountEntity) =>
    prefs[`usd-account-${account.id}`] === 'true';
  const badge = (account: AccountEntity) => (isUsd(account) ? '($)' : '(¥)');
  const defaultGroupFor = (account: AccountEntity) =>
    account.offbudget ? INVESTMENTS_GROUP : ON_BUDGET_GROUP;
  const groupFor = (account: AccountEntity) =>
    prefs[`sidebar-section-${account.id}`] || defaultGroupFor(account);

  let storedGroups: string[] = [];
  try {
    const parsed: unknown = JSON.parse(prefs['sidebar-groups'] || '[]');
    if (Array.isArray(parsed)) {
      storedGroups = parsed.filter(g => typeof g === 'string');
    }
  } catch {
    // ignore malformed pref
  }

  let groupLabels: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(prefs['sidebar-group-labels'] || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      groupLabels = parsed as Record<string, string>;
    }
  } catch {
    // ignore malformed pref
  }

  const openAccounts = [...onBudgetAccounts, ...offbudgetAccounts];
  const membersByGroup = new Map<string, AccountEntity[]>();
  const discovered: string[] = [];
  for (const account of openAccounts) {
    const group = groupFor(account);
    if (!membersByGroup.has(group)) {
      discovered.push(group);
    }
    membersByGroup.set(group, [...(membersByGroup.get(group) || []), account]);
  }
  // The 'sidebar-groups' pref is the group ORDER; defaults and any groups
  // discovered from accounts but missing from it are inserted sensibly.
  const orderedNames: string[] = [...new Set(storedGroups)];
  if (!orderedNames.includes(INVESTMENTS_GROUP)) {
    orderedNames.unshift(INVESTMENTS_GROUP);
  }
  if (!orderedNames.includes(ON_BUDGET_GROUP)) {
    orderedNames.unshift(ON_BUDGET_GROUP);
  }
  for (const name of discovered.sort((a, b) => a.localeCompare(b))) {
    if (!orderedNames.includes(name)) {
      orderedNames.push(name);
    }
  }
  const orderedGroups = orderedNames.map(name => ({
    name,
    items: membersByGroup.get(name) || [],
  }));

  const displayName = (name: string) =>
    groupLabels[name] ||
    (name === ON_BUDGET_GROUP
      ? t('On budget')
      : name === INVESTMENTS_GROUP
        ? t('Investments')
        : name);

  // Stable cell key per group membership so balances re-register on change
  const groupKey = (section: string, items: AccountEntity[]) => {
    const raw = section + '|' + items.map(a => a.id).join(',');
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
      h = (h * 33) ^ raw.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  };

  function setAccountGroup(account: AccountEntity, group: string) {
    savePrefs({
      [`sidebar-section-${account.id}`]:
        group === defaultGroupFor(account) ? '' : group,
    });
  }

  function onReorderGroup(
    draggedName: string,
    dropPos: 'top' | 'bottom' | null,
    targetName: string,
  ) {
    if (draggedName === targetName) {
      return;
    }
    const order = orderedNames.filter(n => n !== draggedName);
    const targetIdx = order.indexOf(targetName);
    if (targetIdx === -1) {
      return;
    }
    order.splice(
      dropPos === 'bottom' ? targetIdx + 1 : targetIdx,
      0,
      draggedName,
    );
    savePrefs({ 'sidebar-groups': JSON.stringify(order) });
  }

  function onRenameGroup(name: string, newName: string) {
    if (newName === '' || newName === name) {
      return;
    }
    if (name === ON_BUDGET_GROUP || name === INVESTMENTS_GROUP) {
      // Default groups keep their identity; only the display label changes
      savePrefs({
        'sidebar-group-labels': JSON.stringify({
          ...groupLabels,
          [name]: newName,
        }),
      });
      return;
    }
    // Named groups: true rename — update the order list and every member
    const updates: Record<string, string> = {
      'sidebar-groups': JSON.stringify(
        orderedNames.map(n => (n === name ? newName : n)),
      ),
    };
    for (const account of membersByGroup.get(name) || []) {
      updates[`sidebar-section-${account.id}`] = newName;
    }
    savePrefs(updates);
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
    // CUSTOM: cross-group drops. A dragged group header reorders groups;
    // dropping an account on a group header assigns it to that group;
    // dropping on an account in another group moves it there (plus the
    // usual reorder when budget status matches).
    if (id.startsWith('group:')) {
      if (targetId.startsWith('group:')) {
        onReorderGroup(
          id.slice('group:'.length),
          dropPos,
          targetId.slice('group:'.length),
        );
      }
      return;
    }
    const dragged = accounts.find(a => a.id === id);
    if (!dragged) {
      return;
    }
    if (targetId.startsWith('group:')) {
      setAccountGroup(dragged, targetId.slice('group:'.length));
      return;
    }
    const target = accounts.find(a => a.id === targetId);
    if (target && !target.closed && groupFor(dragged) !== groupFor(target)) {
      setAccountGroup(dragged, groupFor(target));
    }
    if (target && target.offbudget !== dragged.offbudget) {
      // sort order is bucketed by budget status server-side; skip reordering
      return;
    }

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

        {/* CUSTOM: uniform top-level groups (On budget, Investments, then
            named groups). Headers are styled identically — including empty
            groups — and act as drop targets; every account row carries a
            ¥/$ currency badge. */}
        {orderedGroups.map(({ name, items }) => (
          <View key={name}>
            <Account
              name={displayName(name)}
              to={
                name === ON_BUDGET_GROUP
                  ? '/accounts/onbudget'
                  : name === INVESTMENTS_GROUP
                    ? '/accounts/offbudget'
                    : '/accounts'
              }
              query={bindings.accountSetBalance(
                groupKey(name, items),
                items.length > 0 ? items.map(a => a.id) : ['__empty__'],
              )}
              style={{
                fontWeight,
                marginTop: 13,
                marginBottom: 5,
              }}
              titleAccount
              isExactPathMatch={
                name !== ON_BUDGET_GROUP && name !== INVESTMENTS_GROUP
              }
              dropGroupId={`group:${name}`}
              onDrop={onReorder}
              onDragChange={onDragChange}
              onRenameGroup={newName => onRenameGroup(name, newName)}
              balanceTestId={
                name === ON_BUDGET_GROUP
                  ? 'sidebar-on-budget-balance'
                  : name === INVESTMENTS_GROUP
                    ? 'sidebar-off-budget-balance'
                    : `sidebar-group-${name}-balance`
              }
            />
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
