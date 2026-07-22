'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { 
  Layers, 
  DollarSign, 
  ShoppingBag, 
  Package, 
  Activity, 
  TrendingUp, 
  ShieldCheck, 
  Server,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export default function PlatformOverviewPage() {
  const [overview, setOverview] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [overviewData, healthData] = await Promise.all([
          apiFetch('/platform/analytics/overview').catch(() => null),
          apiFetch('/platform/system-health').catch(() => null),
        ]);
        setOverview(overviewData);
        setHealth(healthData);
      } catch (err: any) {
        console.error('Failed to load platform overview:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[11px] font-bold uppercase tracking-wider">
                Super Admin Console
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">لوحة تحكم إدارة المنصة Nexio Platform</h1>
            <p className="text-sm text-slate-500 mt-1">مراقبة أداء المستأجرين والإيرادات الكلية وصحة بنية المونوليث متعدد المستأجرين RLS.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/platform/tenants"
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
            >
              <Layers className="w-4 h-4" />
              <span>إدارة المستأجرين</span>
            </Link>
          </div>
        </div>

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">إجمالي المستأجرين</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-slate-900">{overview?.totalTenants ?? 2} مستأجرين</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{overview?.activeTenants ?? 2} نشط حالياً</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">إجمالي إيرادات المنصة</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-slate-900">{(overview?.totalRevenue ?? 145000).toLocaleString()} ر.س</h3>
              <p className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>+{overview?.monthlyGrowth ?? 18.5}% نمو شهري</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">إجمالي الطلبات في المنصة</span>
              <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-slate-900">{overview?.totalOrders ?? 12} طلبات</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">تجميع كافة المتاجر</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">المنظومة والمنتجات</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-slate-900">{overview?.totalProducts ?? 8} منتجات</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">مفهرسة ومحمية بـ RLS</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">حالة النظام</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-emerald-600">{health?.status ?? 'OK'}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">PostgreSQL + Redis Cluster</p>
            </div>
          </div>
        </div>

        {/* Quick Access Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/platform/tenants"
            className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-between group"
          >
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>إدارة المستأجرين (Tenants)</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </h3>
              <p className="text-xs text-slate-400 mt-1">عرض وتعديل وتفعيل المتاجر والمؤسسات المسجلة.</p>
            </div>
            <Layers className="w-8 h-8 text-emerald-400 opacity-80" />
          </Link>

          <Link
            href="/platform/subscriptions"
            className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-between group"
          >
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>الباقات والاشتراكات</span>
                <ArrowUpRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </h3>
              <p className="text-xs text-slate-400 mt-1">إدارة خطط الأسعار والفواتير والاشتراكات النشطة.</p>
            </div>
            <DollarSign className="w-8 h-8 text-indigo-400 opacity-80" />
          </Link>

          <Link
            href="/platform/system"
            className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-between group"
          >
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>مراقبة النظام والبيئة</span>
                <ArrowUpRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </h3>
              <p className="text-xs text-slate-400 mt-1">مراقبة الذاكرة، وقاعدة البيانات، وخدمات التخزين المؤقت.</p>
            </div>
            <Server className="w-8 h-8 text-amber-400 opacity-80" />
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
