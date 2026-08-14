'use client';

import { Scissors } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type BrandData = { shop_name: string; logo_url: string };

export function useBrand() {
  return useQuery<BrandData>({
    queryKey: ['public-brand'],
    queryFn: async () => {
      const response = await fetch('/api/brand', { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível carregar a marca.');
      return response.json();
    },
    staleTime: 0,
  });
}

export function BrandLogo({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  const { data } = useBrand();

  if (data?.logo_url) {
    return <img src={data.logo_url} alt={`Logo ${data.shop_name || 'da barbearia'}`} className={cn('object-contain', className)} />;
  }

  return (
    <div className={cn('gold-gradient flex items-center justify-center gold-glow', className)}>
      <Scissors className={cn('text-charcoal', iconClassName)} />
    </div>
  );
}

export function BrandName({ className }: { className?: string }) {
  const { data } = useBrand();
  return <span className={className}>{data?.shop_name || 'BarberPro'}</span>;
}