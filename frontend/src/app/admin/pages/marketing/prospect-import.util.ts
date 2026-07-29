export const PROSPECT_IMPORT_TEMPLATE_CSV = [
  'client_name,company,email,phone,address,client_type,currency,proposed_price_deal,notes',
  'Juan Dela Cruz,ABC Trading,juan@example.com,09171234567,"123 Main St, Manila",local,PHP,150000,Needs desktop upgrade for accounting team',
  'Maria Santos,Luzon Retail,maria.santos@example.com,09181230001,"45 Aurora Blvd, Quezon City",local,PHP,98000,Interested in bundled workstation package',
  'Paolo Reyes,Northwind Cafe,paolo.reyes@example.com,09181230002,"18 Session Rd, Baguio",local,PHP,72000,Requested POS and back office setup',
  'Angela Cruz,BrightKids Learning Center,angela.cruz@example.com,09181230003,"9 Rizal Ave, Naga",local,PHP,125000,Looking for lab computers before school opening',
  'Dennis Lim,VisMin Logistics,dennis.lim@example.com,09181230004,"220 J P Rizal St, Davao",local,PHP,210000,Needs fleet tracking dashboard terminals',
  'Carla Mendoza,GreenFields Farm Supply,carla.mendoza@example.com,09181230005,"77 San Jose Rd, Tarlac",local,PHP,86000,Prefers staggered delivery schedule',
  'Rico Navarro,MetroBuild Services,rico.navarro@example.com,09181230006,"312 MacArthur Hwy, Valenzuela",local,PHP,174500,Asked for quotation with warranty extension',
  'Sheena Villanueva,Pacific Homeware,sheena.v@example.com,09181230007,"14 Osmena St, Cebu City",local,PHP,133000,Needs showroom display PCs',
  'Miguel Tan,Sunrise Diagnostics,miguel.tan@example.com,09181230008,"28 Mabini St, Iloilo City",local,PHP,265000,Considering full clinic front desk rollout',
  'Trisha Flores,Harborline Travel,trisha.flores@example.com,09181230009,"66 Roxas Blvd, Pasay",local,PHP,117500,Follow up after branch manager approval',
  'Jane Smith,Global Corp,jane.smith@example.com,+1-555-0100,"New York, USA",international,USD,5000,Sample international prospect for overseas office',
  'Oliver Bennett,Westbridge Consulting,oliver.bennett@example.com,+44-20-7946-0101,"London, United Kingdom",international,GBP,4200,Needs remote setup for hybrid team',
  'Yuki Nakamura,Sakura Systems,yuki.nakamura@example.com,+81-3-4500-1200,"Tokyo, Japan",international,JPY,880000,Evaluating pilot deployment for support center',
  'Amelia Clarke,Southern Cross Media,amelia.clarke@example.com,+61-2-8012-4455,"Sydney, Australia",international,AUD,7600,Interested in editing workstation bundle',
  'Liam Wong,Pearl River Imports,liam.wong@example.com,+852-3008-2211,"Hong Kong",international,HKD,41000,Needs multilingual support options',
  'Noah Chen,Maple Commerce,noah.chen@example.com,+1-416-555-0142,"Toronto, Canada",international,CAD,6900,Waiting for procurement sign off',
  'Sofia Dubois,EuroVista Design,sofia.dubois@example.com,+33-1-84-88-2200,"Paris, France",international,EUR,5400,Asked for design studio performance specs',
  'Ethan Rahman,Gulf Horizon Tech,ethan.rahman@example.com,+971-4-555-7788,"Dubai, UAE",international,AED,19500,Needs invoice in company legal name',
  'Layla Al Saud,Desert Star Holdings,layla.alsaud@example.com,+966-11-555-4100,"Riyadh, Saudi Arabia",international,SAR,23000,Requested premium support terms',
  'Wei Zhang,Orient Bridge Trading,wei.zhang@example.com,+86-21-5550-9900,"Shanghai, China",international,CNY,38000,Interested in regional reseller pricing',
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
