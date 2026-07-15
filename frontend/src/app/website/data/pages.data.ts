import { ServiceItem } from './site.data';

export interface WebServiceOffering {
  title: string;
  description: string;
  features: string[];
}

export interface ProjectItem {
  title: string;
  description: string;
  category: string;
  tags: string[];
}

export interface ServiceDetail extends ServiceItem {
  slug: string;
  subtitle: string;
  overview: string;
  highlights: string[];
  offerings: string[];
  whyChoose: string[];
}

export const webServiceOfferings: WebServiceOffering[] = [
  {
    title: 'Custom Web Application Development',
    description:
      'Tailored web applications built to match your workflows — from internal tools to customer-facing platforms that scale with your business.',
    features: [
      'Custom dashboards and admin panels',
      'Role-based access and secure authentication',
      'API integrations and third-party connections',
      'Responsive design across all devices',
    ],
  },
  {
    title: 'Business and Online Store Websites',
    description:
      'Professional websites and e-commerce stores that establish your brand online and convert visitors into customers.',
    features: [
      'Modern, mobile-friendly business websites',
      'Online store setup with product catalogs',
      'SEO-ready structure and fast performance',
      'Contact forms, booking, and lead capture',
    ],
  },
  {
    title: 'IT Support Service',
    description:
      'Reliable technical support to keep your systems, websites, and digital tools running smoothly day after day.',
    features: [
      'Website maintenance and updates',
      'Troubleshooting and bug fixes',
      'Hosting and deployment assistance',
      'Ongoing monitoring and technical guidance',
    ],
  },
];

export const projects: ProjectItem[] = [
  {
    title: 'POS',
    description:
      'Point-of-sale system for fast checkout, receipt printing, inventory sync, and daily sales reporting.',
    category: 'Retail & Sales',
    tags: ['POS', 'Sales', 'Inventory'],
  },
  {
    title: 'Car Auto Repair Management',
    description:
      'Workshop management for job orders, customer records, parts tracking, and service history in one system.',
    category: 'Automotive',
    tags: ['Job Orders', 'Customers', 'Workshop'],
  },
  {
    title: 'Catering Service Management',
    description:
      'End-to-end catering operations — events, menus, bookings, billing, and client coordination made simple.',
    category: 'Food & Events',
    tags: ['Events', 'Bookings', 'Billing'],
  },
  {
    title: 'HVAC Warehouse and Sales Management System',
    description:
      'Complete warehouse and sales platform for HVAC materials — stock control, orders, and stakeholder management.',
    category: 'Warehouse & Sales',
    tags: ['HVAC', 'Warehouse', 'Sales Orders'],
  },
  {
    title: 'Materials and Parts Inventory and Sales Management System',
    description:
      'Inventory and sales solution for parts and materials with purchase orders, stock levels, and customer accounts.',
    category: 'Inventory & Sales',
    tags: ['Inventory', 'PO', 'Materials'],
  },
  {
    title: 'Accounting Management',
    description:
      'Financial management with ledgers, invoicing, expense tracking, and reporting for better business decisions.',
    category: 'Finance',
    tags: ['Accounting', 'Invoicing', 'Reports'],
  },
  {
    title: 'HRIS',
    description:
      'Human resource information system for employee records, payroll support, attendance, and HR workflows.',
    category: 'Human Resources',
    tags: ['HR', 'Payroll', 'Employees'],
  },
];

export const serviceDetails: ServiceDetail[] = [
  {
    slug: 'pc-laptop-repair',
    title: 'PC & Laptop Repair',
    subtitle: 'Expert repair for desktops, laptops, and all major brands',
    description: 'Expert diagnostics and repair for desktops, laptops, and all major brands.',
    icon: 'repair',
    overview:
      'PCmazing provides professional PC and laptop repair services for homes, offices, and businesses in Cabanatuan City and nearby areas. From slow performance to hardware failures, our technicians diagnose issues accurately and restore your devices quickly.',
    highlights: [
      'Free initial diagnosis for most devices',
      'Repair for all major laptop and desktop brands',
      'Hardware and software troubleshooting',
      'Fast turnaround with quality parts',
    ],
    offerings: [
      'Screen and keyboard replacement',
      'Battery and charging port repair',
      'Virus removal and system cleanup',
      'SSD/RAM upgrades and data recovery support',
    ],
    whyChoose: [
      'Experienced local technicians you can trust',
      'Transparent pricing before any work begins',
      'Quality components and reliable workmanship',
      'Friendly support at our Cabanatuan location',
    ],
  },
  {
    slug: 'custom-pc-builds',
    title: 'Custom PC Builds',
    subtitle: 'High-performance builds for gaming, work, and creative needs',
    description: 'High-performance custom builds tailored to gaming, work, or creative needs.',
    icon: 'build',
    overview:
      'Whether you need a gaming rig, office workstation, or content creation powerhouse, PCmazing designs and builds custom PCs matched to your budget and performance goals.',
    highlights: [
      'Personalized consultation before every build',
      'Premium and budget-friendly component options',
      'Clean cable management and professional assembly',
      'Performance testing before handover',
    ],
    offerings: [
      'Gaming PC builds',
      'Office and business workstations',
      'Editing and design workstations',
      'Upgrades to existing systems',
    ],
    whyChoose: [
      'Right specs for your exact use case',
      'No unnecessary upselling — honest recommendations',
      'Locally built and supported',
      'Warranty guidance on all major parts',
    ],
  },
  {
    slug: 'printer-sales-repair',
    title: 'Printer Sales & Repair',
    subtitle: 'Quality printers, supplies, and professional repair',
    description: 'Quality printers, supplies, and professional repair for home and office.',
    icon: 'printer',
    overview:
      'PCmazing supplies reliable printers for home and office use, along with ink, toner, and repair services to keep your printing operations running without interruption.',
    highlights: [
      'Printer sales for home and business',
      'Genuine and compatible supplies available',
      'Repair for common printer brands',
      'Setup and network configuration assistance',
    ],
    offerings: [
      'Inkjet and laser printer sales',
      'Ink and toner cartridge supply',
      'Paper jam and print quality fixes',
      'Network and driver setup',
    ],
    whyChoose: [
      'One-stop shop for printers and supplies',
      'Practical advice for the right printer model',
      'Local repair instead of costly replacements',
      'Ongoing support after purchase',
    ],
  },
  {
    slug: 'web-development',
    title: 'Web Development',
    subtitle: 'Custom websites and applications that grow your business',
    description: 'Custom websites and web applications that help your business grow online.',
    icon: 'web',
    featured: true,
    overview:
      'PCmazing builds modern websites and web applications that help businesses establish a strong online presence, streamline operations, and reach more customers.',
    highlights: [
      'Mobile-responsive, professional design',
      'SEO-friendly structure from day one',
      'Secure and reliable hosting guidance',
      'Ongoing support and maintenance available',
    ],
    offerings: [
      'Business and corporate websites',
      'E-commerce and online stores',
      'Custom web applications and dashboards',
      'Landing pages and portfolio sites',
    ],
    whyChoose: [
      'Local team that understands your market',
      'Solutions tailored to your business goals',
      'Modern technology stack and clean code',
      'Long-term partnership, not just a one-time build',
    ],
  },
  {
    slug: 'tech-support',
    title: 'Tech Support',
    subtitle: 'Reliable IT support when you need it most',
    description: 'Reliable IT support, troubleshooting, and maintenance when you need it most.',
    icon: 'support',
    overview:
      'From network issues to software problems, PCmazing offers dependable tech support for individuals and small businesses who need expert help without the enterprise price tag.',
    highlights: [
      'On-site and remote support options',
      'Network and Wi-Fi troubleshooting',
      'Software installation and configuration',
      'Preventive maintenance advice',
    ],
    offerings: [
      'PC and laptop troubleshooting',
      'Internet and router setup',
      'Email and software configuration',
      'Backup and security recommendations',
    ],
    whyChoose: [
      'Patient, clear explanations for non-technical users',
      'Flexible support for homes and small offices',
      'Trusted local provider in Cabanatuan',
      'Honest recommendations — fix, not replace',
    ],
  },
];

export function getServiceBySlug(slug: string): ServiceDetail | undefined {
  return serviceDetails.find((service) => service.slug === slug);
}

export function getServiceRoute(slug: string): string {
  return `/services/${slug}`;
}

export interface AboutValue {
  title: string;
  description: string;
}

export interface AboutHighlight {
  value: string;
  label: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio?: string;
  image?: string;
}

export const aboutContent = {
  story: {
    title: 'Our Story',
    paragraphs: [
      'PCmazing started with a simple goal: make quality technology accessible and dependable for businesses and individuals in Cabanatuan City and beyond.',
      'What began as a local computer shop offering repairs, custom builds, and hardware sales has grown into a full-service tech partner — delivering web development, business systems, and ongoing IT support for clients across multiple industries.',
      'Today, we proudly serve organizations in retail, automotive, catering, warehouse, finance, and HR — building solutions that help them work smarter every day.',
    ],
  },
  mission:
    'To empower businesses and communities with reliable technology — from hardware and repairs to custom software — backed by honest service and local expertise.',
  values: [
    {
      title: 'Quality First',
      description: 'We deliver work we stand behind — whether it is a repaired laptop or a full web application.',
    },
    {
      title: 'Local Partnership',
      description: 'We build long-term relationships with clients in Cabanatuan and nearby areas, not one-off transactions.',
    },
    {
      title: 'Honest Guidance',
      description: 'We recommend what you actually need — clear options, fair pricing, and no unnecessary upselling.',
    },
  ] satisfies AboutValue[],
  team: {
    eyebrow: 'Our Team',
    title: 'Organizational Board Members',
    description:
      'The leadership team guiding PCmazing — committed to quality service, innovation, and strong partnerships with our clients and community.',
    members: [
      {
        name: 'JTech',
        role: 'Founder',
        bio: 'Founded PCmazing in 2026 and has been leading the company ever since.',
      },
      {
        name: 'Jommel Cabiles',
        role: 'CEO (Chief Executive Officer)',
        bio: 'Provides overall leadership and direction for PCmazing’s growth and client partnerships.',
      },
      {
        name: 'Ronald Fernando',
        role: 'COO (Chief Operating Officer)',
        bio: 'Oversees daily operations, service delivery, and business development initiatives.',
      },
      {
        name: 'Justin Roxas',
        role: 'Manager',
        bio: 'Leads the team and ensures smooth operations and client satisfaction.',
      },
      {
        name: 'Lucky Callora',
        role: 'Assistant Manager',
        bio: 'Assists the manager and ensures smooth operations and client satisfaction.',
      },
      {
        name: 'Mark Gill Nacario',
        role: 'Lead Marketing Specialist',
        bio: 'Leads the marketing team and ensures smooth operations and client satisfaction.',
      },
    ] as TeamMember[],
  },
  highlights: [
    { value: '8+', label: 'Trusted Client Partners' },
    { value: '7+', label: 'Business Systems Built' },
    { value: '5', label: 'Core Service Areas' },
    { value: 'Local', label: 'Cabanatuan-Based Team' },
  ] satisfies AboutHighlight[],
  whyChoose: [
    'One team for hardware, software, and web development',
    'Experience across retail, automotive, catering, and enterprise systems',
    'Walk-in store plus project-based development services',
    'Responsive support before, during, and after every project',
  ],
};

export const contactInquiryOptions = [
  'PC & Laptop Repair',
  'Custom PC Builds',
  'Printer Sales & Repair',
  'Web Development',
  'Custom Web Application',
  'Business / Online Store Website',
  'IT Support Service',
  'Tech Support',
  'Other',
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const contactFaqs: FaqItem[] = [
  {
    question: 'How do I request a quote?',
    answer:
      'Fill out the contact form on this page with your name, email, service interest, and project details. Our team will review your inquiry and get back to you as soon as possible.',
  },
  {
    question: 'What are your store hours?',
    answer:
      'We are open Monday to Saturday, 7:30 AM to 7:00 PM. You may visit us at our Cabanatuan location or send us a message online anytime.',
  },
  {
    question: 'Can I walk in without an appointment?',
    answer:
      'Yes. Walk-ins are welcome for PC and laptop repairs, printer concerns, product inquiries, and general tech support during store hours.',
  },
  {
    question: 'Do you work with clients outside Cabanatuan?',
    answer:
      'Yes. While our store is based in Cabanatuan City, we also serve clients for web development, custom applications, and IT support projects in nearby areas and online.',
  },
  {
    question: 'How long does a typical repair take?',
    answer:
      'Repair time depends on the issue and parts availability. Simple software fixes may be done the same day, while hardware repairs can take longer. We provide an estimate after diagnosis.',
  },
  {
    question: 'Do you offer support after a project is completed?',
    answer:
      'Yes. PCmazing provides ongoing maintenance, updates, and technical support for websites, web applications, and IT systems depending on your service agreement.',
  },
  {
    question: 'How soon will I receive a response?',
    answer:
      'We aim to respond to form submissions within 1–2 business days. For urgent walk-in concerns, visiting the store during operating hours is the fastest option.',
  },
];

export const mapsEmbedUrl =
  'https://maps.google.com/maps?q=Corner+Nori+St.+Mabini+Extension,+Cabanatuan+City,+Philippines&output=embed';

export const mapsDirectionsUrl =
  'https://www.google.com/maps/search/?api=1&query=Corner+Nori+St.+Mabini+Extension,+Cabanatuan+City,+Philippines';
