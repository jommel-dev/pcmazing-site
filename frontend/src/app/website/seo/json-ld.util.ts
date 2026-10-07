import { footerInfo } from '../data/site.data';
import { normalizeSiteOrigin, toAbsoluteUrl } from './seo-url.util';
import { DEFAULT_OG_IMAGE_PATH } from './website-seo.data';

export function buildLocalBusinessJsonLd(origin: string): Record<string, unknown> {
  const base = normalizeSiteOrigin(origin);
  // footerInfo.address: "Corner Nori St. Mabini Extension, Cabanatuan City, Philippines - In Front of Science High School"
  const streetAddress = footerInfo.address.split(', Cabanatuan City')[0];

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'PCmazing',
    url: base,
    logo: toAbsoluteUrl(base, DEFAULT_OG_IMAGE_PATH),
    image: toAbsoluteUrl(base, DEFAULT_OG_IMAGE_PATH),
    telephone: footerInfo.phoneStatus,
    address: {
      '@type': 'PostalAddress',
      streetAddress,
      addressLocality: 'Cabanatuan City',
      addressCountry: 'PH',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '07:30',
        closes: '19:00',
      },
    ],
    sameAs: footerInfo.social.map((s) => s.url),
  };
}
