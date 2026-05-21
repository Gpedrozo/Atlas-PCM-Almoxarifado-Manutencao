/* =========================================================
   auth.js - Controle de acesso com sessao validada no servidor
   ========================================================= */

const Auth = (() => {
  const SESSION_KEY = 'atlas_session';
  let _sessao = null;

  function _persistir(sessao, lembrar) {
    _sessao = sessao || null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      if (_sessao) {
        const raw = JSON.stringify(_sessao);
        if (lembrar) localStorage.setItem(SESSION_KEY, raw);
        else sessionStorage.setItem(SESSION_KEY, raw);
      }
    } catch {}
  }

  function _carregarLocal() {
    if (_sessao) return _sessao;
    try {
      _sessao = JSON.parse(sessionStorage.getItem(SESSION_KEY))
        || JSON.parse(localStorage.getItem(SESSION_KEY))
        || null;
    } catch { _sessao = null; }
    return _sessao;
  }

  function setSessaoFromServer(usuario) {
    if (!usuario) return limparLocal();
    const sessao = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      nivel: usuario.nivel,
      loginEm: usuario.ultimoLoginEm || new Date().toISOString()
    };
    _persistir(sessao, !!localStorage.getItem(SESSION_KEY));
    return sessao;
  }

  function limparLocal() {
    _persistir(null, false);
  }

  async function login(email, senha, lembrar) {
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, lembrar: !!lembrar })
      });
      const data = await r.json().catch(function() { return {}; });
      if (!r.ok) return { ok: false, msg: data.error || 'Falha no login.' };
      setSessaoFromServer(data.usuario);
      if (lembrar) {
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(_sessao)); sessionStorage.removeItem(SESSION_KEY); } catch {}
      }
      return { ok: true, usuario: _sessao };
    } catch {
      return { ok: false, msg: 'Servidor não encontrado.' };
    }
  }

  async function me() {
    try {
      const r = await fetch('/api/me', { credentials: 'same-origin' });
      const data = await r.json().catch(function() { return {}; });
      if (!r.ok || !data.usuario) {
        limparLocal();
        return null;
      }
      return setSessaoFromServer(data.usuario);
    } catch {
      return _carregarLocal();
    }
  }

  function logout() {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(function() {});
    limparLocal();
    window.location.href = 'index.html';
  }

  function getSessao() {
    return _carregarLocal();
  }

  function isLogado() {
    return getSessao() !== null;
  }

  function isAdmin() {
    const s = getSessao();
    return s && String(s.nivel || '').toUpperCase() === 'ADMIN';
  }

  function isPCM() {
    const s = getSessao();
    const n = String((s && s.nivel) || '').toUpperCase();
    return n === 'PCM' || n === 'ADMIN';
  }

  function requireLogin() {
    if (!isLogado()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  function requireAdmin() {
    if (!isAdmin()) {
      alert('Acesso restrito. Somente ADMIN pode realizar esta ação.');
      return false;
    }
    return true;
  }

  return {
    login, logout, me,
    getSessao, setSessaoFromServer, limparLocal,
    isLogado, isAdmin, isPCM,
    requireLogin, requireAdmin
  };
})();
