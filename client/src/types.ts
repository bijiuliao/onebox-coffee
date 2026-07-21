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
  items: OrderLine[];
  total: number;
  orderType: OrderType;
  deliveryFee: number;
  deliveryDistanceKm: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
}

export interface DeliveryQuote {
  distanceKm: number;
  fee: number;
  deliverable: boolean;
  maxKm: number;
}
