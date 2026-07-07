import { useNavigate } from 'react-router-dom';

export function AdminTopBar({ active }: { active: 'beans' | 'orders' }) {
  const navigate = useNavigate();
  const navStyle = (isActive: boolean) => ({
    cursor: 'pointer',
    font: "700 11px 'Space Mono'",
    letterSpacing: 1,
    color: isActive ? '#f4f1ea' : '#8a7a68',
    borderBottom: isActive ? '2px solid #c98a2e' : '2px solid transparent',
    paddingBottom: 4,
  });

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 30, height: 62, background: '#1a1714', color: '#f4f1ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ font: "500 22px 'Room205',serif" }}>onebox<span style={{ color: '#c98a2e' }}>.</span></div>
        <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#c98a2e', border: '1px solid rgba(201,154,106,.5)', padding: '4px 9px', borderRadius: 6 }}>ADMIN</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div onClick={() => navigate('/admin')} className="press" style={navStyle(active === 'beans')}>豆款管理</div>
        <div onClick={() => navigate('/admin/orders')} className="press" style={navStyle(active === 'orders')}>訂單 ORDERS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#c98a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "600 14px 'Iansui'", color: '#1a1714' }}>主</div>
          <span style={{ font: "500 13px 'Iansui'" }}>店長</span>
        </div>
      </div>
    </div>
  );
}
