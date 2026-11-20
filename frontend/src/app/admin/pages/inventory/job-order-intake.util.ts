export const JO_ACCESSORY_OPTIONS = [
  { value: 'laptop_unit', label: 'Laptop / Unit' },
  { value: 'desktop_pc', label: 'Desktop / PC' },
  { value: 'printers', label: 'Printer(s)' },
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android' },
  { value: 'charger', label: 'Charger / Power Adapter' },
  { value: 'battery', label: 'Battery' },
  { value: 'memory_ram', label: 'Memory (RAM)' },
  { value: 'storage', label: 'Storage (HDD/SSD/NVMe)' },
  { value: 'mouse', label: 'Mouse' },
  { value: 'keyboard', label: 'Keyboard' },
  { value: 'bag_case', label: 'Bag / Case' },
  { value: 'optical_drive', label: 'Optical Drive (DVD/CD)' },
  { value: 'cables', label: 'Cables' },
  { value: 'others', label: 'Others' },
] as const;

export const JO_SERVICE_ARRANGEMENT_OPTIONS = [
  { value: 'in_store', label: 'In-Store (Walk-In)' },
  { value: 'onsite_home', label: 'On-Site – Home (Home Service)' },
  { value: 'onsite_office', label: 'On-Site – Office (Office Service)' },
] as const;

export const JO_DEVICE_TYPE_OPTIONS = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'desktop', label: 'Desktop / PC' },
  { value: 'printer', label: 'Printer' },
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android' },
  { value: 'others', label: 'Others' },
] as const;

/** Matches paper form order: Good, Defective, Minor, Others. */
export const JO_UNIT_CONDITION_OPTIONS = [
  { value: 'good', label: 'Good / Working' },
  { value: 'defective', label: 'Defective / Not Working' },
  { value: 'minor', label: 'Minor Issue' },
  { value: 'others', label: 'Others' },
] as const;

export const JO_FORM_AGREEMENT_TERMS = [
  {
    title: 'Scope of Service',
    text: 'PCmazing will perform only the repair, service, or upgrade approved by the customer.',
  },
  {
    title: 'Estimate and Approval',
    text: 'Any additional work, parts, or charges require customer approval before proceeding.',
  },
  {
    title: 'Data and Backup',
    text: 'Customer should back up important files before service; PCmazing will handle device data responsibly, but data loss may occur during diagnostics or repair.',
  },
  {
    title: 'Parts and Replacement',
    text: 'Replacement parts depend on availability; part type and applicable warranty will be disclosed on the invoice or release document.',
  },
  {
    title: 'Turnaround Time',
    text: 'Completion dates are estimates and may change due to complexity, parts availability, or unforeseen issues; PCmazing will inform the customer of significant changes.',
  },
  {
    title: 'Pre-existing and Hidden Issues',
    text: 'PCmazing is not responsible for unrelated pre-existing defects, but will inform the customer if additional issues are discovered.',
  },
  {
    title: 'Testing and Release',
    text: 'Customer is encouraged to inspect and test the device upon release; report any concern promptly.',
  },
  {
    title: 'Payment and Collection',
    text: 'Any approved charges and payment arrangements will be recorded; the device is released after settlement unless otherwise agreed in writing.',
  },
  {
    title: 'Customer Authorization',
    text: 'Customer confirms authority to submit the device and authorizes the approved diagnostics and work.',
  },
] as const;

export const JO_CONSENT_SOFTWARE_LABEL =
  'I consent to the necessary software installation / updates (e.g., operating system, drivers, and related updates) as required for the repair or proper operation of the device.';

export const JO_CONSENT_BACKUP_LABEL =
  'I acknowledge that I am responsible for backing up my important data (e.g., documents, photos, videos, and other files) before the service.';

export const JO_FORM_LETTERHEAD_FALLBACK = {
  servicesLine: 'PC PARTS | LAPTOP | WEB DEVELOPMENT SERVICES | PRINTER SALES | TECH REPAIR',
  address: '1045 Nori St. Mabini Ext., Cabanatuan City',
  phone: '+63 939 413 3225',
  facebook: '/PCmazing',
  slogan: 'WE BUILD IT BETTER',
} as const;

export function mapJobStatusToFormChecks(status: string): {
  pending: boolean;
  inProgress: boolean;
  forRelease: boolean;
  completed: boolean;
} {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  const completed =
    normalized === 'done' || normalized === 'completed' || normalized === 'complete';
  const forRelease =
    normalized === 'for release' ||
    normalized === 'forrelease' ||
    normalized === 'ready for release';
  const inProgress =
    normalized === 'in progress' ||
    normalized === 'inprogress' ||
    normalized === 'ongoing' ||
    normalized === 'processing';
  const pending =
    !completed &&
    !forRelease &&
    !inProgress &&
    (normalized === 'pending' ||
      normalized === 'new' ||
      normalized === 'open' ||
      normalized === '');

  return {
    pending: pending || (!completed && !forRelease && !inProgress),
    inProgress,
    forRelease,
    completed,
  };
}
