// Public config & feature flags.
// TODO: paste your Supabase project URL & anon key before running.
export const ENV = {
  SUPABASE_URL: 'https://sgsogihufhdralahfirp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnc29naWh1ZmhkcmFsYWhmaXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjU4MzIsImV4cCI6MjA3NTc0MTgzMn0.0IudVlUkJwfXXBlLUxpV0OnHp7VgQGBrUALOZhF04to',
  FEATURES: {
    REALTIME: true,          // enable live price updates
    CHARTS: true,            // enable charts on Trader page
  },
  UI: {
    DEFAULT_SYMBOL: 'ABX',
    CURRENCY: '₹',           // change if needed
  },
};
