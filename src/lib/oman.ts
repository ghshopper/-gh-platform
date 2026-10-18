/** Oman's governorates (same list as the previous app's address form). */
export const GOVERNORATES: { ar: string; en: string }[] = [
  { ar: 'مسقط', en: 'Muscat' },
  { ar: 'شمال الباطنة', en: 'North Al Batinah' },
  { ar: 'جنوب الباطنة', en: 'South Al Batinah' },
  { ar: 'الداخلية', en: 'Ad Dakhiliyah' },
  { ar: 'شمال الشرقية', en: 'North Ash Sharqiyah' },
  { ar: 'جنوب الشرقية', en: 'South Ash Sharqiyah' },
  { ar: 'الظاهرة', en: 'Ad Dhahirah' },
  { ar: 'البريمي', en: 'Al Buraimi' },
  { ar: 'الوسطى', en: 'Al Wusta' },
  { ar: 'ظفار', en: 'Dhofar' },
  { ar: 'مسندم', en: 'Musandam' },
];

export type Carrier = 'own' | 'nool' | 'genacom';

/** Server key for the delivery method (matches the admin app). */
export function deliveryKey(carrier: Carrier, branch: boolean): string {
  if (carrier === 'own') return 'home';
  return branch ? `${carrier}_office` : carrier;
}
