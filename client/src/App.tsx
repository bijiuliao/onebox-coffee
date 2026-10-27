import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './cart';
import { ToastProvider } from './toast';
import { LangProvider } from './i18n';
import { CoverScreen } from './app/CoverScreen';
import { MenuScreen } from './app/MenuScreen';
import { DetailScreen } from './app/DetailScreen';
import { CartScreen } from './app/CartScreen';
import { OrderSuccessScreen } from './app/OrderSuccessScreen';
import { OrderLookupScreen } from './app/OrderLookupScreen';
import { LeaderboardScreen } from './app/LeaderboardScreen';
import { MemberLevelScreen } from './app/MemberLevelScreen';
import { AdminPage } from './admin/AdminPage';
import { SpecialsAdminPage } from './admin/SpecialsAdminPage';
import { OrdersView } from './admin/OrdersView';
import { OrderLabelsView } from './admin/OrderLabelsView';
import { PackingView } from './admin/PackingView';
import { OrderReceiptView } from './admin/OrderReceiptView';
import { ReviewsAdminView } from './admin/ReviewsAdminView';
import { CustomersView } from './admin/CustomersView';
import { CustomerDetailView } from './admin/CustomerDetailView';
import { StockView } from './admin/StockView';
import { StockDetailView } from './admin/StockDetailView';
import { NotifyBeansView } from './admin/NotifyBeansView';

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
              <Route path="/order-lookup" element={<OrderLookupScreen />} />
              <Route path="/leaderboard" element={<LeaderboardScreen />} />
              <Route path="/member-level" element={<MemberLevelScreen />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/specials" element={<SpecialsAdminPage />} />
              <Route path="/admin/orders" element={<OrdersView />} />
              <Route path="/admin/orders/:id/labels" element={<OrderLabelsView />} />
              <Route path="/admin/orders/:id/receipt" element={<OrderReceiptView />} />
              <Route path="/admin/packing" element={<PackingView />} />
              <Route path="/admin/stock" element={<StockView />} />
              <Route path="/admin/stock/:id" element={<StockDetailView />} />
              <Route path="/admin/customers" element={<CustomersView />} />
              <Route path="/admin/customers/:email" element={<CustomerDetailView />} />
              <Route path="/admin/reviews" element={<ReviewsAdminView />} />
              <Route path="/admin/notify-beans" element={<NotifyBeansView />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </ToastProvider>
    </LangProvider>
  );
}

export default App;
