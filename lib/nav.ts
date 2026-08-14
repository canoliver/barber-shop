import {
  LayoutDashboard, Calendar, Users, UserCircle, Scissors, Package,
  Boxes, ShoppingCart, DollarSign, Wallet, BarChart3, Gift, Link2,
  Bell, Settings, TrendingUp,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

export const navItems: NavItem[] = [
  { label: 'Painel', href: '/app', icon: LayoutDashboard, roles: ['admin', 'barber', 'receptionist'] },
  { label: 'Agendamentos', href: '/app/appointments', icon: Calendar, roles: ['admin', 'receptionist'] },
  { label: 'Minha Agenda', href: '/app/my-schedule', icon: Calendar, roles: ['barber'] },
  { label: 'Clientes', href: '/app/clients', icon: Users, roles: ['admin', 'receptionist'] },
  { label: 'Colaboradores', href: '/app/collaborators', icon: UserCircle, roles: ['admin'] },
  { label: 'Serviços', href: '/app/services', icon: Scissors, roles: ['admin'] },
  { label: 'Produtos', href: '/app/products', icon: Package, roles: ['admin'] },
  { label: 'Estoque', href: '/app/inventory', icon: Boxes, roles: ['admin'] },
  { label: 'Vendas (PDV)', href: '/app/pos', icon: ShoppingCart, roles: ['admin', 'receptionist'] },
  { label: 'Caixa', href: '/app/cash-register', icon: Wallet, roles: ['admin', 'receptionist'] },
  { label: 'Financeiro', href: '/app/financial', icon: DollarSign, roles: ['admin'] },
  { label: 'Comissões', href: '/app/commissions', icon: TrendingUp, roles: ['admin', 'barber'] },
  { label: 'Minhas Comissões', href: '/app/my-commissions', icon: TrendingUp, roles: ['barber'] },
  { label: 'Fidelidade', href: '/app/loyalty', icon: Gift, roles: ['admin'] },
  { label: 'Relatórios', href: '/app/reports', icon: BarChart3, roles: ['admin'] },
  { label: 'Links de Agendamento', href: '/app/booking-links', icon: Link2, roles: ['admin'] },
  { label: 'Meu Link', href: '/app/my-link', icon: Link2, roles: ['barber'] },
  { label: 'Notificações', href: '/app/notifications', icon: Bell, roles: ['admin', 'barber', 'receptionist'] },
  { label: 'Configurações', href: '/app/settings', icon: Settings, roles: ['admin'] },
  { label: 'Meu Perfil', href: '/app/profile', icon: UserCircle, roles: ['admin', 'barber', 'receptionist'] },
];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role));
}
