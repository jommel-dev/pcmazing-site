import { BadRequestException } from '@nestjs/common';
import { ProspectContractDto } from './dto/prospect-contract.dto';

export interface DealContractValidationIssue {
  field: string;
  message: string;
}

export function validateDealContractPayload(contract: ProspectContractDto): DealContractValidationIssue[] {
  const issues: DealContractValidationIssue[] = [];

  if (!contract.projectName?.trim()) {
    issues.push({ field: 'projectName', message: 'Project name is required.' });
  }

  if (!contract.projectType?.trim()) {
    issues.push({ field: 'projectType', message: 'Project type is required.' });
  }

  if (!contract.modules?.length) {
    issues.push({ field: 'modules', message: 'At least one module is required.' });
  } else {
    contract.modules.forEach((module, index) => {
      if (!module.name?.trim()) {
        issues.push({ field: `modules[${index}].name`, message: 'Module name is required.' });
      }
    });
  }

  if (!contract.milestones?.length) {
    issues.push({ field: 'milestones', message: 'At least one milestone is required.' });
  } else {
    contract.milestones.forEach((milestone, index) => {
      if (!milestone.title?.trim()) {
        issues.push({ field: `milestones[${index}].title`, message: 'Milestone title is required.' });
      }
    });
  }

  if (!contract.paymentSchedule?.length) {
    issues.push({ field: 'paymentSchedule', message: 'At least one payment schedule entry is required.' });
  } else {
    contract.paymentSchedule.forEach((payment, index) => {
      if (!payment.label?.trim()) {
        issues.push({ field: `paymentSchedule[${index}].label`, message: 'Payment label is required.' });
      }
      if (payment.amount === undefined || payment.amount === null || payment.amount < 0) {
        issues.push({ field: `paymentSchedule[${index}].amount`, message: 'Payment amount is required.' });
      }
    });
  }

  return issues;
}

export function assertDealContractReadyForSigning(contract: ProspectContractDto): void {
  const issues = validateDealContractPayload(contract);
  if (issues.length > 0) {
    throw new BadRequestException({
      message: 'Contract details are incomplete. All required deal fields must be populated before signing.',
      issues,
    });
  }
}

export function parseLinkedSortOrder(value?: string | null): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function buildModuleCode(index: number, provided?: string | null): string {
  const trimmed = provided?.trim();
  return trimmed || `MOD-${String(index + 1).padStart(3, '0')}`;
}

export function buildMilestoneCode(index: number, provided?: string | null): string {
  const trimmed = provided?.trim();
  return trimmed || `MS-${String(index + 1).padStart(3, '0')}`;
}

export function buildPaymentCode(index: number, provided?: string | null): string {
  const trimmed = provided?.trim();
  return trimmed || `PAY-${String(index + 1).padStart(3, '0')}`;
}
