'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Tag } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

interface BrandSelectorProps {
  value: string;
  onChange: (brandId: string) => void;
}

export function BrandSelector({ value, onChange }: BrandSelectorProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBrands() {
      try {
        const data = await apiFetch<Brand[]>('/brands');
        setBrands(data || []);
      } catch (err) {
        console.error('Failed to load brands:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBrands();
  }, []);

  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5 text-indigo-600" />
        <span>العلامة التجارية (Brand)</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
      >
        <option value="">-- بدون علامة تجارية --</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
