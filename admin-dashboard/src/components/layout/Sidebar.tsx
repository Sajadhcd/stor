'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  Boxes, 
  ShoppingBag, 
  Users, 
  CreditCard,
  Truck,
  BarChart3, 
  Settings, 
  Store,
  Warehouse,
  UserCheck,
  ShieldAlert,
  Server,
  Activity,
  Layers,
  FolderTree,
  LogOut 
} from 'lucide-react';
import { clearSession, getSession } from '@/lib/auth';

const merchantNavItems = [
  { name: 'لوحة التحكم', href: '/', icon: LayoutDashboard },
  { name: 'إدارة المنتجات', href: '/products', icon: Package },
  { name: 'إدارة التصنيفات', href: '/categories', icon: FolderTree },
  { name: 'إدارة المخزون', href: '/inventory', icon: Boxes },
  { name: 'المستودعات', href: '/warehouses', icon: Warehouse },
  { name: 'إدارة الطلبات', href: '/orders', icon: ShoppingBag },
  { name: 'إدارة العملاء CRM', href: '/customers', icon: Users },
  { name: 'المدفوعات والمعاملات', href: '/payments', icon: CreditCard },
  { name: 'الشحن واللوجستيات', href: '/shipments', icon: Truck },
  { name: 'فريق العمل والصلوحيات', href: '/users', icon: UserCheck },
  { name: 'المتاجر والعملات', href: '/stores', icon: Store },
  { name: 'التقارير وسجلات الأمان', href: '/reports', icon: BarChart3 },
  { name: 'إعدادات المنصة', href: '/settings', icon: Settings },
];

const platformAdminItems = [
  { name: 'نظرة عامة على المنصة', href: '/platform', icon: Activity },
  { name: 'إدارة المستأجرين (Tenants)', href: '/platform/tenants', icon: Layers },
  { name: 'الباقات والاشتراكات', href: '/platform/subscriptions', icon: CreditCard },
  { name: 'تحليلات المنصة SaaS', href: '/platform/analytics', icon: BarChart3 },
  { name: 'مراقبة النظام والبيئة', href: '/platform/system', icon: Server },
];

export function Sidebar() {
  const pathname = usePathname();
  const isPlatformAdmin = getSession()?.role === 'platform_admin';

  const handleLogout = () => {
    clearSession();
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0 border-l border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/30">
          <Store className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white tracking-wide">Nexio Commerce</h1>
          <p className="text-xs text-indigo-400 font-medium">Enterprise SaaS Console</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Merchant Section */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-3">لوحة التحكم للتاجر</h3>
          <div className="space-y-1">
            {merchantNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Super Admin Section */}
        {isPlatformAdmin && <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2 px-3 flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3" />
            <span>Super Admin Platform</span>
          </h3>
          <div className="space-y-1">
            {platformAdminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold'
                      : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>}
      </nav>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
