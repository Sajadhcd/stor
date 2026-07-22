'use client';

import { useEffect, useState } from 'react';
import { MapPin, ArrowRight, User, Phone, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function AccountProfilePage() {
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('بغداد');
  const [address, setAddress] = useState('الكرخ - شارع 14 رمضان');

  useEffect(() => {
    const saved = localStorage.getItem('nexio_customer_phone');
    if (saved) setPhone(saved);
  }, []);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Link href="/account" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-600">
        <ArrowRight className="w-4 h-4" />
        <span>العودة للوحة حساب العميل</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">الملف الشخصي والعناوين المحفوظة</h1>
        <p className="text-sm text-slate-500 mt-1">إدارة رقم الهاتف المحقق وعناوين التسليم المعتمدة في العراق.</p>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            <span>بيانات العميل المعتمدة</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">رقم الهاتف الأساسي:</span>
              <span className="font-mono font-bold text-slate-900 text-sm dir-ltr text-right block">{phone || 'غير مسجل'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">المحافظة الرئيسية للتسليم:</span>
              <span className="font-bold text-slate-900 text-sm block">{province}</span>
            </div>
            <div className="md:col-span-2">
              <span className="text-slate-400 block mb-1">العنوان التفصيلي:</span>
              <span className="font-bold text-slate-900 text-sm block">{address}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
