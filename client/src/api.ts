import type { Coffee, Order } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listCoffees: (all = false) => fetch(`/api/coffees${all ? '?all=1' : ''}`).then(res => json<Coffee[]>(res)),
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
  placeOrder: (customerName: string, items: { id: string; temp: string; size: string; qty: number }[]) =>
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, items }),
    }).then(res => json<Order>(res)),
  listOrders: () => fetch('/api/orders').then(res => json<Order[]>(res)),
};
