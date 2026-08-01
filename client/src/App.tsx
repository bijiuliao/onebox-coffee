import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './cart';
import { ToastProvider } from './toast';
import { LangProvider } from './i18n';
import { CoverScreen } from './app/CoverScreen';
import { MenuScreen } from './app/MenuScreen';
import { DetailScreen } from './app/DetailScreen';
import { CartScreen } from './app/CartScreen';
import { OrderSuccessScreen } from './app/OrderSuccessScreen';
import { AdminPage } from './admin/AdminPage';
import { SpecialsAdminPage } from './admin/SpecialsAdminPage';
import { OrdersView } from './admin/OrdersView';

function App() {
  return (
    <LangProvider>
      <ToastProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<CoverScreen />} />
              <Route path="/menu" element={<MenuScreen />} />
              <Route path="/coffee/:id" element={<DetailScreen />} />
              <Route path="/cart" element={<CartScreen />} />
              <Route path="/order-success" element={<OrderSuccessScreen />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/specials" element={<SpecialsAdminPage />} />
              <Route path="/admin/orders" element={<OrdersView />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </ToastProvider>
    </LangProvider>
  );
}

export default App;
