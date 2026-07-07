import { useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BRAND_NAME } from '../constants';

export function CoverScreen() {
  const navigate = useNavigate();
  const enter = () => navigate('/menu');

  return (
    <MobileShell style={{ background: 'radial-gradient(115% 80% at 50% 12%,#fbf8f1 0%,#f1ebdd 55%,#e9e1cf 100%)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh', padding: '0 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0 0' }}>
          <div style={{ font: "500 21px 'Room205',serif", color: '#1a1714', letterSpacing: '-.01em' }}>
            {BRAND_NAME}<span style={{ color: '#c98a2e' }}>.</span>
          </div>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#8a7a68' }}>EST. 2026 · TAIPEI</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
          <div className="rise" style={{ font: "700 10px 'Space Mono'", letterSpacing: 3, color: '#3d6b4f', marginBottom: 22, animationDelay: '.05s' }}>
            SINGLE ORIGIN · HAND DRIP BAR
          </div>
          <div className="rise" style={{ font: "600 46px/1.08 'Iansui',serif", color: '#1a1714', letterSpacing: '.01em', animationDelay: '.16s' }}>
            one box&nbsp;<br />coffee
          </div>

          <div
            onClick={enter}
            className="catwrap press rise"
            style={{
              position: 'relative', margin: '30px 0 8px', cursor: 'pointer', width: 270, height: 270,
              display: 'flex', alignItems: 'center', justifyContent: 'center', animationDelay: '.3s',
            }}
          >
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 210, height: 210, borderRadius: '50%', background: '#fff', boxShadow: '0 30px 50px -22px rgba(120,90,55,.5)', transform: 'translate(-50%,-50%)' }} />
            <img
              className="catimg"
              src="/assets/cat-box.jpg"
              alt="onebox 貓"
              style={{ width: 250, height: 250, objectFit: 'contain', position: 'relative', zIndex: 2, animation: 'floaty 5s ease-in-out infinite', mixBlendMode: 'multiply' }}
            />
          </div>

          <div className="rise" style={{ marginTop: 14, font: "500 15px 'Iansui'", color: '#6b5c4a', animationDelay: '.44s' }}>
            點一下箱子，看看今天躲了什麼豆
          </div>
          <div className="rise" style={{ marginTop: 16, color: '#c98a2e', font: "700 22px 'Room205'", animation: 'pulse 1.8s ease-in-out infinite' }}>
            ↓
          </div>
        </div>

        <div
          onClick={enter}
          className="press rise"
          style={{
            cursor: 'pointer', margin: '0 0 30px', background: '#1a1714', color: '#f4f1ea', borderRadius: 20,
            padding: 19, display: 'flex', justifyContent: 'space-between', alignItems: 'center', animationDelay: '.54s',
          }}
        >
          <span style={{ font: "600 16px 'Iansui'" }}>開始點餐</span>
          <span style={{ font: "700 11px 'Space Mono'", letterSpacing: 1, color: '#c98a2e' }}>OPEN THE BOX →</span>
        </div>
      </div>
    </MobileShell>
  );
}
