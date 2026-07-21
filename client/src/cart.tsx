import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BagOption, Coffee, ItemKind, Size, Special, Temp } from './types';

interface DripLine {
  kind: 'drip';
  refId: string;
  name: string;
  color: string;
  temp: Temp;
  size: Size;
  basePrice: number;
  qty: number;
}
interface BeansLine {
  kind: 'beans';
  refId: string;
  name: string;
  color: string;
  bagLabel: string;
  unitPrice: number;
  qty: number;
}
interface SpecialLine {
  kind: 'special';
  refId: string;
  name: string;
  color: string;
  temp: Temp;
  unitPrice: number;
  qty: number;
}

export type CartLine = DripLine | BeansLine | SpecialLine;

export function dripPrice(basePrice: number, size: Size): number {
  return basePrice + (size === '大杯' ? 20 : 0);
}

export function lineUnitPrice(line: CartLine): number {
  if (line.kind === 'drip') return dripPrice(line.basePrice, line.size);
  return line.unitPrice;
}
export function lineTotal(line: CartLine): number {
  return lineUnitPrice(line) * line.qty;
}
export function lineDetail(line: CartLine): string {
  if (line.kind === 'drip') return `${line.temp} · ${line.size}`;
  if (line.kind === 'beans') return line.bagLabel;
  return line.temp;
}

function isCartLine(v: unknown): v is CartLine {
  return !!v && typeof v === 'object' && ['drip', 'beans', 'special'].includes((v as { kind?: unknown }).kind as string);
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  addDrip: (coffee: Coffee, temp: Temp, size: Size, qty: number) => void;
  addBeans: (coffee: Coffee, bag: BagOption, qty: number) => void;
  addSpecial: (special: Special, temp: Temp, qty: number) => void;
  inc: (index: number) => void;
  dec: (index: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'onebox-cart';

function loadLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
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
    total: lines.reduce((a, l) => a + lineTotal(l), 0),
    addDrip: (coffee, temp, size, qty) => {
      setLines(prev => {
        const i = prev.findIndex(l => l.kind === 'drip' && l.refId === coffee.id && l.temp === temp && l.size === size);
        if (i >= 0) {
          const next = prev.slice();
          next[i] = { ...next[i], qty: next[i].qty + qty };
          return next;
        }
        return [...prev, { kind: 'drip', refId: coffee.id, name: coffee.name, color: coffee.color, basePrice: coffee.price, temp, size, qty } satisfies DripLine];
      });
    },
    addBeans: (coffee, bag, qty) => {
      setLines(prev => {
        const i = prev.findIndex(l => l.kind === 'beans' && l.refId === coffee.id && l.bagLabel === bag.label);
        if (i >= 0) {
          const next = prev.slice();
          next[i] = { ...next[i], qty: next[i].qty + qty };
          return next;
        }
        return [...prev, { kind: 'beans', refId: coffee.id, name: coffee.name, color: coffee.color, bagLabel: bag.label, unitPrice: bag.price, qty } satisfies BeansLine];
      });
    },
    addSpecial: (special, temp, qty) => {
      setLines(prev => {
        const i = prev.findIndex(l => l.kind === 'special' && l.refId === special.id && l.temp === temp);
        if (i >= 0) {
          const next = prev.slice();
          next[i] = { ...next[i], qty: next[i].qty + qty };
          return next;
        }
        return [...prev, { kind: 'special', refId: special.id, name: special.name, color: special.color, temp, unitPrice: special.price, qty } satisfies SpecialLine];
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

export function cartLineToItemInput(line: CartLine): { kind: ItemKind; id: string; temp?: string; size?: string; bagLabel?: string; qty: number } {
  if (line.kind === 'drip') return { kind: 'drip', id: line.refId, temp: line.temp, size: line.size, qty: line.qty };
  if (line.kind === 'beans') return { kind: 'beans', id: line.refId, bagLabel: line.bagLabel, qty: line.qty };
  return { kind: 'special', id: line.refId, temp: line.temp, qty: line.qty };
}
