export const MAX_PROSPECT_FOLLOW_UPS = 3;

export const FOLLOW_UP_METHODS = ['text', 'call', 'email', 'meet'] as const;
export type FollowUpMethod = (typeof FOLLOW_UP_METHODS)[number];

/** Status action that counts as a follow-up attempt. */
export const FOLLOW_UP_INCREMENT_STATUSES = new Set(['follow_up', 'called', 'no_response', 'emailed']);

export function isFollowUpIncrementStatus(status: string): boolean {
  return FOLLOW_UP_INCREMENT_STATUSES.has(status);
}

export function hasReachedFollowUpLimit(count: number): boolean {
  return count >= MAX_PROSPECT_FOLLOW_UPS;
}

export function followUpsRemaining(count: number): number {
  return Math.max(0, MAX_PROSPECT_FOLLOW_UPS - count);
}

export function mapFollowUpMethodToProspectStatus(method: string): string {
  if (method === 'text') {
    return 'texted';
  }
  if (method === 'email') {
    return 'emailed';
  }
  if (method === 'call') {
    return 'called';
  }
  if (method === 'meet') {
    return 'met';
  }
  return 'picked_up';
}

export function followUpMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    text: 'Text',
    call: 'Call',
    email: 'Email',
    meet: 'Meet',
  };
  return labels[method] ?? method;
}
