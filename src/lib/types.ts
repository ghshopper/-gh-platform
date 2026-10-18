export type Lang = 'ar' | 'en';

export interface AttributeValue {
  id: number;
  value_ar?: string | null;
  value_en?: string | null;
  color_code?: string | null;
}

export interface ProductAttribute {
  name_ar?: string | null;
  name_en?: string | null;
  type?: string | null;
  is_selectable?: boolean;
  values?: AttributeValue[];
}

export interface Product {
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
}

export interface User {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  loyalty_points?: number | string | null;
  loyalty_tier?: string | null;
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
  items_total: number;
  delivery_fee: number;
  total: number;
  paid: number;
  remaining: number;
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
