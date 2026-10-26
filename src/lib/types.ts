export type Lang = 'ar' | 'en';

export interface AttributeValue {
  id: number;
  value_ar?: string | null;
  value_en?: string | null;
  color_code?: string | null;
  image?: string | null;
  /** Extra price in OMR when this option is chosen (e.g. a gold case). */
  price_add?: number | string | null;
}

export interface ProductAttribute {
  name_ar?: string | null;
  name_en?: string | null;
  type?: string | null;
  is_selectable?: boolean;
  /** type "engraving": the customer types a text (optional unless required). */
  required?: boolean;
  max_length?: number;
  values?: AttributeValue[];
}

export interface Product {
  /** New piece in the top tier's early-access window (only they see it). */
  vip_early?: boolean;
  badge?: string | null;
  badge_en?: string | null;
  /** ×N loyalty points on this piece for now (every customer). */
  points_boost?: number | null;
  points_boost_ends_at?: string | null;
  id: number;
  name_ar?: string | null;
  name_en?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  price: number | string;
  compare_price?: number | string | null;
  sale_price?: number | string | null;
  discount_expires_at?: string | null;
  availability?: 'instant' | 'on_order' | string | null;
  stock_quantity?: number | null;
  primary_image?: string | null;
  gallery_images?: string | string[] | null;
  attributes?: string | ProductAttribute[] | null;
  size_guide_image?: string | null;
  video_url?: string | null;
  delivery_badge?: string | null;
  brand_id?: number | null;
  brand_name?: string | null;
  brand_name_en?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  reviews_count?: number | string | null;
  reviews_avg_rating?: number | string | null;
  is_featured?: number | boolean;
  images?: { image_path: string }[];
  group_key?: string | null;
  gender?: 'women' | 'men' | 'unisex' | null;
  origin?: 'oman' | 'dubai' | 'europe' | null;
  variant_ar?: string | null;
  variant_en?: string | null;
  /** Same piece in other colours, each its own product (product page only). */
  variants?: ProductVariant[];
  /** Approved reviews (computed by the server). */
  rating_avg?: number | string | null;
  rating_count?: number | string | null;
  /** Signed-in customer asked "notify me when available". */
  watching?: boolean;
}

export interface ProductVariant {
  id: number;
  variant_ar?: string | null;
  variant_en?: string | null;
  variant_hex?: string | null;
  variant_image?: string | null;
  primary_image?: string | null;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface Category {
  id: number;
  parent_id?: number | null;
  name_ar?: string | null;
  name_en?: string | null;
  image?: string | null;
  icon?: string | null;
  children?: Category[];
}

export interface Brand {
  id: number;
  name_ar?: string | null;
  name_en?: string | null;
  logo?: string | null;
  banner?: string | null;
}

export interface HeroSlide {
  id: number;
  title_ar?: string | null;
  title_en?: string | null;
  subtitle_ar?: string | null;
  subtitle_en?: string | null;
  button_text_ar?: string | null;
  button_text_en?: string | null;
  full_image_url?: string | null;
  link_type?: string | null;
  link_value?: string | null;
}

export interface SectionSetting {
  section_key: string;
  title_ar?: string | null;
  title_en?: string | null;
  action_text_ar?: string | null;
  action_text_en?: string | null;
  items_count?: number | null;
  is_active?: number | boolean;
  card_settings?: Record<string, unknown> | null;
}

export interface HomeConfig {
  hero_slides: HeroSlide[];
  logo_url?: string | null;
  sections: Record<string, SectionSetting>;
  /** Section keys in the order the dashboard set (top first). */
  section_order?: string[];
  /** The bar above the header; null = switched off. */
  announcement?: { text_ar?: string | null; text_en?: string | null; link?: string | null } | null;
  /** Same object as GET /app/features. */
  features?: Partial<FeatureFlags> | null;
}

export interface FooterSettings {
  description_ar?: string | null;
  description_en?: string | null;
  email?: string | null;
  phone?: string | null;
  address_ar?: string | null;
  address_en?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  snapchat?: string | null;
  twitter?: string | null;
  facebook?: string | null;
}

export interface User {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  loyalty_points?: number | string | null;
  loyalty_tier?: string | null;
  birth_date?: string | null;
}

export interface Address {
  id: number;
  title?: string | null;
  recipient_name: string;
  phone: string;
  country: string;
  governorate?: string | null;
  city: string;
  street?: string | null;
  building?: string | null;
  address_line?: string | null;
  details?: string | null;
  is_default?: boolean | number;
}

export interface CartItem {
  key: string; // product id + chosen options
  productId: number;
  name: string;
  nameEn?: string | null;
  brand: string;
  price: number;
  comparePrice?: number | null;
  image: string;
  options: { label: string; value: string }[];
  quantity: number;
  /** Where it ships from, for the delivery time. */
  origin?: import('./eta').Origin;
}

export interface PaymentGateway {
  id: number;
  name: string;
  code: string;
  subtitle?: string | null;
  icon?: string | null;
  extra_fee?: number | string | null;
  allowed_countries?: string[] | null;
}

export interface ShippingRegion {
  id: number;
  name_ar: string;
  name_en: string;
  shipping_cost: number | string;
  estimated_delivery_time?: string | null;
}

export interface ShippingCountry {
  id: number;
  name: string;
  code: string;
  currency_code: string;
  currency_symbol: string;
  shipping_cost: number | string;
  estimated_delivery_time?: string | null;
  regions: ShippingRegion[];
}

export interface DeliveryOptions {
  branches?: import('./genacom').GenacomBranch[];
  home_fee: number;
  branch_fee: number;
  /** Delivery time per origin (Oman / Dubai / Europe), set in the admin app. */
  eta?: import('./eta').EtaTable;
  /** Gulf shipping (prices shown in their currency, paid in OMR). */
  gcc?: import('./region').GccConfig;
}

/** One order as the customer sees it (from /ps/my-orders). */
export interface MyOrder {
  id: string;
  order_no: number;
  invoice_no: string;
  created_at: string;
  status: 'requested' | 'purchased' | 'arrived' | 'out_for_delivery' | 'delivered';
  delivered_at?: string | null;
  delivery_method?: string | null;
  carrier_tracking?: string | null;
  tracking_token?: string | null;
  store_order_number?: string | null;
  driver?: { name: string; phone?: string | null } | null;
  discount?: number | null;
  discount_label?: string | null;
  tax?: number | null;
  items: {
    brand?: string | null;
    name: string;
    details?: string | null;
    price: number;
    status: string;
    photo_url?: string | null;
    receipt_url?: string | null;
  }[];
  /** Gift details, when the order was sent as a gift. */
  gift?: { to?: string | null; phone?: string | null; message?: string | null; wrap?: boolean; hide_prices?: boolean } | null;
  items_total: number;
  delivery_fee: number;
  total: number;
  paid: number;
  remaining: number;
  pay_url?: string | null;
  payments: { amount: number; paid_on?: string | null }[];
  events: { type: string; at?: string | null }[];
}

export interface MyOrdersResponse {
  customer: { name: string; phone?: string | null };
  company: {
    name?: string | null;
    name_en?: string | null;
    cr_number?: string | null;
    tax_number?: string | null;
    phone?: string | null;
    instagram?: string | null;
    address?: string | null;
    bank_details?: string | null;
    invoice_note?: string | null;
  };
  portal_url?: string | null;
  orders: MyOrder[];
}

export interface AppNotification {
  id: number;
  title_ar?: string | null;
  title_en?: string | null;
  body_ar?: string | null;
  body_en?: string | null;
  read_at?: string | null;
  created_at?: string | null;
}

export interface LoyaltyTier {
  id: number;
  name_ar?: string | null;
  name_en?: string | null;
  min_points: number | string;
}

export interface Policy {
  id: number;
  type: string;
  title_ar?: string | null;
  title_en?: string | null;
  content_ar?: string | null;
  content_en?: string | null;
}

/* ---------------- Owner-switchable customer features (GET /app/features) ---------------- */

export interface FeatureFlags {
  wishlist_alerts: { on: boolean };
  quotes: { on: boolean; expires_days?: number };
  smart_push: { on: boolean };
  wallet: { on: boolean; points_convert?: boolean; topup?: boolean; topup_min?: number; topup_max?: number };
  gifts: { on: boolean; wrap?: boolean; wrap_fee?: number };
  vip_progress: { on: boolean };
  purchase_photos: { on: boolean };
  reviews: { on: boolean; service?: boolean };
  chat: { on: boolean; welcome_ar?: string; welcome_en?: string; hours_ar?: string; hours_en?: string };
  weekly_new: { on: boolean; days?: number; max?: number; title_ar?: string; title_en?: string; product_ids?: number[] };
}
export type FeatureKey = keyof FeatureFlags;

export interface AlertPrefs {
  price_drop: boolean;
  back_in_stock: boolean;
  brand_new: boolean;
}

export interface Quote {
  price: number;
  note?: string | null;
  deposit?: number | null;
  delivery_fee?: number | null;
  delivery_method?: string | null;
  total: number;
  status: 'sent' | 'accepted' | 'declined' | 'expired' | string;
  expires_at?: string | null;
  expired: boolean;
}

export interface PieceRequest {
  id: number;
  product_name?: string | null;
  brand?: string | null;
  details?: string | null;
  image_url?: string | null;
  product_url?: string | null;
  status: string;
  status_label_ar?: string | null;
  created_at?: string | null;
  quote: Quote | null;
  order: { id: string; pay_token?: string | null; pay_url?: string | null; invoice_no?: string | null; paid: boolean; total?: number } | null;
}

export interface WalletTx {
  id: number;
  type: string;
  type_label_ar?: string | null;
  amount: number;
  balance_after: number;
  note?: string | null;
  order_number?: string | null;
  created_at?: string | null;
}

export interface WalletInfo {
  balance: number;
  transactions: WalletTx[];
  points: number;
  point_value: number;
  points_convert: boolean;
  topup: boolean;
  topup_min: number;
  topup_max: number;
}

export interface TierInfo {
  id: number;
  name?: string | null;
  name_ar?: string | null;
  color?: string | null;
  benefits_ar?: string | null;
  benefits_en?: string | null;
  min_points: number | string;
}

export interface LoyaltyBalance {
  balance?: number;
  conversion_rate?: number;
  tier_points?: number;
  tier_id?: number | null;
  next_tier_id?: number | null;
  to_next?: number;
  tier?: TierInfo | null;
  next_tier?: TierInfo | null;
  progress?: number;
}

export interface ChatMessage {
  id: number;
  from: 'customer' | 'staff';
  body?: string | null;
  image_url?: string | null;
  ps_order?: { id: string; invoice_no?: string | null } | null;
  product?: { id: number; name?: string | null; image?: string | null } | null;
  created_at?: string | null;
  staff_name?: string | null;
}

export interface ChatResponse {
  thread?: { id: number; unread_customer?: number } | null;
  welcome?: string | null;
  hours?: string | null;
  messages: ChatMessage[];
}

export interface WeeklyProduct {
  id: number;
  name_ar?: string | null;
  name_en?: string | null;
  brand?: string | null;
  price: number | string;
  compare_price?: number | string | null;
  sale_price?: number | string | null;
  image?: string | null;
  images?: string[];
}

export interface ServiceReviewPending {
  ps_order_id?: string | null;
  order_id?: number | null;
  invoice_no?: string | null;
  delivered_at?: string | null;
}

export interface PublicServiceReviews {
  avg: number;
  count: number;
  data: { first_name?: string | null; rating: number; comment?: string | null; created_at?: string | null }[];
}
