'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, Truck, User, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  const onLinkClick = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-11 w-11" aria-label="القائمة الرئيسية">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <span>Nexio Store</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-4 text-start">
          <Link
            href="/"
            onClick={onLinkClick}
            className="text-base font-semibold text-foreground hover:text-primary transition-colors py-2"
          >
            الرئيسية
          </Link>
          <Separator />

          <Link
            href="/products"
            onClick={onLinkClick}
            className="text-base font-semibold text-foreground hover:text-primary transition-colors py-2"
          >
            المنتجات والتصنيفات
          </Link>
          <Separator />

          <Link
            href="/track-order"
            onClick={onLinkClick}
            className="text-base font-semibold text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
          >
            <Truck className="h-4 w-4" />
            تتبع الطلب
          </Link>
          <Separator />

          <Link
            href="/account"
            onClick={onLinkClick}
            className="text-base font-semibold text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            حسابي والأقساط
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
