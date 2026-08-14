export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${h}:${m}`;
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function maskCurrency(value: string): string {
  const digits = value.replace(/\D/g, '');
  const num = parseInt(digits || '0', 10) / 100;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrency(value: string): number {
  const clean = value.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

export function getMonthName(month: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return months[month] || '';
}

export function getWeekdayName(day: number, short = false): string {
  const long = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const shortNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return short ? shortNames[day] : long[day];
}

export function getWeekdayShort(day: string): string {
  const map: Record<string, string> = {
    '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb',
  };
  return map[day] || '';
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getCollaboratorColor(id: string): string {
  const colors = [
    '#D4A843', '#C47F17', '#E8B558', '#A06B12', '#F0C674',
    '#8B5E12', '#D9A52F', '#B8860B', '#CD853F', '#DAA520',
  '#B8860B', '#FFB347', '#D2691E', '#DEB887',
  '#D4A017', '#C19A6B', '#DAA520', '#BDB76B',
  '#D2691E', '#CD853F',
  '#E8B558', '#C0A062', '#D4A843', '#C47F17',
  '#F0C674', '#A06B12', '#D9A52F', '#B8860B',
  '#CD853F', '#DAA520',
  '#B8860B', '#FFB347', '#D2691E', '#DEB887',
    '#D4A017', '#C19A6B', '#DAA520', '#BDB76B',
    '#D2691E', '#CD853F',
    '#E8B558', '#C0A062', '#D4A843', '#C47F17',
    '#F0C674', '#A06B12', '#D9A52F', '#B8860B',
    '#CD853F', '#DAA520',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getAppointmentStatusLabel(status: AppointmentStatus): string {
  const labels: Record<AppointmentStatus, string> = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    in_progress: 'Em Andamento',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    no_show: 'Não Compareceu',
  };
  return labels[status] || status;
}

export function getAppointmentStatusColor(status: AppointmentStatus): string {
  const colors: Record<AppointmentStatus, string> = {
    scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    confirmed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
    no_show: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  };
  return colors[status] || colors.scheduled;
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    cash: 'Dinheiro',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    pix: 'PIX',
    mixed: 'Misto',
  };
  return labels[method] || method;
}

export function getMovementTypeLabel(type: MovementType): string {
  const labels: Record<MovementType, string> = {
    entry: 'Entrada',
    exit: 'Saída',
    adjustment: 'Ajuste',
    sale: 'Venda',
  };
  return labels[type] || type;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrador',
    barber: 'Barbeiro',
    receptionist: 'Recepcionista',
    client: 'Cliente',
  };
  return labels[role] || role;
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    admin: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    barber: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    receptionist: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    client: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };
  return colors[role] || colors.barber;
}

export function getRewardTypeLabel(type: RewardType): string {
  const labels: Record<RewardType, string> = {
    discount: 'Desconto',
    free_service: 'Serviço Grátis',
    product: 'Produto Grátis',
  };
  return labels[type] || type;
}

import type {
  AppointmentStatus,
  PaymentMethod,
  MovementType,
  UserRole,
  RewardType,
} from './types';
