import { WorkLocationType } from './work-location.util';

export function pickSalaryAmountForLocation(
  expected: WorkLocationType,
  officeSalary: number | null,
  wfhSalary: number | null,
): number | null {
  if (expected === 'off') {
    return null;
  }
  if (expected === 'wfh') {
    if (wfhSalary != null && wfhSalary > 0) {
      return wfhSalary;
    }
    return officeSalary != null && officeSalary > 0 ? officeSalary : null;
  }
  return officeSalary != null && officeSalary > 0 ? officeSalary : null;
}

export function locationPayLabelSuffix(expected: WorkLocationType): string {
  switch (expected) {
    case 'wfh':
      return ' · WFH';
    case 'off':
      return ' · Off (unpaid)';
    default:
      return ' · Office';
  }
}
