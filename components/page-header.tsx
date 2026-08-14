'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8 animate-fade-in', className)}>
      <div>
        <h1 className="font-playfair text-3xl lg:text-[2.15rem] font-semibold tracking-[-0.04em] text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground text-sm mt-2 max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
