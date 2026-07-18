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
  slug: string;
  featured?: boolean;
}

export interface ProductItem {
  title: string;
  image: string;
}

export interface ClientLogo {
  name: string;
  image: string;
}

export interface SocialLink {
  name: string;
  url: string;
  icon: 'facebook' | 'instagram';
}

export const navLinks: NavLink[] = [
  { label: 'HOME', href: '#home' },
  { label: 'SERVICES', href: '#services' },
  { label: 'PRODUCTS', href: '#products' },
  { label: 'ABOUT US', href: '/about' },
  { label: 'CONTACT US', href: '/contact' },
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
    slug: 'pc-laptop-repair',
  },
  {
    title: 'Custom PC Builds',
    description: 'High-performance custom builds tailored to gaming, work, or creative needs.',
    icon: 'build',
    slug: 'custom-pc-builds',
  },
  {
    title: 'Printer Sales & Repair',
    description: 'Quality printers, supplies, and professional repair for home and office.',
    icon: 'printer',
    slug: 'printer-sales-repair',
  },
  {
    title: 'Web Development',
    description: 'Custom websites and web applications that help your business grow online.',
    icon: 'web',
    slug: 'web-development',
    featured: true,
  },
  {
    title: 'Tech Support',
    description: 'Reliable IT support, troubleshooting, and maintenance when you need it most.',
    icon: 'support',
    slug: 'tech-support',
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

export const clients: ClientLogo[] = [
  { name: '3BMA', image: '/images/our%20clients/3bmaLogo.png' },
  { name: 'Bagama', image: '/images/our%20clients/bagamalogo.jpg' },
  { name: 'Car Expert', image: '/images/our%20clients/car-expertlogo.jpeg' },
  { name: 'Northprime', image: '/images/our%20clients/northprime-ventures-corp-logo.png' },
  { name: 'PJG', image: '/images/our%20clients/pjg%20logo.jpg' },
  { name: 'STS Catering', image: '/images/our%20clients/sts-catering.jpg' },
  { name: 'Vikings Pawnshop', image: '/images/our%20clients/vikings%20pawnshop.jpg' },
];

export const footerInfo = {
  address:
    'Corner Nori St. Mabini Extension, Cabanatuan City, Philippines - In Front of Science High School',
  hours: {
    weekdays: 'Monday - Saturday',
    weekdayTime: '7:30 AM - 7:00 PM',
  },
  phoneStatus: 'Coming Soon',
  social: [
    {
      name: 'Facebook',
      url: 'https://web.facebook.com/PCmazing',
      icon: 'facebook',
    },
    {
      name: 'Instagram',
      url: 'https://www.instagram.com/pcmazing/',
      icon: 'instagram',
    },
  ] satisfies SocialLink[],
};
