import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CartSheet } from '@/components/cart/CartSheet'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/contexts/AuthContext'
import { CartProvider } from '@/contexts/CartContext'
import ComingSoon from '@/pages/ComingSoon'
import Index from '@/pages/Index'
import Login from '@/pages/Login'
import Menu from '@/pages/Menu'
import NotFound from '@/pages/NotFound'
import Signup from '@/pages/Signup'
import Subscriptions from '@/pages/Subscriptions'

const queryClient = new QueryClient()

// IMPORTANT: CartSheet uses useNavigate, so it — like everything else that needs
// router context — must be rendered INSIDE <BrowserRouter>. Rendering it outside
// caused a blank-screen crash in the original app; don't regress that here.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/menu" element={<Menu />} />
                  <Route path="/subscriptions" element={<Subscriptions />} />
                  <Route path="/catering" element={<ComingSoon title="Catering" />} />
                  <Route path="/checkout" element={<ComingSoon title="Checkout" />} />
                  <Route path="/orders" element={<ComingSoon title="Your Orders" />} />
                  <Route path="/profile" element={<ComingSoon title="Profile" />} />
                  <Route path="/diet-plan" element={<ComingSoon title="Diet Plan" />} />
                  <Route path="/preorder" element={<ComingSoon title="Pre-order" />} />
                  <Route path="/admin" element={<ComingSoon title="Admin Dashboard" />} />
                  <Route path="/dashboard" element={<ComingSoon title="Dashboard" />} />
                  <Route path="/kitchen" element={<ComingSoon title="Kitchen Dashboard" />} />
                  <Route path="/inventory" element={<ComingSoon title="Inventory" />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
            </div>
            <CartSheet />
            <Toaster />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}