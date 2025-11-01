
export const ENV = {
  // Fill these with your actual keys
  SUPABASE_URL: 'https://sgsogihufhdralahfirp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnc29naWh1ZmhkcmFsYWhmaXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjU4MzIsImV4cCI6MjA3NTc0MTgzMn0.0IudVlUkJwfXXBlLUxpV0OnHp7VgQGBrUALOZhF04to',

  FEATURES: {
    REALTIME: true,
    CHARTS: true,
  },

  UI: {
    DEFAULT_SYMBOL: 'RELIANCE',
    CURRENCY: '₹',
  },

  ENGINE: {
    // ===== Timing =====
    DEFAULT_TICK_MS: 3000,      // refresh every 3s

    // ===== Normal fluctuation (ultra low) =====
    VOL_SCALE: 0.02,            // 98% reduction of per-stock vol
    NOISE_MULT: 0.12,           // small gaussian amplitude
    MAX_SINGLE_TICK_PCT: 0.0015,// ±0.15% per 3s hard cap (normal mode only)

    // ===== Trajectory bias (gentle slope per tick) =====
    BIAS_PCT: 0.0006,           // ≈ ±0.06% per 3s for UP/DOWN

    // ===== Target glide =====
    // While a target is active we follow a time-based smooth curve EXACTLY,
    // with zero random noise and no clamp. This guarantees on-time arrival.
    GUIDE_EASING: 'smoothstep', // (kept for clarity; only smoothstep is used)
  }
};
