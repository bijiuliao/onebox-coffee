import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { playDing, vibrateSuccess } from '../feedback';
import type { OrderType } from '../types';

interface SuccessState {
  customerName: string;
  total: number;
  orderType: OrderType;
}

export function OrderSuccessScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as SuccessState | null;

  useEffect(() => {
    if (!state) {
      navigate('/', { replace: true });
      return;
    }
    playDing();
    vibrateSuccess();
    const t = setTimeout(() => navigate('/', { replace: true }), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;

  return (
    <MobileShell style={{ background: 'radial-gradient(115% 80% at 50% 30%,#fbf8f1 0%,#f1ebdd 55%,#e9e1cf 100%)' }}>
      <div
        onClick={() => navigate('/', { replace: true })}
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', padding: '0 30px' }}
      >
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
          <circle
            cx="60" cy="60" r="56" fill="none" stroke="#3d6b4f" strokeWidth="2" opacity={0.35}
            style={{ transformOrigin: '60px 60px', animation: 'successRing .7s ease-out both' }}
          />
          <circle
            cx="60" cy="60" r="56" fill="#3d6b4f"
            style={{ transformOrigin: '60px 60px', animation: 'successPop .45s cubic-bezier(.25,.9,.4,1.25) both' }}
          />
          <path
            d="M35 61 L53 79 L87 41" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
            pathLength={100}
            style={{ strokeDasharray: 100, strokeDashoffset: 100, animation: 'successCheck .45s .32s cubic-bezier(.3,.6,.3,1) forwards' }}
          />
        </svg>
        <div className="rise" style={{ marginTop: 26, font: "600 26px 'Iansui'", color: '#1a1714', animationDelay: '.3s' }}>已接單</div>
        <div className="rise" style={{ marginTop: 10, font: "400 14px 'Iansui'", color: '#6b5c4a', animationDelay: '.4s' }}>
          {state.customerName} · {state.orderType === '外送' ? '外送' : '門市自取'}
        </div>
        <div className="rise" style={{ marginTop: 4, font: "500 15px 'Room205'", color: '#1a1714', animationDelay: '.4s' }}>
          總計 ${state.total}
        </div>
        <div className="rise" style={{ marginTop: 22, font: "400 13px 'Iansui'", color: '#8a7a68', animationDelay: '.5s' }}>
          為你手沖中，預計 8–12 分鐘 ☕
        </div>
      </div>
    </MobileShell>
  );
}
