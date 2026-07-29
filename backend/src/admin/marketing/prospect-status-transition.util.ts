export const TERMINAL_PROSPECT_STATUSES = ['contract_signed', 'closed_lost'] as const;

export const VALID_PROSPECT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  available: ['picked_up'],
  picked_up: [
    'follow_up',
    'called',
    'texted',
    'emailed',
    'met',
    'meeting_set',
    'closed_lost',
    'return_to_available',
  ],
  called: ['follow_up', 'meeting_set', 'closed_lost', 'return_to_available'],
  texted: ['follow_up', 'meeting_set', 'closed_lost', 'return_to_available'],
  emailed: ['follow_up', 'meeting_set', 'closed_lost', 'return_to_available'],
  met: ['follow_up', 'meeting_set', 'closed_lost', 'return_to_available'],
  no_response: ['follow_up', 'meeting_set', 'closed_lost', 'return_to_available'],
  meeting_set: ['closed_won', 'closed_lost', 'no_response', 'pending_decision'],
  closed_won: ['contract_under_review', 'contract_signed'],
  contract_under_review: ['contract_signed'],
  contract_signed: [],
  closed_lost: [],
};

export function isTerminalProspectStatus(status: string): boolean {
  return (TERMINAL_PROSPECT_STATUSES as readonly string[]).includes(status);
}

export function assertValidProspectStatusTransition(currentStatus: string, nextStatus: string): void {
  if (currentStatus === nextStatus) {
    return;
  }

  if (isTerminalProspectStatus(currentStatus)) {
    throw new Error(`Cannot transition from terminal status "${currentStatus}".`);
  }

  const allowed = VALID_PROSPECT_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Invalid status transition from "${currentStatus}" to "${nextStatus}". Allowed: ${allowed.join(', ') || 'none'}.`,
    );
  }
}
