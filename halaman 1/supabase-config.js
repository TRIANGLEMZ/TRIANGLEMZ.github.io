window.PORTFOLIO_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};

window.createPortfolioSupabaseClient = function () {
  const { url, anonKey } = window.PORTFOLIO_SUPABASE_CONFIG;
  if (!window.supabase || url.includes("YOUR_PROJECT_ID") || anonKey.includes("YOUR_")) {
    return null;
  }

  return window.supabase.createClient(url, anonKey);
};
