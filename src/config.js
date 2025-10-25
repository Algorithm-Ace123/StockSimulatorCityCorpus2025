
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
    DEFAULT_TICK_MS: 5000, // 5s
    VOL_SCALE: 0.30,       // 70% reduction in normal jiggle (multiply per-stock vol)
    TREND_DRIFT: 0.0015,   // ≈ +0.15%/tick for UP, -0.15% for DOWN
    DIP_PROB_UP: 0.18,     // UP: occasional small dip probability
    DIP_PROB_DOWN: 0.18,   // DOWN: occasional small pop probability
    DIP_MULT: 1.2          // dip/pop size multiplier
  }
};
