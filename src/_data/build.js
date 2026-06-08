// Versão de cache-busting dos assets — muda a cada build/deploy.
// O LiteSpeed serve /assets/*.css|js com Cache-Control de 30 dias, por isso
// sem um ?v= que mude o browser agarra-se à versão antiga e nunca revalida.
// Em CI usa o SHA do commit (determinístico); local cai para timestamp.
module.exports = () => ({
  version: process.env.ASSET_VERSION || String(Date.now()),
});
