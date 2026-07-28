'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CartButton() {
  const [cartCount, setCartCount] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    const updateCount = () => {
      const saved = localStorage.getItem('nexio_cart');
      if (saved) {
        try {
          const items = JSON.parse(saved);
          const count = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
          setCartCount(count);
        } catch {
          setCartCount(0);
        }
      }
    };
    updateCount();

    window.addEventListener('storage', updateCount);
    // Custom event to update from same window if cart is modified
    window.addEventListener('nexio_cart_updated', updateCount);

    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('nexio_cart_updated', updateCount);
    };
  }, []);

  return (
    <Button asChild variant="default" className="relative gap-2 font-bold shadow-md h-11 min-w-11">
      <Link href="/cart" aria-label={`سلة المشتريات، يوجد ${mounted ? cartCount : 0} عناصر`}>
        <ShoppingBag className="h-4 w-4" />
        <span className="hidden sm:inline">السلة</span>
        {mounted && cartCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {cartCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
