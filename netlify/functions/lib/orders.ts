export interface OrderRow {
  id: number;
  created_at: string;
  customer_name: string;
  customer_email: string;
  items: unknown;
  total: number;
  order_type: string;
  delivery_fee: number;
  delivery_distance_km: number | null;
  customer_lat: number | null;
  customer_lng: number | null;
  fulfilled: boolean;
  paid: boolean;
}

export function toOrderJson(r: OrderRow) {
  return {
    id: r.id,
    createdAt: r.created_at,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
    total: r.total,
    orderType: r.order_type,
    deliveryFee: r.delivery_fee,
    deliveryDistanceKm: r.delivery_distance_km,
    customerLat: r.customer_lat,
    customerLng: r.customer_lng,
    fulfilled: r.fulfilled,
    paid: r.paid,
  };
}
