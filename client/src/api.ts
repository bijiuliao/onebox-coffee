import type { AdminReview, Coffee, Customer, DeliveryQuote, ItemKind, LeaderboardEntry, LoffeelabsBeansResponse, MemberLevel, Order, OrderType, ReviewSummary, Settings, Special } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listCoffees: (all = false) => fetch(`/api/coffees${all ? '?all=1' : ''}`).then(res => json<Coffee[]>(res)),
  listArchivedCoffees: () => fetch('/api/coffees?archived=1').then(res => json<Coffee[]>(res)),
  getCoffee: (id: string) => fetch(`/api/coffees/${id}`).then(res => json<Coffee>(res)),
  createCoffee: (name: string) =>
    fetch('/api/coffees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(res => json<Coffee>(res)),
  updateCoffee: (id: string, patch: Partial<Coffee>) =>
    fetch(`/api/coffees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(res => json<Coffee>(res)),
  uploadCover: (id: string, file: File) => {
    const form = new FormData();
    form.append('cover', file);
    return fetch(`/api/coffees/${id}/cover`, { method: 'POST', body: form }).then(res => json<Coffee>(res));
  },
  extractBean: (url: string) =>
    fetch('/api/extract-bean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then(res => json<Partial<Coffee>>(res)),
  listLoffeelabsBeans: (page: number, roaster: string) =>
    fetch(`/api/admin/loffeelabs-beans?page=${page}&roaster=${encodeURIComponent(roaster)}`).then(res => json<LoffeelabsBeansResponse>(res)),

  listSpecials: (all = false) => fetch(`/api/specials${all ? '?all=1' : ''}`).then(res => json<Special[]>(res)),
  createSpecial: (name: string) =>
    fetch('/api/specials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(res => json<Special>(res)),
  updateSpecial: (id: string, patch: Partial<Special>) =>
    fetch(`/api/specials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(res => json<Special>(res)),
  uploadSpecialCover: (id: string, file: File) => {
    const form = new FormData();
    form.append('cover', file);
    return fetch(`/api/specials/${id}/cover`, { method: 'POST', body: form }).then(res => json<Special>(res));
  },

  placeOrder: (order: {
    customerName: string;
    customerEmail: string;
    orderType: OrderType;
    items: { kind: ItemKind; id: string; temp?: string; size?: string; bagLabel?: string; qty: number }[];
    lat?: number;
    lng?: number;
  }) =>
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    }).then(res => json<Order>(res)),
  listOrders: () => fetch('/api/orders').then(res => json<Order[]>(res)),
  lookupOrder: (id: number, email: string) =>
    fetch(`/api/orders/${id}?email=${encodeURIComponent(email)}`).then(res => json<Order>(res)),
  setOrderFulfilled: (id: number, fulfilled: boolean) =>
    fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfilled }),
    }).then(res => json<{ id: number; fulfilled: boolean; paid: boolean }>(res)),
  setOrderPaid: (id: number, paid: boolean) =>
    fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid }),
    }).then(res => json<{ id: number; fulfilled: boolean; paid: boolean }>(res)),
  deleteOrder: (id: number) =>
    fetch(`/api/orders/${id}`, { method: 'DELETE' }).then(res => json<{ id: number; deleted: boolean }>(res)),
  listCustomers: () => fetch('/api/customers').then(res => json<Customer[]>(res)),
  getLeaderboard: () => fetch('/api/leaderboard').then(res => json<LeaderboardEntry[]>(res)),
  getMemberLevel: (email: string) => fetch(`/api/member-level?email=${encodeURIComponent(email)}`).then(res => json<MemberLevel>(res)),
  getDeliveryQuote: (lat: number, lng: number) =>
    fetch('/api/delivery-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    }).then(res => json<DeliveryQuote>(res)),

  getReviewSummary: (coffeeId: string) =>
    fetch(`/api/coffees/${coffeeId}/reviews`).then(res => json<ReviewSummary>(res)),
  submitReview: (coffeeId: string, rating: number, flavorTags: string[]) =>
    fetch(`/api/coffees/${coffeeId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, flavorTags }),
    }).then(res => json<ReviewSummary>(res)),
  listAdminReviews: () => fetch('/api/admin/reviews').then(res => json<AdminReview[]>(res)),
  sendTestEmail: () =>
    fetch('/api/admin/test-email', { method: 'POST' }).then(res => json<{ ok: true; sentTo: string }>(res)),
  notifyCustomerNewBean: (email: string, coffeeId: string) =>
    fetch('/api/admin/notify-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, coffeeId }),
    }).then(res => json<{ ok: true }>(res)),
  notifyNewBeans: (coffeeIds: string[], recipientEmails: string[]) =>
    fetch('/api/admin/notify-beans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coffeeIds, recipientEmails }),
    }).then(res => json<{ ok: true; beanCount: number; recipientCount: number; sent: number; failed: number }>(res)),
  listBeanCustomers: () => fetch('/api/admin/notify-beans').then(res => json<{ email: string; name: string }[]>(res)),
  deleteAdminReview: (id: number) =>
    fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' }).then(res => json<{ ok: true }>(res)),

  getSettings: () => fetch('/api/settings').then(res => json<Settings>(res)),
  updateSettings: (patch: Partial<Settings>) =>
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(res => json<Settings>(res)),
};
