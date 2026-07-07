import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './cart';
import { ToastProvider } from './toast';
import { CoverScreen } from './app/CoverScreen';
import { MenuScreen } from './app/MenuScreen';
import { DetailScreen } from './app/DetailScreen';
import { CartScreen } from './app/CartScreen';
import { AdminPage } from './admin/AdminPage';

function App() {
  return (
    <ToastProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<CoverScreen />} />
            <Route path="/menu" element={<MenuScreen />} />
            <Route path="/coffee/:id" element={<DetailScreen />} />
            <Route path="/cart" element={<CartScreen />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ToastProvider>
  );
}

export default App;
