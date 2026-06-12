window.OTAKKOS_SUPABASE = {
  url: "https://qkzguilcjkxyipvaduco.supabase.co",
  publishableKey: "sb_publishable_tR5x3_WodvI1GYWfTtIPmw_lxvlPUr1",
  settingsId: "main",
  uploadsBucket: "site-uploads",
  adminEmail: "admin@otakkos.com",
};

window.otakkosSupabaseClient = window.supabase?.createClient(
  window.OTAKKOS_SUPABASE.url,
  window.OTAKKOS_SUPABASE.publishableKey
);
