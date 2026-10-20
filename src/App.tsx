import GiftCard from './pages/GiftCard';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { setTrackedCart, trackPage } from './lib/track';
import { Layout } from './components/Layout';
import { QuickAddProvider } from './components/ProductCard';
import { PrefsProvider } from './lib/prefs';
import { AuthProvider, CartProvider, DataProvider, ToastProvider, useCart, WishlistProvider } from './lib/store';
import Account from './pages/Account';
import Brands from './pages/Brands';
import Categories from './pages/Categories';
import Checkout from './pages/Checkout';
import Home from './pages/Home';
import { Faq, NotFound, Policies, Request, Wishlist } from './pages/Misc';
import OrderDone from './pages/OrderDone';
import ProductPage from './pages/Product';
import Shop from './pages/Shop';

/** Page views for the dashboard's live visitors and statistics. */
function Tracker() {
  const loc = useLocation();
  const cart = useCart();
  useEffect(() => { setTrackedCart(cart.count); }, [cart.count]);
  useEffect(() => { trackPage(loc.pathname); }, [loc.pathname]);
  return null;
}

export default function App() {
  return (
    <PrefsProvider>
      <DataProvider>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <ToastProvider>
                <BrowserRouter>
                  <QuickAddProvider>
                    <Tracker />
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/shop" element={<Shop />} />
                        <Route path="/products" element={<Shop />} />
                        <Route path="/brand/:brand" element={<Shop />} />
                        <Route path="/brands" element={<Brands />} />
                        <Route path="/categories" element={<Categories />} />
                        <Route path="/product/:id" element={<ProductPage />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/bag" element={<Navigate to="/checkout" replace />} />
                        <Route path="/order/:number" element={<OrderDone />} />
                        <Route path="/account" element={<Account />} />
                        <Route path="/login" element={<Navigate to="/account" replace />} />
                        <Route path="/wishlist" element={<Wishlist />} />
                        <Route path="/request" element={<Request />} />
                        <Route path="/gift-card" element={<GiftCard />} />
                        <Route path="/policies" element={<Policies />} />
                        <Route path="/faq" element={<Faq />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Layout>
                  </QuickAddProvider>
                </BrowserRouter>
              </ToastProvider>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </DataProvider>
    </PrefsProvider>
  );
}
