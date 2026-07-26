export const PROSPECT_IMPORT_TEMPLATE_CSV = [
  'client_name,company,email,phone,address,client_type,currency,proposed_price_deal,notes',
  'Juan Dela Cruz,ABC Trading,juan@example.com,09171234567,"123 Main St, Manila",local,PHP,150000,Sample local prospect',
  'Jane Smith,Global Corp,jane@example.com,+1-555-0100,"New York, USA",international,USD,5000,Sample international prospect',
].join('\n');

export function downloadProspectImportTemplate(): void {
  const blob = new Blob([PROSPECT_IMPORT_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'client-prospects-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}
