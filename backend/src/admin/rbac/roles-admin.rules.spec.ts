import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertCanMutateRole, assertSoftDeleteAllowed } from './roles-admin.rules';

describe('roles-admin.rules', () => {
  it('blocks system role mutations', () => {
    expect(() =>
      assertCanMutateRole({ isSystem: true, deletedAt: null }, 'update'),
    ).toThrow(ForbiddenException);
  });

  it('blocks deleted role mutations', () => {
    expect(() =>
      assertCanMutateRole({ isSystem: false, deletedAt: new Date() }, 'update'),
    ).toThrow(BadRequestException);
  });

  it('allows normal role update', () => {
    expect(() =>
      assertCanMutateRole({ isSystem: false, deletedAt: null }, 'update'),
    ).not.toThrow();
  });

  it('blocks soft delete with assignees', () => {
    expect(() => assertSoftDeleteAllowed(2)).toThrow(BadRequestException);
  });

  it('allows soft delete with zero assignees', () => {
    expect(() => assertSoftDeleteAllowed(0)).not.toThrow();
  });
});
