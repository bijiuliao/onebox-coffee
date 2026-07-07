import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Coffee, Size, Temp } from './types';

export interface CartLine {
  coffeeId: string;
  name: string;
  color: string;
  basePrice: number;
  temp: Temp;
  size: Size;
  qty: number;
}

export function priceOf(basePrice: number, size: Size) {
  return basePrice + (size === '大杯' ? 20 : 0);
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  addLine: (coffee: Coffee, temp: Temp, size: Size, qty: number) => void;
  inc: (index: number) => void;
  dec: (index: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'onebox-cart';

function loadLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadLines);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((a, l) => a + l.qty, 0),
    total: lines.reduce((a, l) => a + priceOf(l.basePrice, l.size) * l.qty, 0),
    addLine: (coffee, temp, size, qty) => {
      setLines(prev => {
        const i = prev.findIndex(l => l.coffeeId === coffee.id && l.temp === temp && l.size === size);
        if (i >= 0) {
          const next = prev.slice();
          next[i] = { ...next[i], qty: next[i].qty + qty };
          return next;
        }
        return [...prev, { coffeeId: coffee.id, name: coffee.name, color: coffee.color, basePrice: coffee.price, temp, size, qty }];
      });
    },
    inc: (index) => setLines(prev => prev.map((l, i) => i === index ? { ...l, qty: l.qty + 1 } : l)),
    dec: (index) => setLines(prev => {
      const line = prev[index];
      if (line.qty <= 1) return prev.filter((_, i) => i !== index);
      return prev.map((l, i) => i === index ? { ...l, qty: l.qty - 1 } : l);
    }),
    clear: () => setLines([]),
  }), [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
