/// Server addresses.
class AppConfig {
  /// The GH Shopper server (Laravel on ghshopper.com).
  static const apiBaseUrl = 'https://ghshopper.com/api';

  /// Public order-tracking page; the order's secret token is appended.
  static const trackingBaseUrl = 'https://ghshopper.com/track/?t=';

  /// The old database (before moving to ghshopper.com). Only used once, by
  /// the "move my old data" screen.
  static const legacySupabaseUrl = 'https://pjrkwzmyhjmsukdcygik.supabase.co';
  static const legacySupabaseKey = 'sb_publishable_SKNNfswdPLbwj0BymUf-yQ_UVwnzANY';
}
