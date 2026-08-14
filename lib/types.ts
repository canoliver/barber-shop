export type UserRole = 'admin' | 'barber' | 'receptionist' | 'client';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentSource = 'manual' | 'link' | 'walk_in';

export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'mixed';

export type DiscountType = 'percentage' | 'fixed';

export type SaleItemType = 'service' | 'product';

export type MovementType = 'entry' | 'exit' | 'adjustment' | 'sale';

export type TransactionType = 'income' | 'expense';

export type CashStatus = 'open' | 'closed';

export type RewardType = 'discount' | 'free_service' | 'product';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  birth_date: string | null;
  notes: string;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
  is_active: boolean;
  image_url: string;
  created_at: string;
}

export interface Collaborator {
  id: string;
  profile_id: string | null;
  full_name: string;
  phone: string;
  email: string;
  nickname: string;
  specialty: string;
  commission_percentage: number;
  work_days: string[];
  work_hours_start: string;
  work_hours_end: string;
  break_start: string | null;
  break_end: string | null;
  is_active: boolean;
  avatar_url: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  sku: string;
  barcode: string;
  cost_price: number;
  selling_price: number;
  image_url: string;
  is_active: boolean;
  created_at: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  location: string;
  updated_at: string;
  product?: Product;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  performed_by: string | null;
  created_at: string;
  product?: Product;
}

export interface Appointment {
  id: string;
  client_id: string | null;
  collaborator_id: string | null;
  service_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string;
  source: AppointmentSource;
  client_name: string;
  client_phone: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  collaborator?: Collaborator;
  service?: Service;
}

export interface Sale {
  id: string;
  appointment_id: string | null;
  client_id: string | null;
  collaborator_id: string | null;
  payment_method: PaymentMethod;
  subtotal: number;
  discount_amount: number;
  discount_type: DiscountType;
  total_amount: number;
  notes: string;
  created_by: string | null;
  created_at: string;
  client?: Client;
  collaborator?: Collaborator;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_type: SaleItemType;
  service_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  service?: Service;
  product?: Product;
}

export interface Commission {
  id: string;
  collaborator_id: string;
  sale_id: string;
  appointment_id: string | null;
  commission_percentage: number;
  commission_amount: number;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
  collaborator?: Collaborator;
  sale?: Sale;
}

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  payment_method: PaymentMethod | null;
  reference_id: string | null;
  reference_type: string;
  date: string;
  created_by: string | null;
  created_at: string;
}

export interface CashRegister {
  id: string;
  opened_by: string;
  closed_by: string | null;
  opening_balance: number;
  closing_balance: number | null;
  total_income: number;
  total_expenses: number;
  status: CashStatus;
  opened_at: string;
  closed_at: string | null;
  notes: string;
}

export interface BookingLink {
  id: string;
  collaborator_id: string;
  slug: string;
  is_active: boolean;
  custom_message: string;
  created_at: string;
  collaborator?: Collaborator;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  points_required: number;
  reward_type: RewardType;
  reward_value: number;
  is_active: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface Settings {
  id: number;
  shop_name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  cnpj: string;
  opening_time: string;
  closing_time: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  slot_interval_minutes: number;
  allow_online_booking: boolean;
  max_advance_booking_days: number;
  cancellation_policy: string;
  email_notifications: boolean;
  loyalty_enabled: boolean;
  points_per_real: number;
  created_at: string;
  updated_at: string;
}

export interface Database {
  profiles: Profile;
  clients: Client;
  services: Service;
  collaborators: Collaborator;
  products: Product;
  inventory: Inventory;
  inventory_movements: InventoryMovement;
  appointments: Appointment;
  sales: Sale;
  sale_items: SaleItem;
  commissions: Commission;
  financial_transactions: FinancialTransaction;
  cash_register: CashRegister;
  booking_links: BookingLink;
  loyalty_rewards: LoyaltyReward;
  notifications: Notification;
  settings: Settings;
}
