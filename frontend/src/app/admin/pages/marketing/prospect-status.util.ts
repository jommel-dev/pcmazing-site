export const MAX_PROSPECT_FOLLOW_UPS = 3;

export const FOLLOW_UP_METHODS = [
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meet', label: 'Meet' },
] as const;

export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  picked_up: 'In Progress',
  called: 'Called',
  texted: 'Texted',
  emailed: 'Emailed',
  met: 'Met',
  no_response: 'No Response',
  meeting_set: 'Meeting Set',
  closed_won: 'Close Won',
  contract_under_review: 'Contract Under Review',
  contract_signed: 'Contract Signed',
  closed_lost: 'Close Lost',
};

export const PROSPECT_STATUS_TABS = [
  '',
  'available',
  'picked_up',
  'called',
  'texted',
  'emailed',
  'met',
  'meeting_set',
  'no_response',
  'closed_won',
  'contract_under_review',
  'contract_signed',
  'closed_lost',
] as const;

export const PROSPECT_UPDATE_STATUSES = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'meeting_set', label: 'Meeting Scheduled' },
] as const;

export const PROSPECT_AFTER_FOLLOW_UP_STATUSES = [
  { value: 'closed_lost', label: 'Loss (close permanently)' },
  { value: 'return_to_available', label: 'Return to Available (with remarks)' },
] as const;

export const PROSPECT_MEETING_OUTCOME_STATUSES = [
  { value: 'closed_won', label: 'Win' },
  { value: 'closed_lost', label: 'Loss' },
  { value: 'no_response', label: 'No Response (did not show / no reply)' },
  { value: 'pending_decision', label: 'Pending Decision (resume follow-ups)' },
] as const;

export const PROSPECT_POST_WIN_STATUSES = [
  { value: 'contract_under_review', label: 'Contract Under Review' },
  { value: 'contract_signed', label: 'Contract Signed' },
] as const;

function normalizeRoleKey(role?: string | null): string {
  return (role?.trim().toLowerCase() ?? '').replace(/[\s_-]+/g, '');
}

export function hasSuperAdminAccess(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }

  if (['superadmin', 'superadministrator'].includes(key)) {
    return true;
  }

  return key.includes('super') && key.includes('admin');
}

export function hasAdminMeetingOutcomeAccess(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }

  if (['admin', 'administrator', 'superadmin', 'superadministrator', 'businessowner'].includes(key)) {
    return true;
  }

  return key.includes('super') && key.includes('admin');
}

export function isFollowUpIncrementStatus(status: string): boolean {
  return status === 'follow_up';
}

export function followUpMethodLabel(method: string): string {
  return FOLLOW_UP_METHODS.find((item) => item.value === method)?.label ?? method;
}

export function hasReachedFollowUpLimit(count: number, max = MAX_PROSPECT_FOLLOW_UPS): boolean {
  return count >= max;
}

export function followUpsRemaining(count: number, max = MAX_PROSPECT_FOLLOW_UPS): number {
  return Math.max(0, max - count);
}

export function buildProgressStatusOptions(followUpCount: number, maxFollowUps: number): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [...PROSPECT_UPDATE_STATUSES];
  if (hasReachedFollowUpLimit(followUpCount, maxFollowUps)) {
    options.push(...PROSPECT_AFTER_FOLLOW_UP_STATUSES);
  }
  return options;
}

export function prospectStatusLabel(status: string): string {
  return PROSPECT_STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function prospectStatusClass(status: string): string {
  const base = 'inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap leading-tight';
  if (status === 'available') return `${base} bg-blue-50 text-blue-700`;
  if (status === 'picked_up') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'called') return `${base} bg-indigo-50 text-indigo-700`;
  if (status === 'texted') return `${base} bg-sky-50 text-sky-700`;
  if (status === 'emailed') return `${base} bg-violet-50 text-violet-700`;
  if (status === 'met') return `${base} bg-teal-50 text-teal-700`;
  if (status === 'meeting_set') return `${base} bg-emerald-50 text-emerald-700`;
  if (status === 'closed_won') return `${base} bg-green-50 text-green-700`;
  if (status === 'contract_under_review') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'contract_signed') return `${base} bg-cyan-50 text-cyan-700`;
  if (status === 'closed_lost') return `${base} bg-red-50 text-red-700`;
  if (status === 'no_response') return `${base} bg-slate-100 text-slate-600`;
  return `${base} bg-slate-100 text-slate-600`;
}

export function isAvailableProspect(status: string): boolean {
  return status === 'available';
}

export function isClosedProspect(status: string): boolean {
  return status === 'closed_won' || status === 'contract_under_review' || status === 'contract_signed' || status === 'closed_lost';
}

export function isInProgressProspect(status: string): boolean {
  return !isAvailableProspect(status) && !isClosedProspect(status) && !isAwaitingMeetingOutcome(status);
}

export function canEditProspectDetails(status: string, userRole?: string | null): boolean {
  if (isAvailableProspect(status) || isInProgressProspect(status)) {
    return true;
  }
  if (status === 'closed_won' && hasSuperAdminAccess(userRole)) {
    return true;
  }
  return false;
}

export function isAwaitingMeetingOutcome(status: string): boolean {
  return status === 'meeting_set';
}

export function canUpdateProspect(status: string, userRole?: string | null): boolean {
  if (isAvailableProspect(status) || status === 'contract_signed' || status === 'closed_lost') {
    return false;
  }

  if (status === 'closed_won' || status === 'contract_under_review') {
    return hasAdminMeetingOutcomeAccess(userRole);
  }

  if (isAwaitingMeetingOutcome(status)) {
    return hasAdminMeetingOutcomeAccess(userRole);
  }

  return true;
}

export function followUpProgressLabel(count: number, max: number): string {
  return `${count} / ${max} follow-ups`;
}

export function commissionOutcomeMessage(status: string): string | null {
  if (status === 'closed_won') {
    return 'Close Won — waiting for the signed contract and final contract breakdown.';
  }
  if (status === 'contract_under_review') {
    return 'Contract Under Review — client is reviewing the contract terms.';
  }
  if (status === 'contract_signed') {
    return 'Contract Signed — project details, modules, milestones, and payment schedule are recorded.';
  }
  if (status === 'closed_lost') {
    return 'Close Lost — no commission applies for this prospect.';
  }
  if (status === 'meeting_set') {
    return 'Meeting scheduled — awaiting outcome. Record Win, Loss, No Response, or Pending Decision after the meeting.';
  }
  return null;
}

export function hasPreviousLossRemarks(notes: string | null | undefined): boolean {
  return Boolean(notes?.includes('Returned to pool'));
}

export function formatFollowUpDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}
