export type Temp = '熱' | '冰';
export type Size = '標準' | '大杯';
export type OrderType = '自取' | '外送';

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
}

export interface OrderLine {
  id: string;
  name: string;
  temp: string;
  size: string;
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
