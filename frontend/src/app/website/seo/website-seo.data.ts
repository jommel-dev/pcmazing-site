import { getServiceBySlug, serviceDetails } from '../data/pages.data';

export type PageSeoMeta = {
  title: string;
  description: string;
  path: string;
  indexable: boolean;
  ogImagePath?: string;
};

export const DEFAULT_OG_IMAGE_PATH = '/images/logopcm.png';

type StaticPageSeo = Omit<PageSeoMeta, 'path' | 'indexable'>;

export const STATIC_PAGE_SEO: Record<string, StaticPageSeo> = {
  '/': {
    title: 'PCmazing Information Technology Services',
    description:
      'PCmazing in Cabanatuan City builds custom web systems and sells, repairs, and supports PCs, laptops, and accessories for homes, schools, and local businesses.',
  },
  '/web-services': {
    title: 'Web Development Services | PCmazing',
    description:
      'Custom web applications, business and online store websites, and ongoing IT support from PCmazing. Practical systems built for Philippine small businesses.',
  },
  '/our-work': {
    title: 'Our Work | PCmazing',
    description:
      'See systems PCmazing has built: POS, HRIS, accounting, inventory, HVAC warehouse, catering, and auto repair management software for growing local companies.',
  },
  '/about': {
    title: 'About Us | PCmazing',
    description:
      'Learn about PCmazing, a Cabanatuan City tech shop and web development team helping local clients with reliable hardware, repairs, and custom software.',
  },
  '/contact': {
    title: 'Contact Us | PCmazing',
    description:
      'Visit PCmazing at Mabini Extension, Cabanatuan City, call 09394133225, or send a message. Open Monday to Saturday, 7:30 AM to 7:00 PM. We reply promptly.',
  },
  '/schedule-demo': {
    title: 'Schedule A Demo | PCmazing',
    description:
      'Book a free demo of PCmazing business systems. Tell us your workflow and we will show how POS, inventory, or HR software can fit your operations.',
  },
  '/leave-a-review': {
    title: 'Leave a Review | PCmazing',
    description:
      'Shared a project or repair with PCmazing? Leave a review and tell other Cabanatuan City customers about your experience with our team and services.',
  },
};

/** Static public paths (excluding `/`) in sitemap order. */
export const STATIC_SITEMAP_PATHS: string[] = Object.keys(STATIC_PAGE_SEO).filter((p) => p !== '/');

/** `/`, static pages, then every `/services/:slug`. For sitemap generation reference. */
export function listIndexableSitemapPaths(): string[] {
  return ['/', ...STATIC_SITEMAP_PATHS, ...serviceDetails.map((s) => `/services/${s.slug}`)];
}

function truncateDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, '')}…`;
}

export function resolvePageSeo(pathname: string): PageSeoMeta {
  const path = pathname.split('?')[0].split('#')[0] || '/';
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

  if (
    normalized === '/setup' ||
    normalized === '/time-clock' ||
    normalized.startsWith('/admin') ||
    normalized.startsWith('/user') ||
    normalized === '/q' ||
    normalized.startsWith('/q/')
  ) {
    return {
      path: normalized,
      title: 'PCmazing',
      description: 'PCmazing internal page.',
      indexable: false,
    };
  }

  const serviceMatch = normalized.match(/^\/services\/([^/]+)$/);
  if (serviceMatch) {
    const service = getServiceBySlug(serviceMatch[1]);
    if (service) {
      return {
        path: normalized,
        title: `${service.title} | PCmazing`,
        description: truncateDescription(`${service.description} ${service.overview}`),
        indexable: true,
      };
    }
    return {
      path: normalized,
      title: 'Service | PCmazing',
      description: 'PCmazing technology services in Cabanatuan City.',
      indexable: false,
    };
  }

  const known = STATIC_PAGE_SEO[normalized];
  if (known) {
    return { path: normalized, indexable: true, ...known };
  }

  // Unknown public paths: do not index.
  return {
    path: normalized,
    title: 'Page Not Found | PCmazing',
    description: 'This page could not be found. Visit PCmazing for web development and tech solutions in Cabanatuan City.',
    indexable: false,
  };
}
