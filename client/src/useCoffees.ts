import { useEffect, useState } from 'react';
import { api } from './api';
import type { Coffee, Special } from './types';

export function useCoffees(all = false) {
  const [coffees, setCoffees] = useState<Coffee[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.listCoffees(all).then(
      list => { if (!cancelled) setCoffees(list); },
      err => { if (!cancelled) setError(err.message); },
    );
    return () => { cancelled = true; };
  }, [all]);

  return { coffees, error };
}

export function useCoffee(id: string | undefined) {
  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setCoffee(null);
    api.getCoffee(id).then(
      c => { if (!cancelled) setCoffee(c); },
      err => { if (!cancelled) setError(err.message); },
    );
    return () => { cancelled = true; };
  }, [id]);

  return { coffee, error };
}

export function useSpecials(all = false) {
  const [specials, setSpecials] = useState<Special[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.listSpecials(all).then(
      list => { if (!cancelled) setSpecials(list); },
      err => { if (!cancelled) setError(err.message); },
    );
    return () => { cancelled = true; };
  }, [all]);

  return { specials, error };
}
