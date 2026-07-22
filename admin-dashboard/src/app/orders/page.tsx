'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { ShoppingBag, Search, Filter, Eye, Clock, CheckCircle2, DollarSign, X } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/orders');
      setOrders(data.data ?? (Array.isArray(data) ? data : []));
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة طلبات المبيعات (OMS)</h1>
            <p className="text-sm text-slate-500 mt-1">متابعة مسار معالجة الطلبات، الفواتير، وحالات الدفع المعزولة برقم المستأجر.</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث برقم الطلب (مثال: ORD-2026-001)..."
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors">
            <Filter className="w-4 h-4" />
            <span>تصفية بالحالة</span>
          </button>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">جاري تحميل سجل الطلبات...</div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">لا توجد طلبات مبيعات مسجلة حالياً لهاتين المؤسستين.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">رقم الطلب</th>
                    <th className="py-4">حالة الطلب</th>
                    <th className="py-4">المبلغ الفرعي</th>
                    <th className="py-4">الضريبة</th>
                    <th className="py-4">المبلغ الإجمالي</th>
                    <th className="py-4">تاريخ الطلب</th>
                    <th className="py-4 pl-6 text-center">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <ShoppingBag className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{order.orderNumber}</h4>
                            <p className="text-xs text-slate-400 font-mono">ID: {order.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200/60">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{order.status}</span>
                        </span>
                      </td>
                      <td className="py-4 text-slate-700">{Number(order.subtotal).toLocaleString()} ر.س</td>
                      <td className="py-4 text-slate-500">{Number(order.taxTotal).toLocaleString()} ر.س</td>
                      <td className="py-4 font-bold text-slate-900">{Number(order.grandTotal).toLocaleString()} ر.س</td>
                      <td className="py-4 text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="py-4 pl-6 text-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">تفاصيل الطلب: {selectedOrder.orderNumber}</h3>
                  <p className="text-xs text-slate-500 font-mono">معرف الطلب: {selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block mb-1">المبلغ الإجمالي</span>
                    <span className="text-lg font-black text-slate-900">{Number(selectedOrder.grandTotal).toLocaleString()} ر.س</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold block mb-1">حالة الطلب الحالية</span>
                    <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>

                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-2">عناصر الطلب ({selectedOrder.items.length})</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="p-2.5">المتغير Variant</th>
                            <th className="p-2.5">السعر الفردي</th>
                            <th className="p-2.5">الكمية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedOrder.items.map((item: any) => (
                            <tr key={item.id}>
                              <td className="p-2.5 font-mono text-indigo-600 font-bold">{item.variantId}</td>
                              <td className="p-2.5">{Number(item.priceUnit).toLocaleString()} ر.س</td>
                              <td className="p-2.5 font-bold">{item.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm"
                >
                  إغلاق Window
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
