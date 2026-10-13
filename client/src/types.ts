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

export interface AdminReview {
  id: number;
  coffeeId: string;
  coffeeName: string;
  coffeeColor: string;
  rating: number;
  flavorTags: string[];
  createdAt: string;
}
