// Verifica que o request vem de um utilizador autenticado via Netlify Identity.
// O contexto é injetado automaticamente pela Netlify quando o frontend manda
// o JWT no header Authorization: Bearer <token>.
exports.checkAuth = (context) => {
  const cc = context && context.clientContext;
  if (!cc || !cc.user) {
    return { ok: false, error: "Sessão inválida ou expirada. Volta a entrar." };
  }
  return { ok: true, user: cc.user };
};
