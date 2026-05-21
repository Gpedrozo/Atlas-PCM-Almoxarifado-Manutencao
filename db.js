/* =========================================================
   db.js — Camada de dados (API REST / servidor local)
   Atlas PCM — Almoxarifado Manutenção
   ========================================================= */

const DB = (() => {

  const API = '/api';

  // ── Tela de carregamento (injetada assim que db.js é carregado) ───────────────
  (function injectLoader() {
    var s = document.createElement('style');
    s.textContent = '\
#atlas-page-loader{\
  position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;\
  background:#0C1E5B;\
  display:flex;flex-direction:column;align-items:center;justify-content:center;\
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;\
  animation:apl-fadein .25s ease;\
}\
@keyframes apl-fadein{from{opacity:0}to{opacity:1}}\
#atlas-page-loader .apl-card{\
  display:flex;flex-direction:column;align-items:center;gap:0;\
  animation:apl-rise .4s cubic-bezier(.22,1,.36,1) both;\
}\
@keyframes apl-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}\
#atlas-page-loader .apl-icon{\
  width:72px;height:72px;margin-bottom:20px;\
  background:rgba(247,148,29,.12);border:2px solid rgba(247,148,29,.25);\
  border-radius:20px;display:flex;align-items:center;justify-content:center;\
  box-shadow:0 0 40px rgba(247,148,29,.15);\
}\
#atlas-page-loader .apl-icon svg{width:38px;height:38px;}\
#atlas-page-loader .apl-brand{\
  font-size:1.75rem;font-weight:800;letter-spacing:.12em;\
  color:#fff;line-height:1;\
}\
#atlas-page-loader .apl-brand span{color:#F7941D;}\
#atlas-page-loader .apl-sub{\
  font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;\
  color:rgba(176,192,224,.55);margin-top:6px;margin-bottom:32px;\
}\
#atlas-page-loader .apl-dots{\
  display:flex;gap:8px;align-items:center;\
}\
#atlas-page-loader .apl-dots i{\
  width:8px;height:8px;border-radius:50%;background:#F7941D;\
  display:inline-block;\
  animation:apl-bounce .9s ease-in-out infinite;\
}\
#atlas-page-loader .apl-dots i:nth-child(2){animation-delay:.15s;}\
#atlas-page-loader .apl-dots i:nth-child(3){animation-delay:.3s;}\
@keyframes apl-bounce{\
  0%,80%,100%{transform:scale(.6);opacity:.35}\
  40%{transform:scale(1);opacity:1}\
}\
#atlas-page-loader .apl-bar{\
  position:absolute;bottom:0;left:0;width:100%;height:3px;\
  background:rgba(255,255,255,.06);\
}\
#atlas-page-loader .apl-bar-fill{\
  height:100%;width:0;background:linear-gradient(90deg,#F7941D,#ffb85c);\
  border-radius:0 2px 2px 0;\
  animation:apl-progress 1.8s cubic-bezier(.4,0,.2,1) forwards;\
}\
@keyframes apl-progress{0%{width:0}60%{width:75%}85%{width:88%}100%{width:92%}}\
#atlas-page-loader.apl-fadeout{animation:apl-fadeout .35s ease forwards;pointer-events:none}\
@keyframes apl-fadeout{to{opacity:0;transform:scale(1.03)}}\
#atlas-page-loader .apl-logo-img{max-width:180px;max-height:72px;object-fit:contain;filter:drop-shadow(0 2px 12px rgba(0,0,0,.4));}\
';
    document.head.appendChild(s);
    var div = document.createElement('div');
    div.id = 'atlas-page-loader';
    div.innerHTML = ''
      + '<div class="apl-card">'
      +   '<div class="apl-icon">'
      +     '<svg viewBox="0 0 24 24" fill="none" stroke="#F7941D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
      +       '<path d="M3 9.5L12 4l9 5.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>'
      +       '<polyline points="9 22 9 12 15 12 15 22"/>'
      +     '</svg>'
      +   '</div>'
      +   '<div class="apl-brand">ATLAS<span> PCM</span></div>'
      +   '<div class="apl-sub">Almoxarifado Manutenção</div>'
      +   '<div class="apl-dots"><i></i><i></i><i></i></div>'
      + '</div>'
      + '<div class="apl-bar"><div class="apl-bar-fill"></div></div>';
    // Busca a config (logo) imediatamente para mostrar na tela de carregamento
    fetch('/api/public-config', { credentials: 'same-origin' }).then(function(r) { return r.ok  r.json() : {}; }).then(function(cfg) {
      if (!window.__atlasLoader) return;
      if (cfg && cfg.logo) {
        // Aguarda o overlay aparecer antes de atualizar (máx 20 tentativas = 1s)
        var applyLogo = function(tries) {
          tries = tries || 0;
          if (tries > 20) return; // overlay nunca chegou — desiste
          var ov = document.getElementById('atlas-page-loader');
          if (!ov) { setTimeout(function() { applyLogo(tries + 1); }, 50); return; }
          var iconEl = ov.querySelector('.apl-icon');
          if (iconEl) {
            iconEl.style.cssText = 'width:auto;height:auto;background:transparent;border:none;box-shadow:none;margin-bottom:20px;';
            iconEl.innerHTML = '<img class="apl-logo-img" src="' + cfg.logo + '" alt="Logo">';
          }
          var brandEl = ov.querySelector('.apl-brand');
          if (brandEl) brandEl.style.display = 'none';
        };
        setTimeout(function() { applyLogo(0); }, 260);
      }
    }).catch(function() {});
    // Na LAN o carregamento típico leva < 80ms — só mostra o overlay se demorar mais de 250ms
    var _timer = setTimeout(function() { document.body.appendChild(div); }, 250);
    // Segurança: se depois de 18s o dismiss ainda não foi chamado, força remoção
    var _safetyTimer = setTimeout(function() {
      var ov = document.getElementById('atlas-page-loader');
      if (ov && ov.parentNode) {
        ov.classList.add('apl-fadeout');
        setTimeout(function() { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 350);
      }
      clearTimeout(_timer);
    }, 18000);
    window.__atlasLoader = {
      dismiss: function(cfg) {
        clearTimeout(_timer);
        clearTimeout(_safetyTimer);
        var ov = document.getElementById('atlas-page-loader');
        if (!ov) return; // dados chegaram rápido — overlay nunca foi exibido
        if (cfg && cfg.logo) {
          var iconEl = ov.querySelector('.apl-icon');
          if (iconEl) {
            iconEl.style.cssText = 'width:auto;height:auto;background:transparent;border:none;box-shadow:none;margin-bottom:20px;';
            iconEl.innerHTML = '<img class="apl-logo-img" src="' + cfg.logo + '" alt="Logo">';
          }
          var brandEl = ov.querySelector('.apl-brand');
          if (brandEl) brandEl.style.display = 'none';
        }
        ov.classList.add('apl-fadeout');
        setTimeout(function() { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 230);
      },
      showError: function() {
        clearTimeout(_timer);
        clearTimeout(_safetyTimer);
        if (!document.getElementById('atlas-page-loader')) document.body.appendChild(div);
        var ov = document.getElementById('atlas-page-loader');
        ov.innerHTML = '<div style="text-align:center;padding:40px 24px;max-width:380px">'
          + '<div style="width:64px;height:64px;margin:0 auto 20px;background:rgba(192,57,43,.15);border:2px solid rgba(192,57,43,.35);border-radius:16px;display:flex;align-items:center;justify-content:center">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="#E05252" stroke-width="1.8" stroke-linecap="round" width="32" height="32"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
          + '</div>'
          + '<div style="font-size:1.15rem;font-weight:700;color:#fff;margin-bottom:10px">Servidor não encontrado</div>'
          + '<div style="font-size:.85rem;color:rgba(176,192,224,.65);line-height:1.6;margin-bottom:24px">Inicie o servidor clicando duas vezes em <b style="color:#F7941D">iniciar.bat</b> e recarregue esta página.</div>'
          + '<button onclick="location.reload()" style="padding:11px 28px;background:#F7941D;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;letter-spacing:.03em;box-shadow:0 4px 14px rgba(247,148,29,.35)">Tentar novamente</button>'
          + '</div>'
          + '<div class="apl-bar"><div style="height:3px;background:rgba(192,57,43,.5);width:100%"></div></div>';
      }
    };
  })();

  // Memória local (carregada no init)
  const _store = {
    pecas:          [],
    movimentos:     [],
    ajustes:        [],
    requisicoes:    [],
    usuarios:       [],
    ativos:         [],
    notificacoes:   [],
    usuarios_retirada: [],
    consertos_solicitacoes: [],
    consertos_tokens: [],
    consertos_anexos: [],
    consertos_historico: [],
    consertos_tabelas_precos: [],
    fornecedores: [],
    materiais_consertos: [],
    consertos_auditoria: [],
    config:         {},
  };

  // ── helpers internos ──────────────────────────────────
  function _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function _now() {
    return new Date().toISOString();
  }

  // Escrita assíncrona — memória já atualizada, server sincroniza em background
  function _send(method, endpoint, data) {
    const opts = { method: method, credentials: 'same-origin' };
    if (data) {
      opts.headers = { 'Content-Type': 'application/json' };
      // Adicionar CSRF token para POST, PUT, DELETE
      if (['POST', 'PUT', 'DELETE'].includes(method) && _store._csrfToken) {
        data._csrfToken = _store._csrfToken;
      }
      opts.body    = JSON.stringify(data);
    }
    fetch(API + '/' + endpoint, opts).then(function(r) {
      if (r.status === 401 && window.Auth) {
        Auth.limparLocal();
        if (!/index\.html$/.test(location.pathname)) window.location.href = 'index.html';
      }
    }).catch(function(err) {
      console.error('[DB] Falha ao sincronizar com servidor:', err);
    });
  }

  // ── INICIALIZAÇÃO (assíncrona) ─────────────────────────
  function fetchWithTimeout(url, opts, timeoutMs) {
    return Promise.race([
      fetch(url, opts),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('timeout')); }, timeoutMs || 10000);
      })
    ]);
  }

  function init() {
    return fetchWithTimeout(API + '/init', { credentials: 'same-origin' }, 10000)
      .then(function(r) {
        if (r.status === 401) {
          if (window.Auth) Auth.limparLocal();
          if (!/index\.html$/.test(location.pathname)) window.location.href = 'index.html';
          throw new Error('HTTP 401');
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data) {
        if (data.usuarioAtual && window.Auth && typeof Auth.setSessaoFromServer === 'function') {
          Auth.setSessaoFromServer(data.usuarioAtual);
        }
        // Armazenar CSRF token para requisições POST/PUT/DELETE
        if (data._csrfToken) {
          _store._csrfToken = data._csrfToken;
        }
        // imagem/imagemExplodida chegam como true/false (indicador) — null significa sem imagem
        _store.pecas       = (data.pecas || []).map(function(p) {
          const imgs = p.imagens || [];
          return Object.assign({}, p, {
            imagem:          p.imagem          === true  null : (p.imagem          || null),
            imagemExplodida: p.imagemExplodida === true  null : (p.imagemExplodida || null),
            imagens:         imgs,
            // _temImagem: verdadeiro se tem imagens[] OU campo legado
            _temImagem:      imgs.length > 0 || p.imagem === true || !!p.imagem,
            _temExplodida:   p.imagemExplodida === true || !!p.imagemExplodida,
          });
        });
        _store.movimentos    = data.movimentos    || [];
        _store.ajustes       = data.ajustes       || [];
        _store.requisicoes   = data.requisicoes   || [];
        _store.usuarios      = data.usuarios      || [];
        _store.ativos        = data.ativos        || [];
        _store.notificacoes  = data.notificacoes  || [];
        _store.usuarios_retirada = data.usuarios_retirada || [];
        _store.consertos_solicitacoes = data.consertos_solicitacoes || [];
        _store.consertos_tokens = data.consertos_tokens || [];
        _store.consertos_anexos = data.consertos_anexos || [];
        _store.consertos_historico = data.consertos_historico || [];
        _store.consertos_tabelas_precos = data.consertos_tabelas_precos || [];
        _store.fornecedores = data.fornecedores || [];
        _store.materiais_consertos = data.materiais_consertos || [];
        _store.consertos_auditoria = data.consertos_auditoria || [];
        _store.config        = data.config        || {};
        if (window.__atlasLoader) window.__atlasLoader.dismiss(_store.config);
      })
      .catch(function(err) {
        console.error('[DB] init failed:', err);
        if (String(err && err.message || '').includes('401')) {
          if (window.__atlasLoader) window.__atlasLoader.dismiss({});
        } else if (window.__atlasLoader) {
          window.__atlasLoader.showError();
        }
        return Promise.resolve();
      });
  }

  // ── USUÁRIOS ──────────────────────────────────────────
  const Usuarios = {
    listar:      ()      => _store.usuarios,
    buscarId:    id      => _store.usuarios.find(u => u.id === id),
    buscarEmail: email   => _store.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase()),

    salvar(usuario) {
      const idx = _store.usuarios.findIndex(u => u.id === usuario.id);
      if (idx >= 0) {
        const payload = Object.assign({}, usuario);
        const local = Object.assign({}, usuario);
        delete local.senha;
        _store.usuarios[idx] = local;
        _send('PUT', 'usuarios/' + usuario.id, payload);
      } else {
        const novo = Object.assign({}, usuario, { id: _id(), criadoEm: _now() });
        const local = Object.assign({}, novo);
        delete local.senha;
        _store.usuarios.push(local);
        _send('POST', 'usuarios', novo);
      }
    },

    remover(id) {
      _store.usuarios = _store.usuarios.filter(u => u.id !== id);
      _send('DELETE', 'usuarios/' + id);
    }
  };

  // ── PEÇAS ─────────────────────────────────────────────
  const Pecas = {
    listar:   () => _store.pecas,
    ativas:   () => _store.pecas.filter(p => p.ativo !== false),
    buscarId: id => _store.pecas.find(p => p.id === id),

    // Retorna URL direta para servir uma imagem pelo filename
    getImagemUrl(filename) {
      return API + '/imagens/' + encodeURIComponent(filename);
    },

    // Retorna array de URLs prontas para todas as imagens da peça
    getImagensUrls(id) {
      const p = _store.pecas.find(function(x) { return x.id === id; });
      if (!p) return [];
      return (p.imagens || []).map(function(fn) { return API + '/imagens/' + encodeURIComponent(fn); });
    },

    // Busca imagem de uma peça sob demanda — backward compat (retorna Promise<string|null>)
    getImagem(id, tipo) {
      const p = _store.pecas.find(function(x) { return x.id === id; });
      if (!p) return Promise.resolve(null);
      // Novo modelo: retorna URL da primeira imagem se existir
      if (!tipo || tipo === 'principal') {
        if (p.imagens && p.imagens.length > 0) return Promise.resolve(API + '/imagens/' + encodeURIComponent(p.imagens[0]));
      }
      // Legado: base64 armazenado no _store
      const campo   = tipo === 'explodida'  'imagemExplodida' : 'imagem';
      const temFlag = tipo === 'explodida'  '_temExplodida'   : '_temImagem';
      if (p[campo])    return Promise.resolve(p[campo]);
      if (!p[temFlag]) return Promise.resolve(null);
      return fetch(API + '/pecas/' + id + '/imagem' + (tipo === 'explodida'  'tipo=explodida' : ''))
        .then(function(r) { return r.ok  r.json() : {}; })
        .then(function(res) {
          p[campo] = res.imagem || null;
          return p[campo];
        })
        .catch(function() { return null; });
    },

    salvar(peca) {
      const idx = _store.pecas.findIndex(p => p.id === peca.id);
      if (idx >= 0) {
        _store.pecas[idx] = Object.assign({}, _store.pecas[idx], peca);
        _send('PUT', 'pecas/' + peca.id, _store.pecas[idx]);
      } else {
        const nova = Object.assign({}, peca, { id: _id(), criadoEm: _now(), ativo: true });
        _store.pecas.push(nova);
        _send('POST', 'pecas', nova);
      }
    },

    remover(id) {
      const idx = _store.pecas.findIndex(p => p.id === id);
      if (idx >= 0) {
        _store.pecas[idx].ativo = false;
        _send('PUT', 'pecas/' + id, _store.pecas[idx]);
      }
    }
  };

  // ── MOVIMENTOS ────────────────────────────────────────
  const Movimentos = {
    listar:   ()       => _store.movimentos.slice().sort((a,b) => (b.data||b.criadoEm||'').localeCompare(a.data||a.criadoEm||'')),
    porPeca:  pecaId   => _store.movimentos.filter(m => m.pecaId === pecaId).sort((a,b) => (b.data||b.criadoEm||'').localeCompare(a.data||a.criadoEm||'')),
    porAtivo: ativoId  => _store.movimentos.filter(m => m.ativoId === ativoId).sort((a,b) => (b.data||b.criadoEm||'').localeCompare(a.data||a.criadoEm||'')),

    registrar(mov) {
      const novo = Object.assign({}, mov, { id: _id(), criadoEm: _now() });
      _store.movimentos.push(novo);
      _send('POST', 'movimentos', novo);
    },

    saldoPeca(pecaId) {
      return _store.movimentos
        .filter(m => m.pecaId === pecaId)
        .reduce((acc, m) => {
          if (m.tipo === 'ENTRADA' || m.tipo === 'AJUSTE_ADD') return acc + Number(m.quantidade);
          if (m.tipo === 'SAIDA'   || m.tipo === 'AJUSTE_SUB') return acc - Number(m.quantidade);
          if (m.tipo === 'AJUSTE') return acc + Number(m.quantidade);
          return acc;
        }, 0);
    },

    saldoTodos() {
      const mapa = {};
      _store.movimentos.forEach(m => {
        if (!mapa[m.pecaId]) mapa[m.pecaId] = 0;
        if (m.tipo === 'ENTRADA' || m.tipo === 'AJUSTE_ADD') mapa[m.pecaId] += Number(m.quantidade);
        else if (m.tipo === 'SAIDA' || m.tipo === 'AJUSTE_SUB')  mapa[m.pecaId] -= Number(m.quantidade);
        else if (m.tipo === 'AJUSTE') mapa[m.pecaId] += Number(m.quantidade);
      });
      return mapa;
    }
  };

  // ── AJUSTES ───────────────────────────────────────────
  const Ajustes = {
    listar:    () => _store.ajustes.slice().sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||'')),
    pendentes: () => _store.ajustes.filter(a => a.status === 'PENDENTE'),
    buscarId:  id => _store.ajustes.find(a => a.id === id),

    registrar(ajuste) {
      const novo = Object.assign({}, ajuste, { id: _id(), criadoEm: _now() });
      _store.ajustes.push(novo);
      _send('POST', 'ajustes', novo);
    },

    atualizar(ajuste) {
      const idx = _store.ajustes.findIndex(a => a.id === ajuste.id);
      if (idx >= 0) {
        _store.ajustes[idx] = Object.assign({}, _store.ajustes[idx], ajuste);
        _send('PUT', 'ajustes/' + ajuste.id, _store.ajustes[idx]);
      }
    }
  };

  // ── REQUISIÇÕES ───────────────────────────────────────
  const Requisicoes = {
    listar() {
      return _store.requisicoes.slice().sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||''));
    },

    proximoNumero() {
      const n = _store.config.proximaReqNum || 1;
      _store.config.proximaReqNum = n + 1;
      _send('PUT', 'config', { proximaReqNum: n + 1 });
      return 'REQ-' + String(n).padStart(4, '0');
    },

    salvar(req) {
      const idx = _store.requisicoes.findIndex(r => r.id === req.id);
      if (idx >= 0) {
        _store.requisicoes[idx] = Object.assign({}, _store.requisicoes[idx], req);
        _send('PUT', 'requisicoes/' + req.id, _store.requisicoes[idx]);
        return _store.requisicoes[idx];
      } else {
        const numero = Requisicoes.proximoNumero();
        const nova   = Object.assign({}, req, { id: _id(), numero, criadoEm: _now(), status: req.status || 'PENDENTE' });
        _store.requisicoes.push(nova);
        _send('POST', 'requisicoes', nova);
        return nova;
      }
    },

    buscarId: id => _store.requisicoes.find(r => r.id === id),
  };

  // ── ATIVOS ────────────────────────────────────────────
  const Ativos = {
    listar:    () =>  _store.ativos,
    ativos:    () =>  _store.ativos.filter(a => a.ativo !== false),
    buscarId:  id  => _store.ativos.find(a => a.id === id),
    buscarTag: tag => _store.ativos.find(a => a.tag && a.tag.toLowerCase() === tag.toLowerCase()),

    salvar(ativo) {
      const idx = _store.ativos.findIndex(a => a.id === ativo.id);
      if (idx >= 0) {
        _store.ativos[idx] = Object.assign({}, _store.ativos[idx], ativo);
        _send('PUT', 'ativos/' + ativo.id, _store.ativos[idx]);
      } else {
        const novo = Object.assign({}, ativo, { id: _id(), criadoEm: _now(), ativo: true });
        _store.ativos.push(novo);
        _send('POST', 'ativos', novo);
      }
    },

    remover(id) {
      const idx = _store.ativos.findIndex(a => a.id === id);
      if (idx >= 0) {
        _store.ativos[idx].ativo = false;
        _send('PUT', 'ativos/' + id, _store.ativos[idx]);
      }
    }
  };

  // ── CONSERTOS EXTERNOS ─────────────────────────────────
  const Consertos = {
    listar() {
      return (_store.consertos_solicitacoes || []).slice().sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||''));
    },

    buscarId(id) {
      return (_store.consertos_solicitacoes || []).find(c => c.id === id);
    },

    // Retorna o registro mais recente com aquele código SAP de material
    buscarPorCodigoSAP(codigo) {
      if (!codigo) return null;
      const norm = codigo.trim().toLowerCase();
      return (_store.consertos_solicitacoes || [])
        .filter(c => (c.codigo_material_sap || '').trim().toLowerCase() === norm)
        .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))
        [0] || null;
    },

    // Retorna o registro mais recente com aquele código SAP de fornecedor
    buscarFornecedorPorCodigo(codigoFornecedor) {
      if (!codigoFornecedor) return null;
      const norm = codigoFornecedor.trim().toLowerCase();
      return (_store.consertos_solicitacoes || [])
        .filter(c => (c.fornecedor_codigo_sap || '').trim().toLowerCase() === norm && c.fornecedor_razao_social)
        .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))
        [0] || null;
    },

    proximoNumero() {
      const n = _store.config.proximoConsertoNum || 1;
      _store.config.proximoConsertoNum = n + 1;
      _send('PUT', 'config', { proximoConsertoNum: n + 1 });
      return 'CON-' + String(n).padStart(5, '0');
    },

    salvar(sol) {
      const idx = (_store.consertos_solicitacoes || []).findIndex(c => c.id === sol.id);
      if (!_store.consertos_solicitacoes) _store.consertos_solicitacoes = [];
      if (idx >= 0) {
        _store.consertos_solicitacoes[idx] = Object.assign({}, _store.consertos_solicitacoes[idx], sol);
        _send('PUT', 'consertos_solicitacoes/' + sol.id, _store.consertos_solicitacoes[idx]);
        return _store.consertos_solicitacoes[idx];
      } else {
        const nova = Object.assign({}, sol, {
          id: _id(),
          numeroSolicitacao: sol.numeroSolicitacao || Consertos.proximoNumero(),
          status: sol.status || 'Solicitação aberta',
          criadoEm: _now(),
        });
        _store.consertos_solicitacoes.push(nova);
        _send('POST', 'consertos_solicitacoes', nova);
        return nova;
      }
    },

    atualizarStatus(id, status) {
      const registro = Consertos.buscarId(id);
      if (!registro) return;
      registro.status = status;
      registro.atualizadoEm = _now();
      _send('PUT', 'consertos_solicitacoes/' + id, registro);
      return registro;
    }
  };

  const ConsertosTokens = {
    listar: () => (_store.consertos_tokens || []).slice().sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||'')),
    buscarId: id => (_store.consertos_tokens || []).find(t => t.id === id),
    buscarPorSolicitacao: solicitacaoId => (_store.consertos_tokens || []).filter(t => t.solicitacaoId === solicitacaoId),
    salvar(token) {
      const idx = (_store.consertos_tokens || []).findIndex(t => t.id === token.id);
      if (!_store.consertos_tokens) _store.consertos_tokens = [];
      if (idx >= 0) {
        _store.consertos_tokens[idx] = Object.assign({}, _store.consertos_tokens[idx], token);
        _send('PUT', 'consertos_tokens/' + token.id, _store.consertos_tokens[idx]);
        return _store.consertos_tokens[idx];
      } else {
        const novo = Object.assign({}, token, { id: _id(), criadoEm: _now() });
        _store.consertos_tokens.push(novo);
        _send('POST', 'consertos_tokens', novo);
        return novo;
      }
    },

    validar(tokenHash) {
      return (_store.consertos_tokens || []).find(t => t.token_hash === tokenHash);
    }
  };

  const ConsertosAnexos = {
    listar: () => (_store.consertos_anexos || []).slice().sort((a,b) => (b.enviadoEm||'').localeCompare(a.enviadoEm||'')),
    porSolicitacao: solicitacaoId => (_store.consertos_anexos || []).filter(a => a.solicitacaoId === solicitacaoId),
    buscarId: id => (_store.consertos_anexos || []).find(a => a.id === id),
    salvar(anexo) {
      const idx = (_store.consertos_anexos || []).findIndex(a => a.id === anexo.id);
      if (!_store.consertos_anexos) _store.consertos_anexos = [];
      if (idx >= 0) {
        _store.consertos_anexos[idx] = Object.assign({}, _store.consertos_anexos[idx], anexo);
        _send('PUT', 'consertos_anexos/' + anexo.id, _store.consertos_anexos[idx]);
      } else {
        const novo = Object.assign({}, anexo, { id: _id(), enviadoEm: _now() });
        _store.consertos_anexos.push(novo);
        _send('POST', 'consertos_anexos', novo);
        return novo;
      }
    }
  };

  const ConsertosHistorico = {
    listar: () => (_store.consertos_historico || []).slice().sort((a,b) => (b.dataHora||'').localeCompare(a.dataHora||'')),
    porSolicitacao: solicitacaoId => (_store.consertos_historico || []).filter(h => h.solicitacaoId === solicitacaoId),
    criar(entry) {
      if (!_store.consertos_historico) _store.consertos_historico = [];
      // Enriquecer com metadados disponíveis no cliente
      const sess = (window.Auth && typeof Auth.getSessao === 'function')  Auth.getSessao() : null;
      const usuarioNome = entry.usuarioNome || (sess  sess.nome : null) || null;
      const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent)  navigator.userAgent : null;
      const origemUrl = (typeof location !== 'undefined' && location.href)  location.href : null;
      const novo = Object.assign({}, entry, {
        id: _id(),
        dataHora: _now(),
        usuarioNome: usuarioNome,
        userAgent: userAgent,
        origemUrl: origemUrl
      });
      _store.consertos_historico.push(novo);
      _send('POST', 'consertos_historico', novo);
      return novo;
    }
  };

  const ConsertosTabelasPrecos = {
    listar: () => (_store.consertos_tabelas_precos || []).slice().sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||'')),
    buscarId: id => (_store.consertos_tabelas_precos || []).find(t => t.id === id),
    salvar(tabela) {
      const idx = (_store.consertos_tabelas_precos || []).findIndex(t => t.id === tabela.id);
      if (!_store.consertos_tabelas_precos) _store.consertos_tabelas_precos = [];
      if (idx >= 0) {
        _store.consertos_tabelas_precos[idx] = Object.assign({}, _store.consertos_tabelas_precos[idx], tabela);
        _send('PUT', 'consertos_tabelas_precos/' + tabela.id, _store.consertos_tabelas_precos[idx]);
      } else {
        const novo = Object.assign({}, tabela, { id: _id(), criadoEm: _now() });
        _store.consertos_tabelas_precos.push(novo);
        _send('POST', 'consertos_tabelas_precos', novo);
        return novo;
      }
    },
    remover(id) {
      _store.consertos_tabelas_precos = (_store.consertos_tabelas_precos || []).filter(t => t.id !== id);
      _send('DELETE', 'consertos_tabelas_precos/' + id);
    }
  };

  // ── NOTIFICAÇÕES ──────────────────────────────────────
  const Notificacoes = {
    listar:      ()       => (_store.notificacoes || []).slice().sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||'')),
    porUsuario:  userId   => (_store.notificacoes || []).filter(n => n.userId === userId).sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||'')),
    naoLidas:    userId   => (_store.notificacoes || []).filter(n => n.userId === userId && !n.lida),

    criar(notif) {
      if (!_store.notificacoes) _store.notificacoes = [];
      const nova = Object.assign({}, notif, { id: _id(), criadoEm: _now(), lida: false });
      _store.notificacoes.push(nova);
      _send('POST', 'notificacoes', nova);
      return nova;
    },

    marcarLida(id) {
      const n = (_store.notificacoes || []).find(x => x.id === id);
      if (n) { n.lida = true; _send('PUT', 'notificacoes/' + id, n); }
    },

    marcarTodasLidas(userId) {
      (_store.notificacoes || []).forEach(n => {
        if (n.userId === userId && !n.lida) { n.lida = true; _send('PUT', 'notificacoes/' + n.id, n); }
      });
    }
  };

  // ── USUÁRIOS DE RETIRADA ────────────────────────────────
  const UsuariosRetirada = {
    listar:   () => (_store.usuarios_retirada || []),
    buscarId: id => (_store.usuarios_retirada || []).find(u => u.id === id),

    salvar(u) {
      if (!_store.usuarios_retirada) _store.usuarios_retirada = [];
      const idx = _store.usuarios_retirada.findIndex(x => x.id === u.id);
      if (idx >= 0) {
        _store.usuarios_retirada[idx] = Object.assign({}, _store.usuarios_retirada[idx], u);
        _send('PUT', 'usuarios_retirada/' + u.id, _store.usuarios_retirada[idx]);
      } else {
        const novo = Object.assign({}, u, { id: _id(), criadoEm: _now(), ativo: u.ativo !== false });
        delete novo.undefined; // limpa campo id:undefined se vier
        _store.usuarios_retirada.push(novo);
        _send('POST', 'usuarios_retirada', novo);
      }
    },

    remover(id) {
      if (!_store.usuarios_retirada) return;
      _store.usuarios_retirada = _store.usuarios_retirada.filter(u => u.id !== id);
      _send('DELETE', 'usuarios_retirada/' + id);
    }
  };

  // ── CONFIG ────────────────────────────────────────────
  const Config = {
    get()      { return _store.config; },
    set(obj)   {
      _store.config = Object.assign({}, _store.config, obj);
      _send('PUT', 'config', obj);
    }
  };

  // ── FORNECEDORES ───────────────────────────────────────
  // Cadastro dedicado de fornecedores de consertos externos
  const Fornecedores = {
    listar: () => (_store.fornecedores || []).slice().sort((a,b) => (a.razaoSocial||'').localeCompare(b.razaoSocial||'')),
    buscarId: id => (_store.fornecedores || []).find(f => f.id === id),
    buscarPorCnpj: cnpj => (_store.fornecedores || []).find(f => (f.cnpj||'').replace(/\D/g,'') === (cnpj||'').replace(/\D/g,'')),
    buscarPorCodigoSap: cod => {
      if (!cod) return null;
      const norm = String(cod).trim().toLowerCase();
      return (_store.fornecedores || []).find(f => (f.codigoSap||'').trim().toLowerCase() === norm) || null;
    },
    buscarPorNome: texto => {
      if (!texto) return [];
      const norm = texto.trim().toLowerCase();
      return (_store.fornecedores || []).filter(f =>
        (f.razaoSocial||'').toLowerCase().includes(norm) ||
        (f.nomeFantasia||'').toLowerCase().includes(norm)
      );
    },
    salvar(f) {
      if (!_store.fornecedores) _store.fornecedores = [];
      const idx = _store.fornecedores.findIndex(x => x.id === f.id);
      if (idx >= 0) {
        _store.fornecedores[idx] = Object.assign({}, _store.fornecedores[idx], f);
        _send('PUT', 'fornecedores/' + f.id, _store.fornecedores[idx]);
        return _store.fornecedores[idx];
      }
      // Gera código interno automático se não informado
      if (!f.codigoInterno) {
        const n = _store.config.proximoFornecedorNum || 1;
        _store.config.proximoFornecedorNum = n + 1;
        _send('PUT', 'config', { proximoFornecedorNum: n + 1 });
        f.codigoInterno = 'FOR-' + String(n).padStart(4, '0');
      }
      const novo = Object.assign({}, f, { id: _id(), criadoEm: _now(), ativo: f.ativo !== false });
      _store.fornecedores.push(novo);
      _send('POST', 'fornecedores', novo);
      return novo;
    },
    remover(id) {
      _store.fornecedores = (_store.fornecedores || []).filter(f => f.id !== id);
      _send('DELETE', 'fornecedores/' + id);
    },
    // Histórico de solicitações por fornecedor
    historicoSolicitacoes(fornecedorId) {
      const f = Fornecedores.buscarId(fornecedorId);
      if (!f) return [];
      return (_store.consertos_solicitacoes || []).filter(s =>
        s.fornecedorId === fornecedorId ||
        (f.codigoSap && s.fornecedor_codigo_sap === f.codigoSap) ||
        (f.cnpj && s.fornecedor_cnpj === f.cnpj)
      ).sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||''));
    }
  };

  // ── MATERIAIS DE CONSERTO ──────────────────────────────
  // Cadastro dedicado de materiais/itens enviados para conserto
  const MateriaisConsertos = {
    listar: () => (_store.materiais_consertos || []).slice().sort((a,b) => (a.descricaoSap||'').localeCompare(b.descricaoSap||'')),
    buscarId: id => (_store.materiais_consertos || []).find(m => m.id === id),
    buscarPorCodigoSap: cod => {
      if (!cod) return null;
      const norm = String(cod).trim().toLowerCase();
      return (_store.materiais_consertos || []).find(m => (m.codigoSap||'').trim().toLowerCase() === norm) || null;
    },
    buscarPorTexto: texto => {
      if (!texto) return [];
      const norm = texto.trim().toLowerCase();
      return (_store.materiais_consertos || []).filter(m =>
        (m.codigoSap||'').toLowerCase().includes(norm) ||
        (m.descricaoSap||'').toLowerCase().includes(norm) ||
        (m.descricaoInterna||'').toLowerCase().includes(norm) ||
        (m.codigoInterno||'').toLowerCase().includes(norm)
      );
    },
    salvar(m) {
      if (!_store.materiais_consertos) _store.materiais_consertos = [];
      const idx = _store.materiais_consertos.findIndex(x => x.id === m.id);
      if (idx >= 0) {
        _store.materiais_consertos[idx] = Object.assign({}, _store.materiais_consertos[idx], m);
        _send('PUT', 'materiais_consertos/' + m.id, _store.materiais_consertos[idx]);
        return _store.materiais_consertos[idx];
      }
      if (!m.codigoInterno) {
        const n = _store.config.proximoMaterialNum || 1;
        _store.config.proximoMaterialNum = n + 1;
        _send('PUT', 'config', { proximoMaterialNum: n + 1 });
        m.codigoInterno = 'MAT-' + String(n).padStart(5, '0');
      }
      const novo = Object.assign({}, m, { id: _id(), criadoEm: _now() });
      _store.materiais_consertos.push(novo);
      _send('POST', 'materiais_consertos', novo);
      return novo;
    },
    remover(id) {
      _store.materiais_consertos = (_store.materiais_consertos || []).filter(m => m.id !== id);
      _send('DELETE', 'materiais_consertos/' + id);
    },
    // Histórico de solicitações por material
    historicoSolicitacoes(materialId) {
      const m = MateriaisConsertos.buscarId(materialId);
      if (!m) return [];
      return (_store.consertos_solicitacoes || []).filter(s =>
        s.materialId === materialId ||
        (m.codigoSap && s.codigo_material_sap === m.codigoSap)
      ).sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||''));
    }
  };

  // ── AUDITORIA DE CONSERTOS ─────────────────────────────
  // Auditoria completa com IP registrado pelo servidor
  const ConsertosAuditoria = {
    listar: () => (_store.consertos_auditoria || []).slice().sort((a,b) => (b.dataHora||'').localeCompare(a.dataHora||'')),
    porSolicitacao: solicitacaoId => (_store.consertos_auditoria || []).filter(a => a.solicitacaoId === solicitacaoId),

    // Registra via POST /api/consertos-auditoria para que o servidor capture o IP real
    async registrar(entrada) {
      const sess = (window.Auth && typeof Auth.getSessao === 'function')  Auth.getSessao() : null;
      const payload = Object.assign({}, entrada, {
        usuarioId:   entrada.usuarioId   || (sess  sess.id   : null),
        usuarioNome: entrada.usuarioNome || (sess  sess.nome : null),
      });
      try {
        const r = await fetch('/api/consertos-auditoria', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        if (r.ok) {
          const novo = await r.json();
          // Atualizar store local
          if (!_store.consertos_auditoria) _store.consertos_auditoria = [];
          _store.consertos_auditoria.push(Object.assign({}, payload, { id: novo.id }));
        }
      } catch (e) {
        console.warn('[DB.ConsertosAuditoria] Falha ao registrar:', e);
      }
    }
  };

  return { init, Usuarios, Pecas, Movimentos, Ajustes, Requisicoes, Ativos, Notificacoes, Config, UsuariosRetirada, Consertos, ConsertosTokens, ConsertosAnexos, ConsertosHistorico, ConsertosTabelasPrecos, Fornecedores, MateriaisConsertos, ConsertosAuditoria };
})();
