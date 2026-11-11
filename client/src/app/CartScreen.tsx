import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton, LangToggle } from '../components';
import { useCart, lineTotal, cartLineToItemInput, type CartLine } from '../cart';
import { useLang } from '../i18n';
import { useToast } from '../toast';
import { api } from '../api';
import { unlockDing } from '../feedback';
import { getStoredEmail, setStoredEmail } from '../customerSession';
import { parseBagWeightGrams } from '../weight';
import type { Coffee, DeliveryQuote, OrderType } from '../types';

const NAME_STORAGE_KEY = 'onebox-customer-name';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// lineDetail() carries the raw Chinese domain values (temp/size are fixed
// literal types used by the order + cart data model); this only relabels
// them for display so the underlying data never needs to change.
function localizedLineDetail(l: CartLine, t: (key: string) => string): string {
  if (l.kind === 'beans') return l.bagLabel;
  const temp = l.temp === '熱' ? t('common.tempHot') : t('common.tempIce');
  if (l.kind === 'special') return temp;
  const size = l.size === '標準' ? t('common.sizeStd') : t('common.sizeLarge');
  return `${temp} · ${size}`;
}

export function CartScreen() {
  const navigate = useNavigate();
  const cart = useCart();
  const { t } = useLang();
  const { showToast } = useToast();
  const [placing, setPlacing] = useState(false);
  const [customerName, setCustomerName] = useState(() => localStorage.getItem(NAME_STORAGE_KEY) ?? '');
  const [customerEmail, setCustomerEmail] = useState(() => getStoredEmail());

  const [orderType, setOrderType] = useState<OrderType>('自取');
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = useState<{ id: number; label: string; discountPercent: number }[]>([]);
  // Which one (by member_rewards.id) the customer wants to use - null means
  // "don't use a discount". Defaults to the best one available (see the
  // reset effect below), but showing every coupon by name lets the customer
  // pick a different one, or none, instead of always getting whichever the
  // server would otherwise auto-pick.
  const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null);

  // Previews the member's actual named coupons so the cart shows them
  // before checkout, instead of a discount only appearing after the fact -
  // debounced so it doesn't fire on every keystroke while typing an email.
  // Resets to [] (not "last known") while the field doesn't hold a valid
  // address, so a half-typed or just-cleared email never shows stale
  // coupons for a different customer.
  useEffect(() => {
    const email = customerEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setAvailableDiscounts([]); return; }
    const timer = setTimeout(() => {
      api.getMemberDiscounts(email).then(
        (res) => setAvailableDiscounts(res.rewards),
        () => setAvailableDiscounts([]),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [customerEmail]);

  const availableDiscountIds = availableDiscounts.map(d => d.id).join(',');
  // Defaults to the best (highest %) coupon whenever the list changes (a
  // different email, or the set of coupons itself changing) - the customer
  // can still switch to a different one, or none, from the list below.
  useEffect(() => {
    setSelectedDiscountId(availableDiscounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDiscountIds]);

  const [availableExtraGrams, setAvailableExtraGrams] = useState<{ id: number; label: string; grams: number }[]>([]);
  const [selectedExtraGramsRewardId, setSelectedExtraGramsRewardId] = useState<number | null>(null);
  // Which cart line (by index) the bonus grams should land on - null means
  // "don't apply it this time", which the customer can pick explicitly even
  // while an unredeemed reward exists.
  const [selectedExtraGramsLineIndex, setSelectedExtraGramsLineIndex] = useState<number | null>(null);
  const [extraGramsDeclined, setExtraGramsDeclined] = useState(false);
  // Live stock figures, fetched once, so the bag picker below can tell
  // which beans line has enough stock left to cover the bonus grams too.
  const [coffeesForStock, setCoffeesForStock] = useState<Coffee[]>([]);

  useEffect(() => {
    api.listCoffees().then(setCoffeesForStock, () => setCoffeesForStock([]));
  }, []);

  // Same preview pattern as the discount coupons above - lets the cart show
  // which "多送克數" reward(s) the customer has before checkout.
  useEffect(() => {
    const email = customerEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setAvailableExtraGrams([]); return; }
    const timer = setTimeout(() => {
      api.getMemberExtraGrams(email).then(
        (res) => setAvailableExtraGrams(res.rewards),
        () => setAvailableExtraGrams([]),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [customerEmail]);

  const availableExtraGramsIds = availableExtraGrams.map(r => r.id).join(',');
  useEffect(() => {
    setSelectedExtraGramsRewardId(availableExtraGrams[0]?.id ?? null);
    setExtraGramsDeclined(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableExtraGramsIds]);

  const selectedExtraGramsReward = availableExtraGrams.find(r => r.id === selectedExtraGramsRewardId) ?? null;

  // A beans line is eligible for the bonus unless its coffee's stock IS
  // tracked AND every one of its bag labels IS parseable AND the bonus
  // would push the coffee's total committed grams (across every line of it
  // already in the cart) past what's left - mirrors orders.mts's own
  // "can't verify against stock, so don't block" convention for unparseable
  // labels, rather than blocking defensively.
  const isLineEligibleForExtraGrams = useMemo(() => {
    if (!selectedExtraGramsReward) return () => false;
    const perCoffee = new Map<string, { gramsNeeded: number; unparseable: boolean }>();
    for (const l of cart.lines) {
      if (l.kind !== 'beans') continue;
      const grams = parseBagWeightGrams(l.bagLabel);
      const entry = perCoffee.get(l.refId) ?? { gramsNeeded: 0, unparseable: false };
      if (grams === null) entry.unparseable = true;
      else entry.gramsNeeded += grams * l.qty;
      perCoffee.set(l.refId, entry);
    }
    return (line: CartLine) => {
      if (line.kind !== 'beans') return false;
      const coffee = coffeesForStock.find(c => c.id === line.refId);
      if (!coffee || coffee.stockQty === null) return true;
      const entry = perCoffee.get(line.refId);
      if (!entry || entry.unparseable) return true;
      return entry.gramsNeeded + selectedExtraGramsReward.grams <= coffee.stockQty;
    };
  }, [cart.lines, coffeesForStock, selectedExtraGramsReward]);

  const eligibleExtraGramsLineIndices = cart.lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => isLineEligibleForExtraGrams(l))
    .map(({ i }) => i);
  const eligibleExtraGramsLineIndicesKey = eligibleExtraGramsLineIndices.join(',');

  // Defaults to the first eligible beans line whenever the eligible set
  // changes (cart edited, reward switched) - unless the customer explicitly
  // declined the bonus, which sticks until the reward itself changes.
  useEffect(() => {
    setSelectedExtraGramsLineIndex(prev =>
      prev !== null && eligibleExtraGramsLineIndices.includes(prev) ? prev : (eligibleExtraGramsLineIndices[0] ?? null),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleExtraGramsLineIndicesKey, selectedExtraGramsRewardId]);

  const effectiveExtraGramsLineIndex = extraGramsDeclined ? null : selectedExtraGramsLineIndex;

  const requestDelivery = () => {
    setOrderType('外送');
    if (location || locating) return;
    if (!navigator.geolocation) {
      setLocationError(t('cart.geoUnsupported'));
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        try {
          const q = await api.getDeliveryQuote(lat, lng);
          setQuote(q);
          if (!q.deliverable) setLocationError(t('cart.geoOutOfRange', { maxKm: q.maxKm }));
        } catch (err) {
          setLocationError(err instanceof Error ? err.message : t('cart.geoQuoteFailed'));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocationError(t('cart.geoDenied'));
      },
      { timeout: 10000 },
    );
  };

  const deliveryFee = orderType === '外送' && quote?.deliverable ? quote.fee : 0;
  // Mirrors orders.mts's own computation exactly (beans-only subtotal,
  // rounded the same way) so this preview never drifts from what checkout
  // actually charges - the real amount is still decided server-side.
  const beansSubtotal = cart.lines.filter(l => l.kind === 'beans').reduce((sum, l) => sum + lineTotal(l), 0);
  const selectedDiscount = availableDiscounts.find(d => d.id === selectedDiscountId) ?? null;
  const discountAmount = selectedDiscount ? Math.round(beansSubtotal * selectedDiscount.discountPercent / 100) : 0;
  const total = cart.total + deliveryFee - discountAmount;
  const canCheckout = orderType === '自取' || (!!quote?.deliverable && !locating);
  const hasBrewedItems = cart.lines.some(l => l.kind !== 'beans');

  const checkout = async () => {
    const name = customerName.trim();
    const email = customerEmail.trim().toLowerCase();
    if (placing || cart.lines.length === 0 || !canCheckout) return;
    if (!name) { showToast(t('cart.needName')); return; }
    if (!email || !EMAIL_RE.test(email)) { showToast(t('cart.needEmail')); return; }
    unlockDing(); // must run synchronously in this click before any `await`, or iOS Safari blocks the sound later
    setPlacing(true);
    try {
      const order = await api.placeOrder({
        customerName: name,
        customerEmail: email,
        orderType,
        items: cart.lines.map(cartLineToItemInput),
        discountRewardId: selectedDiscountId,
        extraGramsRewardId: selectedExtraGramsRewardId,
        extraGramsLineIndex: effectiveExtraGramsLineIndex,
        ...(orderType === '外送' && location ? { lat: location.lat, lng: location.lng } : {}),
      });
      localStorage.setItem(NAME_STORAGE_KEY, name);
      setStoredEmail(email);
      cart.clear();
      navigate('/order-success', { state: { orderId: order.id, customerName: name, customerEmail: email, total: order.total, discountAmount: order.discountAmount, orderType, hasBrewedItems } });
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('cart.placeFailed'));
    } finally {
      setPlacing(false);
    }
  };

  const seg = (active: boolean) => ({
    flex: 1, cursor: 'pointer', textAlign: 'center' as const, padding: 13, borderRadius: 14, font: "600 14px 'Iansui'",
    background: active ? '#1a1714' : '#fff', color: active ? '#faf8f3' : '#4a3c2e',
    border: active ? 'none' : '1px solid #e4ddcd',
  });

  return (
    <MobileShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px 10px', borderBottom: '1px solid #e4ddcd' }}>
        <BackButton onClick={() => navigate('/menu')} />
        <div style={{ font: "600 17px 'Iansui'", color: '#1a1714' }}>{t('cart.title')}</div>
        <LangToggle />
      </div>

      {cart.lines.length > 0 ? (
        <div>
          <div style={{ padding: '16px 22px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cart.lines.map((l, idx) => (
              <div key={idx} style={{ background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flex: 'none', background: l.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "500 18px 'Room205',serif", color: '#1a1714' }}>{l.name}</div>
                  <div style={{ font: "400 11px 'Space Mono'", color: '#9a8a76', marginTop: 3 }}>{localizedLineDetail(l, t)}</div>
                  {idx === effectiveExtraGramsLineIndex && selectedExtraGramsReward && (
                    <div style={{ font: "600 11px 'Iansui'", color: '#3d6b4f', marginTop: 2 }}>{t('cart.extraGramsBadge', { grams: selectedExtraGramsReward.grams })}</div>
                  )}
                  <div style={{ font: "500 15px 'Room205'", color: '#1a1714', marginTop: 6 }}>${lineTotal(l)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div onClick={() => cart.dec(idx)} className="press" style={{ cursor: 'pointer', width: 30, height: 30, borderRadius: '50%', background: '#f2ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 16px 'Room205'" }}>−</div>
                  <span style={{ font: "500 16px 'Room205'", minWidth: 16, textAlign: 'center' }}>{l.qty}</span>
                  <div onClick={() => cart.inc(idx)} className="press" style={{ cursor: 'pointer', width: 30, height: 30, borderRadius: '50%', background: '#f2ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 16px 'Room205'" }}>＋</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '20px 22px 0' }}>
            <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 8, display: 'block' }}>{t('cart.pickupMethod')}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div onClick={() => setOrderType('自取')} className="press" style={seg(orderType === '自取')}>{t('cart.pickup')}</div>
              <div onClick={requestDelivery} className="press" style={seg(orderType === '外送')}>{t('cart.delivery')}</div>
            </div>
            {orderType === '外送' && locating && (
              <div style={{ marginTop: 8, font: "400 12px 'Iansui'", color: '#8a7a68' }}>{t('cart.locating')}</div>
            )}
            {orderType === '外送' && locationError && (
              <div style={{ marginTop: 8, font: "400 12px 'Iansui'", color: '#c8342b' }}>{locationError}</div>
            )}
            {orderType === '外送' && quote?.deliverable && (
              <div style={{ marginTop: 8, font: "400 12px 'Iansui'", color: '#3d6b4f' }}>{t('cart.distanceFee', { km: quote.distanceKm, fee: quote.fee })}</div>
            )}
          </div>

          {availableDiscounts.length > 0 && (
            <div style={{ margin: '16px 22px 0', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                <span style={{ font: "600 14px 'Iansui'" }}>🎟️</span>
                <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>{t('cart.discountPickHeading')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableDiscounts.map(d => {
                  const amount = Math.round(beansSubtotal * d.discountPercent / 100);
                  const selected = selectedDiscountId === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDiscountId(d.id)}
                      className="press"
                      style={{
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        padding: '11px 13px', borderRadius: 12,
                        background: selected ? '#eef2ec' : '#faf8f3',
                        border: '1px solid ' + (selected ? '#bfdac5' : '#e9e2d3'),
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                          border: '2px solid ' + (selected ? '#3d6b4f' : '#cbbfa8'),
                          background: selected ? '#3d6b4f' : 'transparent',
                        }} />
                        <span style={{ font: "600 13px 'Iansui'", color: '#1a1714', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
                      </div>
                      <span style={{ font: "500 13px 'Room205'", color: '#3d6b4f', flexShrink: 0 }}>-${amount}</span>
                    </div>
                  );
                })}
                <div
                  onClick={() => setSelectedDiscountId(null)}
                  className="press"
                  style={{
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '11px 13px', borderRadius: 12,
                    background: selectedDiscountId === null ? '#eef2ec' : '#faf8f3',
                    border: '1px solid ' + (selectedDiscountId === null ? '#bfdac5' : '#e9e2d3'),
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                    border: '2px solid ' + (selectedDiscountId === null ? '#3d6b4f' : '#cbbfa8'),
                    background: selectedDiscountId === null ? '#3d6b4f' : 'transparent',
                  }} />
                  <span style={{ font: "600 13px 'Iansui'", color: '#8a7a68' }}>{t('cart.discountNone')}</span>
                </div>
              </div>
            </div>
          )}

          {availableExtraGrams.length > 0 && cart.lines.some(l => l.kind === 'beans') && (
            <div style={{ margin: '16px 22px 0', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                <span style={{ font: "600 14px 'Iansui'" }}>🎁</span>
                <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>{t('cart.extraGramsHeading')}</span>
              </div>

              {availableExtraGrams.length > 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>{t('cart.extraGramsRewardPickHeading')}</label>
                  {availableExtraGrams.map(r => {
                    const selected = selectedExtraGramsRewardId === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedExtraGramsRewardId(r.id)}
                        className="press"
                        style={{
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                          padding: '11px 13px', borderRadius: 12,
                          background: selected ? '#eef2ec' : '#faf8f3',
                          border: '1px solid ' + (selected ? '#bfdac5' : '#e9e2d3'),
                        }}
                      >
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                          border: '2px solid ' + (selected ? '#3d6b4f' : '#cbbfa8'),
                          background: selected ? '#3d6b4f' : 'transparent',
                        }} />
                        <span style={{ font: "600 13px 'Iansui'", color: '#1a1714' }}>{r.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cart.lines.map((l, idx) => {
                  if (l.kind !== 'beans') return null;
                  const eligible = isLineEligibleForExtraGrams(l);
                  const selected = !extraGramsDeclined && selectedExtraGramsLineIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => { if (eligible) { setExtraGramsDeclined(false); setSelectedExtraGramsLineIndex(idx); } }}
                      className={eligible ? 'press' : undefined}
                      style={{
                        cursor: eligible ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        padding: '11px 13px', borderRadius: 12, opacity: eligible ? 1 : .5,
                        background: selected ? '#eef2ec' : '#faf8f3',
                        border: '1px solid ' + (selected ? '#bfdac5' : '#e9e2d3'),
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                          border: '2px solid ' + (selected ? '#3d6b4f' : '#cbbfa8'),
                          background: selected ? '#3d6b4f' : 'transparent',
                        }} />
                        <span style={{ font: "600 13px 'Iansui'", color: '#1a1714', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name} · {l.bagLabel} × {l.qty}</span>
                      </div>
                      {!eligible && <span style={{ font: "500 11px 'Iansui'", color: '#c8342b', flexShrink: 0 }}>{t('cart.extraGramsInsufficient')}</span>}
                    </div>
                  );
                })}
                <div
                  onClick={() => setExtraGramsDeclined(true)}
                  className="press"
                  style={{
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '11px 13px', borderRadius: 12,
                    background: extraGramsDeclined ? '#eef2ec' : '#faf8f3',
                    border: '1px solid ' + (extraGramsDeclined ? '#bfdac5' : '#e9e2d3'),
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                    border: '2px solid ' + (extraGramsDeclined ? '#3d6b4f' : '#cbbfa8'),
                    background: extraGramsDeclined ? '#3d6b4f' : 'transparent',
                  }} />
                  <span style={{ font: "600 13px 'Iansui'", color: '#8a7a68' }}>{t('cart.extraGramsNone')}</span>
                </div>
              </div>
            </div>
          )}

          <div style={{ margin: '16px 22px 0', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12 }}>
              <span style={{ font: "400 14px 'Iansui'", color: '#6b5c4a' }}>{t('cart.subtotal')}</span>
              <span style={{ font: "500 15px 'Room205'", color: '#1a1714' }}>${cart.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: discountAmount > 0 ? 'none' : '1px solid #eee3d3' }}>
              <span style={{ font: "400 14px 'Iansui'", color: '#6b5c4a' }}>{orderType === '外送' ? t('cart.deliveryFeeLabel') : t('cart.pickupMethod')}</span>
              <span style={{ font: "500 14px 'Iansui'", color: '#1a1714' }}>
                {orderType === '自取' ? t('cart.pickupFree') : (quote?.deliverable ? `$${deliveryFee}` : '—')}
              </span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee3d3' }}>
                <span style={{ font: "400 14px 'Iansui'", color: '#3d6b4f' }}>{t('cart.memberDiscount')}</span>
                <span style={{ font: "500 14px 'Room205'", color: '#3d6b4f' }}>-${discountAmount}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14 }}>
              <span style={{ font: "600 15px 'Iansui'", color: '#1a1714' }}>{t('cart.total')}</span>
              <span style={{ font: "600 26px 'Room205'", color: '#1a1714' }}>${total}</span>
            </div>
          </div>

          <div style={{ padding: '20px 22px 0' }}>
            <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 8, display: 'block' }}>{hasBrewedItems ? t('cart.nameLabel') : t('cart.nameLabelBeans')}</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={hasBrewedItems ? t('cart.namePlaceholder') : t('cart.namePlaceholderBeans')}
              maxLength={40}
              style={{ width: '100%', padding: '13px 16px', border: '1px solid #e4ddcd', borderRadius: 14, background: '#fff', font: "400 15px 'Iansui'", color: '#1a1714', outline: 'none' }}
            />
          </div>

          <div style={{ padding: '16px 22px 0' }}>
            <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 8, display: 'block' }}>{t('cart.emailLabel')}</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder={t('cart.emailPlaceholder')}
              maxLength={254}
              style={{ width: '100%', padding: '13px 16px', border: '1px solid #e4ddcd', borderRadius: 14, background: '#fff', font: "400 15px 'Iansui'", color: '#1a1714', outline: 'none' }}
            />
          </div>

          <div style={{ padding: '16px 22px 12px' }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: '#eef2ec', borderRadius: 14, padding: 14 }}>
              <span style={{ font: "600 14px 'Iansui'", color: '#3d6b4f' }}>☕</span>
              <span style={{ font: "400 12px/1.6 'Iansui'", color: '#4a5f4e' }}>
                {hasBrewedItems
                  ? (orderType === '自取' ? t('cart.noteBrewedPickup') : t('cart.noteBrewedDelivery'))
                  : (orderType === '自取' ? t('cart.noteBeansPickup') : t('cart.noteBeansDelivery'))}
              </span>
            </div>
          </div>

          <div style={{ padding: '6px 22px 34px' }}>
            <div
              onClick={checkout}
              className="press"
              style={{ cursor: (placing || !canCheckout) ? 'default' : 'pointer', opacity: (placing || !canCheckout) ? .6 : 1, background: '#1a1714', color: '#faf8f3', borderRadius: 20, padding: 19, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ font: "600 16px 'Iansui'" }}>{placing ? t('cart.placing') : t('cart.placeOrder')}</span>
              <span style={{ font: "700 11px 'Space Mono'", letterSpacing: 1, color: '#c98a2e' }}>${total} · PLACE ORDER →</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 40px' }}>
          <div style={{ font: "600 60px 'Room205'", color: '#e0d7c5' }}>∅</div>
          <div style={{ font: "600 20px 'Iansui'", color: '#1a1714', marginTop: 16 }}>{t('cart.empty.title')}</div>
          <div style={{ font: "400 14px 'Iansui'", color: '#8a7a68', marginTop: 8 }}>{t('cart.empty.subtitle')}</div>
          <div onClick={() => navigate('/menu')} className="press" style={{ cursor: 'pointer', marginTop: 24, background: '#1a1714', color: '#faf8f3', borderRadius: 16, padding: '14px 28px', font: "600 15px 'Iansui'" }}>{t('cart.empty.cta')}</div>
        </div>
      )}
    </MobileShell>
  );
}
