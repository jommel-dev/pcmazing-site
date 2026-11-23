import type { Request } from 'express';
import { EmployeeWorkspaceController } from './employee-workspace.controller';
import { EmployeeWorkspaceService } from './employee-workspace.service';

describe('EmployeeWorkspaceController payslip PDF', () => {
  const createController = () => {
    const workspaceService = {
      assertSalesWorkspaceAccess: jest.fn(),
      getPayslipPdf: jest.fn().mockResolvedValue({
        filename: 'payslip.pdf',
        buffer: Buffer.from('pdf'),
      }),
    };
    const controller = new EmployeeWorkspaceController(
      workspaceService as unknown as EmployeeWorkspaceService,
      {} as never,
    );
    const request = {
      user: {
        sub: 7,
        username: 'sales',
        fullName: 'Sales',
        email: null,
        role: 'sales',
        roleId: null,
        source: 'pcmazing_admin_users' as const,
      },
    } as unknown as Request & {
      user: {
        sub: number;
        username: string;
        fullName: string;
        email: string | null;
        role: string;
        roleId: number | null;
        source: 'pcmazing_admin_users';
      };
    };
    return { controller, request, workspaceService };
  };

  it('excludes remarks by default', async () => {
    const { controller, request, workspaceService } = createController();

    await controller.payslipPdf(request, 12);

    expect(workspaceService.getPayslipPdf).toHaveBeenCalledWith(
      7,
      'pcmazing_admin_users',
      12,
      false,
    );
  });

  it('includes remarks only for a true query value', async () => {
    const { controller, request, workspaceService } = createController();

    await controller.payslipPdf(request, 12, undefined, 'true');

    expect(workspaceService.getPayslipPdf).toHaveBeenCalledWith(
      7,
      'pcmazing_admin_users',
      12,
      true,
    );
  });
});
