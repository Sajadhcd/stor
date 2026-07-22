'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatIQD } from '@/lib/currency';
import { Search, Package, CheckCircle2, Clock, Truck, Home, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const initialOrderNumber = searchParams.get('orderNumber') || '';

  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!orderNumber || !phone) {
      setError('يرجى إدخال رقم الطلب ورقم الهاتف المستخدم عند الشراء.');
      return;
    }

    setLoading(true);
    setError('');
    setOrder(null);

    try {
      const found = await apiFetch(
        `/orders/track/public?orderNumber=${encodeURIComponent(orderNumber.trim())}&phone=${encodeURIComponent(phone.trim())}`,
      );
      setOrder(found);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب بيانات الطلب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderNumber) {
      handleTrack();
    }
  }, [initialOrderNumber]);

  const getTimelineStepIndex = (status: string) => {
    switch (status) {
      case 'DRAFT':
      case 'PENDING_PAYMENT':
        return 1;
      case 'PAID':
        return 2;
      case 'PROCESSING':
        return 3;
      case 'FULFILLED':
      case 'SHIPPED':
        return 4;
      case 'DELIVERED':
        return 5;
      default:
        return 1;
    }
  };

  const steps = [
    { title: 'تم إنشاء الطلب', icon: CheckCircle2, step: 1 },
    { title: 'تم تأكيد الدفع', icon: CheckCircle2, step: 2 },
    { title: 'جاري التجهيز', icon: Package, step: 3 },
    { title: 'خرج للتوصيل', icon: Truck, step: 4 },
    { title: 'تم التسليم بنجاح', icon: Home, step: 5 },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">نظام تتبع الشحنات المباشر (Order Tracking)</h1>
        <p className="text-sm text-slate-500">أدخل رقم الطلب أو رقم الهاتف المرفق بالطلب لمتابعة حالة الشحنة فوراً.</p>
      </div>

      {/* Track Input Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <input
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="أدخل رقم الطلب (مثال: ORD-IQ-123456)..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-right"
            />
          </div>

          <div className="flex-1 w-full">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الهاتف (اختياري)..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-right"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-2xl text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 text-slate-950" />}
            <span>تتبع الطلب</span>
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Order Status Display Card */}
      {order && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 md:p-8 space-y-8">
          {/* Order Details Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <span className="text-xs text-slate-400 block font-medium">رقم الطلب المستعلم عنه:</span>
              <h2 className="text-xl font-black text-emerald-600 font-mono mt-0.5">{order.orderNumber}</h2>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400 block font-medium">المبلغ الإجمالي المطلق:</span>
              <span className="text-xl font-black text-slate-900 block mt-0.5">{formatIQD(Number(order.grandTotal))}</span>
            </div>
          </div>

          {/* Timeline Visual Component */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">مسار الشحنة والتوصيل</h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 py-4">
              {steps.map((s) => {
                const Icon = s.icon;
                const currentStep = getTimelineStepIndex(order.status);
                const isCompleted = s.step <= currentStep;
                const isCurrent = s.step === currentStep;

                return (
                  <div
                    key={s.step}
                    className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center space-y-2 ${
                      isCompleted
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${isCompleted ? 'bg-emerald-600 text-slate-950' : 'bg-slate-200 text-slate-500'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">{s.title}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 bg-emerald-600 text-slate-950 rounded-md text-[10px] font-black animate-pulse">
                        الحالة الحالية
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shipping Address Summary */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">المحافظة والمدينة:</span>
              <span className="font-bold text-slate-900">
                {order.shippingAddress?.province || 'بغداد'} - {order.shippingAddress?.city || 'الكرخ'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">تاريخ إنشاء الطلب:</span>
              <span className="font-bold text-slate-900">{new Date(order.createdAt).toLocaleString('ar-IQ')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400 text-sm">جاري التجهيز...</div>}>
      <TrackOrderContent />
    </Suspense>
  );
}
