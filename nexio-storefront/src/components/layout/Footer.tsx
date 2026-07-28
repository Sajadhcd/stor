import Link from 'next/link';
import { Store, ShieldCheck, Truck, CreditCard } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground border-t mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-foreground/10 text-primary-foreground rounded-lg">
                <Store className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold">Nexio Commerce</span>
            </div>
            <p className="text-sm text-primary-foreground/70 leading-relaxed max-w-xs">
              منصة التجارة الإلكترونية العراقية المتكاملة. نوفر لكم أفضل المنتجات مع خدمات الشحن
              والتقسيط المباشر.
            </p>
          </div>

          {/* Logistics Feature */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-primary-foreground/90">
              التوصيل والولوجستيات
            </h4>
            <ul className="text-sm space-y-3 text-primary-foreground/70">
              <li className="flex items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 opacity-70" />
                <span>التوصيل إلى كافة المحافظات 18</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 flex items-center justify-center opacity-70">
                  •
                </span>
                <span>شحن مباشر خلال 24 - 48 ساعة</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 flex items-center justify-center opacity-70">
                  •
                </span>
                <span>تتبع فوري للشحنات</span>
              </li>
            </ul>
          </div>

          {/* Payment Gateways Feature */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-primary-foreground/90">
              طرق الدفع المحلية
            </h4>
            <ul className="text-sm space-y-3 text-primary-foreground/70">
              <li className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 shrink-0 opacity-70" />
                <span>الدفع نقداً عند الاستلام (COD)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 flex items-center justify-center opacity-70">
                  •
                </span>
                <span>بطاقة كي كارد (Qi Card)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 flex items-center justify-center opacity-70">
                  •
                </span>
                <span>محفظة زين كاش و آسيا حوالة</span>
              </li>
            </ul>
          </div>

          {/* Store Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-primary-foreground/90">
              ميزات التسوق
            </h4>
            <ul className="text-sm space-y-3 text-primary-foreground/70">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 opacity-70" />
                <span>ضمان استرجاع حقيقي وفحص</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 flex items-center justify-center opacity-70">
                  •
                </span>
                <span>أسعار شفافة بالدينار العراقي</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 flex items-center justify-center opacity-70">
                  •
                </span>
                <span>البيع بالأقساط المباشرة الشهرية</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-primary-foreground/50">
          <p>© {new Date().getFullYear()} Nexio Commerce. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-4">
            <Link
              href="#"
              className="hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground rounded-sm"
            >
              سياسة الخصوصية
            </Link>
            <Link
              href="#"
              className="hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground rounded-sm"
            >
              الشروط والأحكام
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
