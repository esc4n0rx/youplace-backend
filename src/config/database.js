const { createClient } = require('@supabase/supabase-js');
const { supabase: config } = require('./environment');

if (!config.url || !config.serviceKey) {
  throw new Error('Missing Supabase configuration. Check your environment variables.');
}

// Client para operações administrativas (service key)
const supabaseAdmin = createClient(config.url, config.serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Client para operações públicas (anon key)
const supabaseClient = createClient(config.url, config.anonKey);

module.exports = {
  supabaseAdmin,
  supabaseClient
};