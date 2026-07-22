import Link from 'next/link';
import { Store, ShieldCheck, Truck, CreditCard, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Store className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white">Nexio Commerce Store</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              منصة التجارة الإلكترونية العراقية المتكاملة. نوفر لكم أفضل المنتجات العالمية والمحلية مع خدمات الشحن والتقسيط المباشر.
            </p>
          </div>

          {/* Logistics Feature */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">وسائل التوصيل والولوجستيات</h4>
            <ul className="text-xs space-y-2 text-slate-400">
              <li>• التوصيل إلى كافة المحافظات العراقية 18</li>
              <li>• شحن مباشر خلال 24 - 48 ساعة</li>
              <li>• تتبع فوري للشحنات مع شركات الشحن</li>
            </ul>
          </div>

          {/* Payment Gateways Feature */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">طرق الدفع المحلية</h4>
            <ul className="text-xs space-y-2 text-slate-400">
              <li>• الدفع نقداً عند الاستلام (COD)</li>
              <li>• بطاقة كي كارد (Qi Card)</li>
              <li>• محفظة زين كاش (ZainCash)</li>
              <li>• محفظة آسيا حوالة (AsiaHawala)</li>
            </ul>
          </div>

          {/* Installment System */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">ميزات التسوق العراقي</h4>
            <ul className="text-xs space-y-2 text-slate-400">
              <li>• البيع بالأقساط المباشرة الشهرية</li>
              <li>• ضمان استرجاع حقيقي وفحص قبل الاستلام</li>
              <li>• أسعار شفافة بالدينار العراقي (د.ع)</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-900 mt-12 pt-6 text-center text-xs text-slate-500">
          <p>© 2026 Nexio Commerce - جميع الحقوق محفوظة لجمهورية العراق.</p>
        </div>
      </div>
    </footer>
  );
}
