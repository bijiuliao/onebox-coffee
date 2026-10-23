export type Temp = '熱' | '冰';
export type Size = '標準' | '大杯';
export type OrderType = '自取' | '外送';
export type ItemKind = 'drip' | 'beans' | 'special';

export interface BagOption {
  label: string;
  price: number;
}

export interface Coffee {
  id: string;
  name: string;
  originEN: string;
  roast: string;
  level: number;
  notes: string[];
  price: number;
  color: string;
  score: number;
  process: string;
  altitude: string;
  varietal: string;
  harvest: string;
  desc: string;
  roaster: string;
  temps: { hot: boolean; ice: boolean };
  sizes: { std: boolean; large: boolean };
  active: boolean;
  coverUrl: string | null;
  sellsBeans: boolean;
  bagOptions: BagOption[];
  createdAt: string;
  archived: boolean;
  stockQty: number | null;
  // Reference cost-per-gram (NT$), usually auto-filled from a loffeelabs
  // import - used only to suggest a bag-option price when a weight is
  // typed, never affects stock/checkout.
  costPerGramTwd: number | null;
  // Whether the one-time "new bean launched" email has already been
  // decided on (sent or explicitly skipped) for this coffee - used to show
  // the "send launch email?" prompt only the first time it goes active.
  launchNotified: boolean;
}

export interface Special {
  id: string;
  name: string;
  desc: string;
  price: number;
  color: string;
  notes: string[];
  temps: { hot: boolean; ice: boolean };
  active: boolean;
  coverUrl: string | null;
}

export interface OrderLine {
  name: string;
  detail: string;
  qty: number;
  unitPrice: number;
  linePrice: number;
  // Which coffee/special this line is for, and whether it was ordered as
  // drip or beans - lets per-bean sales reporting group lines back to a
  // coffee reliably (name alone isn't stable - a coffee can be renamed).
  // Orders placed before this field existed won't have it.
  itemId?: string;
  kind?: ItemKind;
}

export interface Order {
  id: number;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  items: OrderLine[];
  total: number;
  orderType: OrderType;
  deliveryFee: number;
  deliveryDistanceKm: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  // Whether the order has been handed to the customer - picked up in-store
  // (自取) or delivered (外送). Admin-toggled; defaults false on creation.
  fulfilled: boolean;
  // Whether payment has been confirmed (cash on pickup, bank transfer,
  // etc. - there's no online payment gateway). Independent of fulfilled;
  // admin-toggled, defaults false on creation.
  paid: boolean;
}

// Not a stored record - an aggregate computed from orders sharing the same
// email (see netlify/functions/customers-list.mts). name is whichever
// customer_name was used on that customer's most recent order, since name
// is a free-text field typed per order, not a fixed profile attribute.
export interface Customer {
  email: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
}

// Public top-20 ranking by historical total spend (see
// netlify/functions/leaderboard.mts). name arrives already masked
// server-side (e.g. "王**") - the real name is never sent to the client.
export interface LeaderboardEntry {
  rank: number;
  name: string;
  orderCount: number;
  totalSpent: number;
}

// A bean listing pulled from loffeelabs (see netlify/functions/loffeelabs-beans.mts)
// for the admin to browse and import from - not a onebox record itself.
export interface LoffeelabsBean {
  id: string;
  date: string | null;
  roaster: string | null;
  roastName: string | null;
  link: string | null;
  origin: string | null;
  region: string | null;
  producer: string | null;
  minElev: number | null;
  maxElev: number | null;
  variety: string | null;
  process: string | null;
  tasting: string | null;
  harvest: string | null;
  degree: string | null;
  priceLow: number | null;
  gramLow: number | null;
  priceHigh: number | null;
  gramHigh: number | null;
  roasterCountry: string | null;
}

export interface LoffeelabsBeansResponse {
  beans: LoffeelabsBean[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    tier: string;
    beansExportedToday: number;
    remainingQuota: number;
  } | null;
}

export interface DeliveryQuote {
  distanceKm: number;
  fee: number;
  deliverable: boolean;
  maxKm: number;
}

export interface ReviewSummary {
  count: number;
  avgRating: number;
  tagCounts: Record<string, number>;
}

// Site-wide toggles, independent of any individual coffee's own settings
// (see netlify/functions/settings.mts - a singleton row, not per-coffee).
export interface Settings {
  dripEnabled: boolean;
}

export interface AdminReview {
  id: number;
  coffeeId: string;
  coffeeName: string;
  coffeeColor: string;
  rating: number;
  flavorTags: string[];
  createdAt: string;
}
