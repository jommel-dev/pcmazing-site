import { hasPermission, slugifyRoleName, isKnownPermissionKey } from './permission.util';
import { PERMISSION_CATALOG, allPermissionKeys } from './permission-catalog';

describe('permission.util', () => {
  it('slugifyRoleName', () => {
    expect(slugifyRoleName('Sales Manager')).toBe('sales_manager');
  });

  it('hasPermission all wildcard', () => {
    expect(hasPermission('all', 'quotation.view')).toBe(true);
    expect(hasPermission(['*'], 'quotation.create')).toBe(true);
  });

  it('hasPermission requires every key when array', () => {
    expect(hasPermission(['quotation.view'], ['quotation.view', 'quotation.create'])).toBe(false);
    expect(hasPermission(['quotation.view', 'quotation.create'], ['quotation.view'])).toBe(true);
  });

  it('catalog includes module view keys', () => {
    const keys = allPermissionKeys();
    expect(keys).toContain('settings.view');
    expect(keys).toContain('settings.roles.manage');
    expect(keys).toContain('time_clock.view');
    expect(keys).toContain('printing_generator.view');
    expect(isKnownPermissionKey('not.a.real.key')).toBe(false);
  });

  it('catalog is non-empty grouped', () => {
    expect(PERMISSION_CATALOG.length).toBeGreaterThan(5);
  });
});
