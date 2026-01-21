import { Toaster } from "@/components/ui/toaster";  
import { Toaster as Sonner } from "@/components/ui/sonner";  
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes"; 
import { RestaurantProvider } from "@/context/RestaurantContext";
import { CartProvider } from "@/context/CartContext"; 
import MenuPage from "./pages/MenuPage";
import CheckoutPage from "./pages/CheckoutPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import SuccessPage from "./pages/SuccessPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        
        <BrowserRouter>
          <RestaurantProvider>
            <CartProvider>
              <Routes>
                <Route path="/" element={<MenuPage />} />
                <Route path="/product/:id" element={<ProductDetailPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/success" element={<SuccessPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CartProvider>
          </RestaurantProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;