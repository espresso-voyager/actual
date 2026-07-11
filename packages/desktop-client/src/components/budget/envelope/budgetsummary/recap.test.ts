// CUSTOM: tests for the budget-header recap helpers
import { accountIdsForBucket, findGroupIdByName, owedCents } from './recap';

describe('accountIdsForBucket', () => {
  const accounts = [
    { id: 'mc', closed: false },
    { id: 'kbc', closed: false },
    { id: 'visa', closed: false },
    { id: 'old', closed: true },
  ];
  const prefs = {
    'coverage-group-mc': 'family',
    'coverage-group-kbc': 'family',
    'coverage-group-visa': 'personal',
    'coverage-group-old': 'family',
  };

  it('selects open accounts tagged with the bucket', () => {
    expect(accountIdsForBucket(accounts, prefs, 'family')).toEqual([
      'mc',
      'kbc',
    ]);
    expect(accountIdsForBucket(accounts, prefs, 'personal')).toEqual(['visa']);
  });

  it('excludes closed accounts even when tagged', () => {
    expect(accountIdsForBucket(accounts, prefs, 'family')).not.toContain('old');
  });

  it('returns empty when nothing is tagged', () => {
    expect(accountIdsForBucket(accounts, {}, 'family')).toEqual([]);
  });
});

describe('owedCents', () => {
  it('negates card balances so debt is positive', () => {
    const balances = new Map([
      ['mc', -24_211_500], // owes ¥242,115.00-equivalent stored units
      ['kbc', -2_296_500],
    ]);
    expect(owedCents(['mc', 'kbc'], balances)).toBe(26_508_000);
  });

  it('treats missing accounts as zero and credits reduce the total', () => {
    const balances = new Map([['visa', 5_000]]); // account in credit
    expect(owedCents(['visa', 'nope'], balances)).toBe(-5_000);
  });
});

describe('findGroupIdByName', () => {
  const groups = [
    { id: 'g1', name: 'Family', is_income: false },
    { id: 'g2', name: 'savings', is_income: false },
    { id: 'g3', name: 'Personal', is_income: true },
  ];

  it('matches case-insensitively', () => {
    expect(findGroupIdByName(groups, 'family')).toBe('g1');
    expect(findGroupIdByName(groups, 'Savings')).toBe('g2');
  });

  it('ignores income groups and missing names', () => {
    expect(findGroupIdByName(groups, 'Personal')).toBeUndefined();
    expect(findGroupIdByName(groups, 'Travel')).toBeUndefined();
  });
});
