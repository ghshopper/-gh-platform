/// Supabase connection (project "mspa"; GH data lives in the gh_* tables).
/// The publishable key is safe to ship in the app: every gh_* table is
/// protected by row-level security tied to the signed-in user.
class AppConfig {
  static const supabaseUrl = 'https://pjrkwzmyhjmsukdcygik.supabase.co';
  static const supabaseAnonKey = 'sb_publishable_SKNNfswdPLbwj0BymUf-yQ_UVwnzANY';

  /// Public order-tracking page; the order's secret token is appended.
  static const trackingBaseUrl = 'https://gh-track-gh-2f22.vercel.app/?t=';
}
