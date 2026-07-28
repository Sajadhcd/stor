import Link from 'next/link';
import { Search, Store, ShieldCheck, Truck, User } from 'lucide-react';
import { CartButton } from './CartButton';
import { MobileNav } from './MobileNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Header() {
  return (
    <header className="bg-background sticky top-0 z-40 border-b shadow-sm">
      {/* Top Banner */}
      <div className="bg-primary text-primary-foreground font-semibold text-center py-2 px-4 text-xs flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        <span>شحن سريع لجميع محافظات العراق الـ 18 - الدفع عند الاستلام أو زين كاش</span>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4 md:gap-8 justify-between">
        {/* Mobile Nav Trigger & Brand */}
        <div className="flex items-center gap-2 md:gap-4">
          <MobileNav />
          <Link
            href="/"
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
            aria-label="الرئيسية Nexio Store"
          >
            <div className="p-2 bg-primary text-primary-foreground rounded-lg shadow-sm group-hover:bg-primary/90 transition-colors">
              <Store className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-extrabold tracking-tight text-foreground block leading-none">
                Nexio Store
              </span>
              <span className="text-[10px] text-muted-foreground font-medium block mt-1 leading-none">
                المتجر العراقي المباشر
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold">
          <Link
            href="/products"
            className="text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
          >
            المنتجات
          </Link>
          <Link
            href="/track-order"
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
          >
            <Truck className="w-4 h-4 text-muted-foreground" />
            <span>تتبع الطلب</span>
          </Link>
          <Link
            href="/account"
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
          >
            <User className="w-4 h-4 text-muted-foreground" />
            <span>حسابي</span>
          </Link>
        </nav>

        {/* Actions (Search + Cart) */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Accessible Search Form */}
          <form
            action="/products"
            method="GET"
            className="hidden md:flex relative max-w-sm w-full items-center"
            role="search"
          >
            <Input
              type="search"
              name="search"
              placeholder="ابحث عن منتج..."
              className="pe-11 h-11 bg-muted/50 focus-visible:bg-background"
              aria-label="البحث عن منتجات"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="absolute end-0 h-11 w-11 text-muted-foreground hover:bg-transparent"
              aria-label="تنفيذ البحث"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {/* Client-side Cart Integration */}
          <CartButton />
        </div>
      </div>

      {/* Mobile Search Bar - Visible only on small screens */}
      <div className="md:hidden px-4 pb-3">
        <form
          action="/products"
          method="GET"
          className="relative w-full flex items-center"
          role="search"
        >
          <Input
            type="search"
            name="search"
            placeholder="ابحث عن منتج..."
            className="pe-11 h-11 bg-muted/50"
            aria-label="البحث عن منتجات"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="absolute end-0 h-11 w-11 text-muted-foreground hover:bg-transparent"
            aria-label="تنفيذ البحث"
          >
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
