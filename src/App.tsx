import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireShop } from "@/components/RequireShop";
import Landing from "@/pages/Landing";
import LoginPage from "@/pages/Login";
import AppPage from "@/pages/AppPage";
import ShopOnboarding from "@/pages/ShopOnboarding";
import ShopBookings from "@/pages/ShopBookings";

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          Back home
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/sign-in" element={<LoginPage initialMode="signin" />} />
            <Route path="/sign-up" element={<LoginPage initialMode="signup" />} />
            <Route element={<RequireAuth />}>
              <Route element={<RequireShop />}>
                <Route path="/shop" element={<ShopOnboarding />} />
                <Route path="/shop/bookings" element={<ShopBookings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
