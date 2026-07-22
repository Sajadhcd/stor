'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatIQD } from '@/lib/currency';
import { ShieldCheck, Truck, CreditCard, CheckCircle2, ArrowRight, Wallet } from 'lucide-react';

const iraqiProvinces = [
  'بغداد', 'البصرة', 'أربيل', 'النجف الأشرف', 'كربلاء المقدسة', 
  'نينوى', 'السليمانية', 'دهوك', 'الأنبار', 'بابل', 
  'ديالى', 'ذي قار', 'القادسية', 'كركوك', 'ميسان', 
  'المثنى', 'صلاح الدين', 'واسط'
];

const paymentMethods = [
  { id: 'COD', name: 'الدفع نقداً عند الاستلام (COD)', icon: Truck, description: 'افحص طلبيتك وأدفع للمندوب عند باب البيت' },
  { id: 'QI_CARD', name: 'بطاقة كي كارد (Qi Card)', icon: CreditCard, description: 'خصم مباشر أمن وسريع عبر بطاقة الكي كارد العراقية' },
  { id: 'ZAIN_CASH', name: 'محفظة زين كاش (ZainCash)', icon: Wallet, description: 'دفع فوري عبر محفظة زين كاش العراقية' },
  { id: 'ASIA_HAWALA', name: 'محفظة آسيا حوالة (AsiaHawala)', icon: Wallet, description: 'تحويل مباشر عبر آسيا حوالة' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('بغداد');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');

  useEffect(() => {
    const saved = localStorage.getItem('nexio_cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        setCart([]);
      }
    }
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const deliveryFee = province === 'بغداد' ? 5000 : 8000;
  const grandTotal = subtotal + deliveryFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('السلة فارغة!');
      return;
    }
    if (cart.some((item) => !item.variantId)) {
      alert('تحتوي السلة على منتج غير متاح. احذفه وأعد إضافته من صفحة المنتجات.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create shopping cart in NestJS backend
      const cartRes = await apiFetch('/carts', {
        method: 'POST',
        body: JSON.stringify({
          storeId: '11111111-1111-1111-1111-111111111111',
          currency: 'IQD',
        }),
      });

      // 2. Add cart items
      for (const item of cart) {
        await apiFetch(`/carts/${cartRes.id}/items`, {
          method: 'POST',
          body: JSON.stringify({
            variantId: item.variantId,
            quantity: item.quantity,
          }),
        });
      }

      // 3. Create or resolve customer
      const customer = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: customerName,
          email: `cust-${Date.now()}@nexio.iq`,
          phone,
          address: { province, city, address },
        }),
      }).catch(() => null);

      const customerId = customer?.id;

      // 4. Create checkout session using POST /checkouts matching CreateCheckoutDto exactly
      const checkout = await apiFetch('/checkouts', {
        method: 'POST',
        body: JSON.stringify({
          cartId: cartRes.id,
          ...(customerId ? { customerId } : {}),
        }),
      });

      // 5. Update customer details for checkout session
      await apiFetch(`/checkouts/${checkout.id}/customer`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: customerName,
          email: `cust-${Date.now()}@nexio.iq`,
          phone,
          ...(customerId ? { customerId } : {}),
        }),
      }).catch(() => null);

      // 6. Update shipping address for checkout session
      await apiFetch(`/checkouts/${checkout.id}/addresses`, {
        method: 'PATCH',
        body: JSON.stringify({
          shippingAddress: {
            street: address || 'شارع الرئيسي',
            city: city || 'الكرخ',
            state: province || 'بغداد',
            country: 'Iraq',
          },
        }),
      }).catch(() => null);

      // 7. Create order from checkout session
      const order = await apiFetch('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          checkoutId: checkout.id,
          notes: `طريقة الدفع: ${paymentMethod}`,
        }),
      });

      // Clear cart
      localStorage.removeItem('nexio_cart');
      window.dispatchEvent(new Event('storage'));

      alert(`تم إرسال طلبك بنجاح برقم: ${order.orderNumber}`);
      router.push('/orders');
    } catch (err: any) {
      console.error('Order submission error:', err);
      alert(err.message || 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إتمام الطلب والشحن للمحافظة</h1>
        <p className="text-sm text-slate-500 mt-1">أدخل عنوان الشحن الدقيق واختر طريقة الدفع المناسبة لك.</p>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping & Payment Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Address Form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              <span>عنوان التسليم في العراق</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل للمستلم</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد عبد الحسين"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف العراقي</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0770 123 4567"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {iraqiProvinces.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المدينة/المنطقة</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="مثال: الكرخ - المنصور"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان التفصيلي (أقرب نقطة دالة)</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="شارع 14 رمضان - مقابل جامع الرحمن"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Payment Methods Choice */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <span>طريقة الدفع المحلية</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.id;
                return (
                  <div
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-emerald-600 text-slate-950' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{method.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{method.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Summary & Submit Panel (1 col) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between h-fit sticky top-24">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">الفاتورة النهائية (IQD)</h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>مجموع المنتجات:</span>
                <span className="font-bold text-slate-900">{formatIQD(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>أجور الشحن ({province}):</span>
                <span className="font-bold text-emerald-600">{formatIQD(deliveryFee)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs font-bold text-slate-700">المبلغ الإجمالي المطلق:</span>
              <span className="text-2xl font-black text-emerald-600">{formatIQD(grandTotal)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-2xl text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>{submitting ? 'جاري تأكيد الطلب...' : 'تأكيد الطلب والشحن للمنزل'}</span>
            <CheckCircle2 className="w-4 h-4 text-slate-950" />
          </button>
        </div>
      </form>
    </div>
  );
}
