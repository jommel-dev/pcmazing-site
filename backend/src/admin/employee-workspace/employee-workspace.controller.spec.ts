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
    );
    const request = {
      user: { sub: 7, source: 'pcmazing_admin_users', role: 'sales' },
    } as unknown as Request & {
      user: {
        sub: number;
        source: 'pcmazing_admin_users';
        role: string;
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
