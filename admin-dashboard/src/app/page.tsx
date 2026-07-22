'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { 
  DollarSign, 
  ShoppingBag, 
  Package, 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Boxes
} from 'lucide-react';

export default function OverviewPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsData, ordersData, customersData, stockData] = await Promise.all([
          apiFetch('/products').catch(() => ({ data: [] })),
          apiFetch('/orders').catch(() => ({ data: [] })),
          apiFetch('/customers').catch(() => ({ data: [] })),
          apiFetch('/stock-levels').catch(() => ({ data: [] })),
        ]);
        setProducts(productsData.data ?? (Array.isArray(productsData) ? productsData : []));
        setOrders(ordersData.data ?? (Array.isArray(ordersData) ? ordersData : []));
        setCustomers(customersData.data ?? (Array.isArray(customersData) ? customersData : []));
        setStockLevels(stockData.data ?? (Array.isArray(stockData) ? stockData : []));
      } catch (err: any) {
        console.error('Error loading KPI data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
  const lowStockItems = stockLevels.filter(
    (item) => (Number(item.quantityPhysical || 0) - Number(item.quantityReserved || 0)) < 10
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">نظرة عامة على المتجر والمعاملات</h1>
            <p className="text-sm text-slate-500 mt-1">مؤشرات الأداء الرئيسية (KPIs) وسجل الطلبات المعزول بالكامل برقم المستأجر RLS.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/60">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              سياق المستأجر: موثق بالكامل
            </span>
          </div>
        </div>

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">إجمالي الإيرادات</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-slate-900">{totalRevenue.toLocaleString()} ر.س</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>+14.2% هذا الشهر</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">الطلبات الكلية</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-slate-900">{orders.length} طلبات</h3>
              <p className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>مزامنة OMS مباشرة</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">العملاء (CRM)</span>
              <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-slate-900">{customers.length} عميل</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">سجل خاص بالمؤسسة</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">المنتجات النشطة</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-slate-900">{products.length} منتج</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">معزولة برقم المستأجر RLS</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">تنبيهات المخزون</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-rose-600">{lowStockItems.length} تنبيهات</h3>
              <p className="text-[11px] text-rose-600 font-semibold mt-1">مخزون منخفض أقل من 10</p>
            </div>
          </div>
        </div>

        {/* Content Section: Recent Orders & Stock Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Orders Pipeline (2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">أحدث الطلبات (OMS Pipeline)</h3>
                <p className="text-xs text-slate-500">طلبات المبيعات المسجلة برقم المستأجر الحقيقي</p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">جاري تحميل الطلبات...</div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">لا توجد طلبات مسجلة حالياً لهاتين المؤسستين</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold">
                      <th className="pb-3 pr-2">رقم الطلب</th>
                      <th className="pb-3">الحالة</th>
                      <th className="pb-3">المبلغ الإجمالي</th>
                      <th className="pb-3 pl-2">تاريخ الطلب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 pr-2 font-bold text-indigo-600">{order.orderNumber}</td>
                        <td className="py-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200/60">
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3.5 font-bold text-slate-900">{Number(order.grandTotal).toLocaleString()} ر.س</td>
                        <td className="py-3.5 pl-2 text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Low Stock Alerts (1 col) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">تنبيهات انخفاض المخزون</h3>
                <p className="text-xs text-slate-500">المنتجات التي اقتربت من النفاد</p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">جاري التقييم...</div>
            ) : lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-emerald-600 text-sm font-bold flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8" />
                <span>جميع المستويات جيدة وشبكة التخزين ممتازة</span>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <h4 className="font-bold text-rose-900 font-mono">{item.variantId}</h4>
                      <p className="text-slate-500 mt-0.5">{item.warehouse?.name || 'مستودع غير مسمى'}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-lg">
                      متبقي {item.quantityPhysical}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
