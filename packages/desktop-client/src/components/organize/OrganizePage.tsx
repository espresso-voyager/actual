// CUSTOM: "Categories & Tags" — one page managing both, side by side.
// Left pane: category groups and categories with inline rename, add, and
// delete (deletes reuse upstream's safe flows, including the transfer modal
// when a category has transactions). Right pane: upstream's tag manager.
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import {
  useCreateCategoryGroupMutation,
  useCreateCategoryMutation,
  useDeleteCategoryGroupMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryGroupMutation,
  useUpdateCategoryMutation,
} from '#budget/mutations';
import { Page } from '#components/Page';
import { ManageTags } from '#components/tags/ManageTags';
import { useCategories } from '#hooks/useCategories';

function InlineName({
  name,
  bold,
  onRename,
}: {
  name: string;
  bold?: boolean;
  onRename: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <Input
        defaultValue={name}
        autoFocus
        onEnter={raw => {
          const value = raw.trim();
          if (value && value !== name) {
            onRename(value);
          }
          setEditing(false);
        }}
        onBlur={e => {
          const value = e.currentTarget.value.trim();
          if (value && value !== name) {
            onRename(value);
          }
          setEditing(false);
        }}
        onEscape={() => setEditing(false)}
        style={{ fontSize: 13, width: 180 }}
      />
    );
  }
  return (
    <Button
      variant="bare"
      onPress={() => setEditing(true)}
      style={{
        fontSize: 13,
        fontWeight: bold ? 600 : 400,
        justifyContent: 'flex-start',
      }}
    >
      {name}
    </Button>
  );
}

function AddInline({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  if (adding) {
    return (
      <Input
        placeholder={placeholder}
        autoFocus
        onEnter={raw => {
          const value = raw.trim();
          if (value) {
            onAdd(value);
          }
          setAdding(false);
        }}
        onBlur={() => setAdding(false)}
        onEscape={() => setAdding(false)}
        style={{ fontSize: 13, width: 180, marginLeft: 15 }}
      />
    );
  }
  return (
    <Button
      variant="bare"
      onPress={() => setAdding(true)}
      style={{
        fontSize: 12,
        color: theme.pageTextSubdued,
        justifyContent: 'flex-start',
        marginLeft: 15,
      }}
    >
      + {placeholder}
    </Button>
  );
}

function CategoriesPane() {
  const { t } = useTranslation();
  const { data: { grouped: groups } = { grouped: [] } } = useCategories();
  const createCategory = useCreateCategoryMutation();
  const updateCategory = useUpdateCategoryMutation();
  const deleteCategory = useDeleteCategoryMutation();
  const createGroup = useCreateCategoryGroupMutation();
  const updateGroup = useUpdateCategoryGroupMutation();
  const deleteGroup = useDeleteCategoryGroupMutation();

  const expenseGroups = groups.filter(g => !g.is_income);

  function renameCategory(category: CategoryEntity, name: string) {
    updateCategory.mutate({ category: { ...category, name } });
  }
  function renameGroup(group: CategoryGroupEntity, name: string) {
    updateGroup.mutate({ group: { ...group, name } });
  }

  return (
    <View style={{ flex: 1, minWidth: 300 }}>
      <Text style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
        <Trans>Categories</Trans>
      </Text>
      {expenseGroups.map(group => (
        <View key={group.id} style={{ marginBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              borderBottom: `1px solid ${theme.tableBorder}`,
              paddingBottom: 2,
            }}
          >
            <InlineName
              name={group.name}
              bold
              onRename={name => renameGroup(group, name)}
            />
            <View style={{ flex: 1 }} />
            <Button
              variant="bare"
              aria-label={t('Delete group')}
              onPress={() => deleteGroup.mutate({ id: group.id })}
              style={{ fontSize: 12, color: theme.pageTextSubdued }}
            >
              ×
            </Button>
          </View>
          {(group.categories ?? []).map(category => (
            <View
              key={category.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                marginLeft: 15,
              }}
            >
              <InlineName
                name={category.name}
                onRename={name => renameCategory(category, name)}
              />
              <View style={{ flex: 1 }} />
              <Button
                variant="bare"
                aria-label={t('Delete category')}
                onPress={() => deleteCategory.mutate({ id: category.id })}
                style={{ fontSize: 12, color: theme.pageTextSubdued }}
              >
                ×
              </Button>
            </View>
          ))}
          <AddInline
            placeholder={t('Add category')}
            onAdd={name =>
              createCategory.mutate({
                name,
                groupId: group.id,
                isIncome: false,
                isHidden: false,
              })
            }
          />
        </View>
      ))}
      <AddInline
        placeholder={t('Add group')}
        onAdd={name => createGroup.mutate({ name })}
      />
    </View>
  );
}

export function OrganizePage() {
  const { t } = useTranslation();
  return (
    <Page header={t('Categories & Tags')}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 40,
          marginTop: 15,
          paddingBottom: 40,
          alignItems: 'flex-start',
        }}
      >
        <CategoriesPane />
        <View style={{ flex: 2, minWidth: 400 }}>
          <Text style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
            <Trans>Tags</Trans>
          </Text>
          <ManageTags />
        </View>
      </View>
    </Page>
  );
}
