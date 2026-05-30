// Expõe ao Eleventy as env vars públicas necessárias ao admin SPA.
// As privadas (JWT secret, tokens) NUNCA aparecem no build — só vivem
// nas Functions onde process.env é seguro.
module.exports = function () {
  return {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  };
};
