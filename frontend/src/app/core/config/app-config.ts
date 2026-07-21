import { ENV } from './env.generated';

export const APP_CONFIG = {
  apiUrl: ENV.API_URL,
  publicSiteUrl: ENV.PUBLIC_SITE_URL,
} as const;
