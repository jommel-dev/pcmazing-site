export interface NavLink {
  label: string;
  href: string;
}

export interface HeroFeature {
  label: string;
  description: string;
  icon: 'responsive' | 'seo' | 'secure' | 'support';
}

export interface ServiceItem {
  title: string;
  description: string;
  icon: 'repair' | 'build' | 'printer' | 'web' | 'support';
  featured?: boolean;
}

export interface ProductItem {
  title: string;
  image: string;
}

export const navLinks: NavLink[] = [
  { label: 'HOME', href: '#home' },
  { label: 'SERVICES', href: '#services' },
  { label: 'PRODUCTS', href: '#products' },
  { label: 'STUDY HUB', href: '#study-hub' },
  { label: 'ABOUT US', href: '#about' },
  { label: 'CONTACT US', href: '#contact' },
];

export const heroFeatures: HeroFeature[] = [
  {
    label: 'Responsive Design',
    description: 'Mobile & desktop friendly',
    icon: 'responsive',
  },
  {
    label: 'SEO Friendly',
    description: 'Built to rank on search engines',
    icon: 'seo',
  },
  {
    label: 'Secure & Reliable',
    description: 'Your data is always protected',
    icon: 'secure',
  },
  {
    label: 'Support Guaranteed',
    description: 'Here for you every step',
    icon: 'support',
  },
];

export const services: ServiceItem[] = [
  {
    title: 'PC & Laptop Repair',
    description: 'Expert diagnostics and repair for desktops, laptops, and all major brands.',
    icon: 'repair',
  },
  {
    title: 'Custom PC Builds',
    description: 'High-performance custom builds tailored to gaming, work, or creative needs.',
    icon: 'build',
  },
  {
    title: 'Printer Sales & Repair',
    description: 'Quality printers, supplies, and professional repair for home and office.',
    icon: 'printer',
  },
  {
    title: 'Web Development',
    description: 'Custom websites and web applications that help your business grow online.',
    icon: 'web',
    featured: true,
  },
  {
    title: 'Tech Support',
    description: 'Reliable IT support, troubleshooting, and maintenance when you need it most.',
    icon: 'support',
  },
];

export const products: ProductItem[] = [
  { title: 'Processors', image: '/images/website/products/processors.svg' },
  { title: 'Motherboards', image: '/images/website/products/motherboards.svg' },
  { title: 'Graphics Cards', image: '/images/website/products/graphics-cards.svg' },
  { title: 'Laptops', image: '/images/website/products/laptops.svg' },
  { title: 'Monitors', image: '/images/website/products/monitors.svg' },
  { title: 'Accessories', image: '/images/website/products/accessories.svg' },
];

export const footerInfo = {
  address: {
    line1: 'Purok 3, #32 Nori St.',
    line2: 'Cabanatuan City',
  },
  hours: {
    weekdays: 'Monday - Saturday',
    weekdayTime: '7:30 AM - 7:00 PM',
    sunday: 'Sunday',
    sundayTime: 'CLOSED',
  },
  phones: ['(044) 463-1234', '(0917) 123-4567'],
  social: {
    facebook: 'https://facebook.com/pcmazing',
    website: 'www.pcmazing.com',
  },
};
