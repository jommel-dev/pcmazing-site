import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type RoleMutationTarget = {
  isSystem: boolean;
  deletedAt: Date | string | null;
};

export function assertCanMutateRole(
  role: RoleMutationTarget | null | undefined,
  action: 'update' | 'deactivate' | 'soft_delete' | 'permissions',
): void {
  if (!role) {
    throw new BadRequestException('Role was not found.');
  }
  if (role.deletedAt) {
    throw new BadRequestException('Role has already been deleted.');
  }
  if (role.isSystem) {
    throw new ForbiddenException(`System roles cannot be modified (${action}).`);
  }
}

export function assertSoftDeleteAllowed(assigneeCount: number): void {
  if (assigneeCount > 0) {
    throw new BadRequestException(
      `Cannot soft delete this role while ${assigneeCount} user(s) are still assigned. Reassign them first.`,
    );
  }
}
