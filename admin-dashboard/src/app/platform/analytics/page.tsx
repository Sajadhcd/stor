'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { BarChart3, TrendingUp, DollarSign, Layers, Users, ShoppingBag } from 'lucide-react';

export default function PlatformAnalyticsPage() {
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [revData, usageData] = await Promise.all([
          apiFetch('/platform/analytics/revenue').catch(() => []),
          apiFetch('/platform/analytics/usage').catch(() => []),
        ]);
        setRevenueChart(revData);
        setUsageStats(usageData);
      } catch (err: any) {
        console.error('Failed to load platform analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">تحليلات المنصة والأداء المالي SaaS Analytics</h1>
            <p className="text-sm text-slate-500 mt-1">تقارير نمو الإيرادات الشهرية وإحصائيات الاستهلاك لكل مستأجر على مستوى الكتل المدمجة.</p>
          </div>
        </div>

        {/* Section 1: Revenue Growth Chart Simulator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>منحنى نمو الإيرادات الشهري للمنصة (Monthly Revenue Growth)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">إجمالي الإيرادات المجمعة من كافة المتاجر بالريال السعودي</p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
              +18.5% نمو مركّب
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 py-4">
            {revenueChart.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                <span className="text-xs font-bold text-slate-500">{item.month}</span>
                <h4 className="text-lg font-black text-slate-900 mt-1">{item.revenue.toLocaleString()} ر.س</h4>
                <div className="w-full bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, (item.revenue / 150000) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Tenant Usage Performance */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">استهلاك الموارد حسب المستأجر (Tenant Usage Stats)</h2>
          </div>
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">جاري جلب بيانات الاستهلاك...</div>
          ) : usageStats.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">لا توجد بيانات استهلاك مسجلة حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 pr-6">اسم المستأجر</th>
                    <th className="py-4">المستخدمين المسجلين</th>
                    <th className="py-4">كتالوج المنتجات</th>
                    <th className="py-4 pl-6 text-center">إجمالي الطلبات المنفذة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {usageStats.map((u) => (
                    <tr key={u.tenantId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 pr-6 font-bold text-slate-900">{u.tenantName}</td>
                      <td className="py-4 text-slate-600 font-bold">{u.usersCount} مستخدمين</td>
                      <td className="py-4 text-slate-600 font-bold">{u.productsCount} منتج</td>
                      <td className="py-4 pl-6 text-center font-bold text-indigo-600">{u.ordersCount} طلبات</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
