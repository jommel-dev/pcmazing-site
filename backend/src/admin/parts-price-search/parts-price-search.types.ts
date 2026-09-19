export type PartsPriceHit = {
  sourceId: string;
  sourceLabel: string;
  title: string;
  pricePhp: number;
  currency: 'PHP';
  url: string;
  imageUrl?: string | null;
  inStock?: boolean | null;
};

export type PartsPriceSourceError = {
  sourceId: string;
  sourceLabel: string;
  message: string;
};

export type PartsPriceSearchResult = {
  query: string;
  items: PartsPriceHit[];
  sourceErrors: PartsPriceSourceError[];
};

export interface PartsPriceSearchAdapter {
  readonly id: string;
  readonly label: string;
  search(query: string, limit: number): Promise<PartsPriceHit[]>;
}
