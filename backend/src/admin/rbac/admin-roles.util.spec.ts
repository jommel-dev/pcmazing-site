import {
  isOperationsManager,
  isSalesRestrictedInventory,
  rolesMatch,
} from './admin-roles.util';

describe('admin-roles.util rolesMatch', () => {
  it('treats Assistant Manager as operations manager, not sales-restricted', () => {
    expect(isOperationsManager('Assistant Manager')).toBe(true);
    expect(isSalesRestrictedInventory('Assistant Manager')).toBe(false);
  });

  it('allows Assistant Manager for required sales role', () => {
    expect(rolesMatch('Assistant Manager', 'sales')).toBe(true);
    expect(rolesMatch('Manager', 'sales')).toBe(true);
  });

  it('allows Sales Manager for required sales role', () => {
    expect(rolesMatch('Sales Manager', 'sales')).toBe(true);
    expect(rolesMatch('sales', 'sales')).toBe(true);
  });

  it('rejects marketing for required sales role', () => {
    expect(rolesMatch('Marketing', 'sales')).toBe(false);
  });
});
