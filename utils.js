/* =========================================================
   utils.js — Funções utilitárias globais
   Atlas PCM — Almoxarifado Manutenção
   ========================================================= */

const Utils = (() => {

  // ── Datas ─────────────────────────────────────────────
  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  }

  function formatarDataHora(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
  }

  function dataHoje() {
    return new Date().toISOString().split('T')[0];
  }

  // ── Status de Estoque ─────────────────────────────────
  function statusEstoque(saldo, minimo) {
    if (saldo <= 0)              return { label: 'Zerado',   classe: 'critical', pct: 0 };
    if (saldo <= minimo * 0.5)   return { label: 'Crítico',  classe: 'critical', pct: Math.min(100, (saldo/minimo)*100) };
    if (saldo <= minimo)         return { label: 'Baixo',    classe: 'low',      pct: Math.min(100, (saldo/minimo)*100) };
    return                              { label: 'Normal',   classe: 'ok',       pct: Math.min(100, (saldo/minimo)*100) };
  }

  // ── Toasts ────────────────────────────────────────────
  function toast(msg, tipo = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    const icon = document.createElement('span');
    icon.textContent = icons[tipo] || 'ℹ️';
    const text = document.createElement('span');
    text.textContent = msg;
    el.appendChild(icon);
    el.appendChild(text);
    container.appendChild(el);
    setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .4s'; setTimeout(()=>el.remove(), 400); }, 3200);
  }

  // ── Modal ─────────────────────────────────────────────
  function abrirModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  }

  function fecharModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
  }

  function fecharModalClicandoFora(event) {
    if (event.target.classList.contains('modal-overlay')) {
      event.target.classList.remove('open');
    }
  }

  // ── Sprites SVG para icons do sidebar ─────────────────
  const _SVG_SPRITE = `<svg id="atlas-svg-sprite" xmlns="http://www.w3.org/2000/svg" style="display:none">
    <symbol id="icon-dashboard" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></symbol>
    <symbol id="icon-estoque" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18v2H3V4zm1 4h16v10H4V8zm2 2v6h2v-6H6zm5 0v6h2v-6h-2zm5 0v6h2v-6h-2z"/></symbol>
    <symbol id="icon-movimentacoes" viewBox="0 0 24 24" fill="currentColor"><path d="M15 5l-1.41 1.41L18.17 10H4v2h14.17l-4.58 3.59L15 17l7-7-7-5z"/></symbol>
    <symbol id="icon-pecas" viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.52l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.34.24.52.49.52h4c.25 0 .46-.18.49-.52l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></symbol>
    <symbol id="icon-ativos" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></symbol>
    <symbol id="icon-requisicoes" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-5 8v-2h8v2H8zm0-4v-2h8v2H8zm0-4V9h3v2H8z"/></symbol>
    <symbol id="icon-consertos" viewBox="0 0 24 24" fill="currentColor"><path d="M13.78 15.3L19.78 21.3L21.89 19.14L15.89 13.14L13.78 15.3M17.5 11.5C19.43 11.5 21 9.93 21 8C21 7.57 20.9 7.16 20.76 6.77L18.5 9L15 5.5L17.23 3.24C16.84 3.1 16.43 3 16 3C14.07 3 12.5 4.57 12.5 6.5C12.5 6.91 12.58 7.3 12.72 7.66L3 17.38L5.62 20L13.34 12.28C13.7 12.42 14.09 12.5 14.5 12.5H17.5V11.5Z"/></symbol>
    <symbol id="icon-relatorios" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2V17zm4 0h-2V7h2V17zm4 0h-2v-4h2V17z"/></symbol>
    <symbol id="icon-etiquetas" viewBox="0 0 24 24" fill="currentColor"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></symbol>
    <symbol id="icon-aprovacoes" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></symbol>
    <symbol id="icon-ajustes" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></symbol>
    <symbol id="icon-config" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.48.11.62l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.48-.11-.62l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></symbol>
    <symbol id="icon-usuarios" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></symbol>
    <symbol id="icon-logout" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></symbol>
  </svg>`;

  // ── Construir sidebar padrão Atlas ────────────────────
  function buildSidebar() {
    // Injetar sprite SVG no body se não existir
    if (!document.getElementById('atlas-svg-sprite')) {
      const div = document.createElement('div');
      div.innerHTML = _SVG_SPRITE;
      document.body.insertBefore(div.firstElementChild, document.body.firstChild);
    }

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Reconstruir o HTML do sidebar com SVG icons padronizados
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <img id="sidebar-logo-img" class="logo-img" src="" alt="Logo" style="display:none">
        <div id="sidebar-logo-text" class="system-name">Gestão de Estoque</div>
        <div class="sub">PCM Almoxarifado</div>
      </div>
      <nav>
        <div class="nav-group-label">Principal</div>
        <a href="dashboard.html" data-page="dashboard"><svg class="icon"><use href="#icon-dashboard"></use></svg> Dashboard</a>
        <a href="estoque.html" data-page="estoque"><svg class="icon"><use href="#icon-estoque"></use></svg> Estoque</a>
        <a href="movimentacoes.html" data-page="movimentacoes"><svg class="icon"><use href="#icon-movimentacoes"></use></svg> Movimentações</a>
        <div class="nav-group-label">Cadastros</div>
        <a href="pecas.html" data-page="pecas"><svg class="icon"><use href="#icon-pecas"></use></svg> Peças</a>
        <a href="ativos.html" data-page="ativos"><svg class="icon"><use href="#icon-ativos"></use></svg> Ativos</a>
        <a href="requisicoes.html" data-page="requisicoes"><svg class="icon"><use href="#icon-requisicoes"></use></svg> Req. de Compra</a>
        <a href="consertos.html" data-page="consertos"><svg class="icon"><use href="#icon-consertos"></use></svg> Consertos Externos</a>
        <div class="nav-group-label">Análise</div>
        <a href="relatorios.html" data-page="relatorios"><svg class="icon"><use href="#icon-relatorios"></use></svg> Relatórios</a>
        <a href="etiquetas.html" data-page="etiquetas"><svg class="icon"><use href="#icon-etiquetas"></use></svg> Etiquetas</a>
        <div class="nav-group-label nav-admin" data-admin>Administração</div>
        <a href="aprovacoes.html" data-page="aprovacoes" data-admin><svg class="icon"><use href="#icon-aprovacoes"></use></svg> Solicitações</a>
        <a href="ajustes.html" data-page="ajustes" data-admin><svg class="icon"><use href="#icon-ajustes"></use></svg> Ajuste de Saldo</a>
        <a href="configuracoes.html" data-page="configuracoes" data-admin><svg class="icon"><use href="#icon-config"></use></svg> Configurações</a>
        <a href="usuarios.html" data-page="usuarios" data-admin><svg class="icon"><use href="#icon-usuarios"></use></svg> Usuários</a>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info" id="sidebar-user-name">…</div>
        <div class="user-role" id="sidebar-user-role">…</div>
        <button class="btn-logout" onclick="Auth.logout()"><svg class="icon-logout"><use href="#icon-logout"></use></svg> Sair do Sistema</button>
      </div>`;
  }

  // ── Sidebar ativa ─────────────────────────────────────
  function marcarNavAtivo(page) {
    document.querySelectorAll('.sidebar nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });
    
    // Atualizar breadcrumb
    const links = {
      dashboard: 'Dashboard',
      estoque: 'Estoque',
      movimentacoes: 'Movimentações',
      pecas: 'Peças',
      ativos: 'Ativos',
      requisicoes: 'Requisições de Compra',
      consertos: 'Consertos Externos',
      relatorios: 'Relatórios',
      etiquetas: 'Etiquetas',
      aprovacoes: 'Solicitações',
      ajustes: 'Ajuste de Saldo',
      configuracoes: 'Configurações'
    };
    const bcCurrent = document.getElementById('bc-current');
    if (bcCurrent) {
      bcCurrent.textContent = links[page] || page;
    }
  }

  // ── Render sidebar footer (usuário logado) ─────────────
  function renderSidebarUser() {
    const sessao = Auth.getSessao();
    if (!sessao) return;
    // Reconstruir sidebar com ícones SVG padronizados
    buildSidebar();
    const el = document.getElementById('sidebar-user-name');
    const rl = document.getElementById('sidebar-user-role');
    if (el) el.textContent = sessao.nome;
    if (rl) rl.textContent = sessao.nivel;
    // Injetar botão toggle se ainda não existe
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !document.getElementById('sidebar-toggle-btn')) {
      const btn = document.createElement('button');
      btn.id = 'sidebar-toggle-btn';
      btn.className = 'sidebar-toggle no-print';
      btn.title = 'Recolher menu';
      btn.innerHTML = '◀';
      btn.onclick = toggleSidebar;
      sidebar.appendChild(btn);
    }
    // Restaurar estado salvo
    if (localStorage.getItem('atlas_sidebar_collapsed') === '1') {
      document.getElementById('sidebar').classList.add('collapsed');
    }
    // Sino de notificações
    renderNotificacoes();
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('atlas_sidebar_collapsed', collapsed  '1' : '0');
  }

  // ── Esconder elementos por nível ──────────────────────
  function aplicarPermissoes() {
    const isAdmin = Auth.isAdmin();
    document.querySelectorAll('[data-admin]').forEach(el => {
      el.style.display = isAdmin  '' : 'none';
    });
    document.querySelectorAll('[data-pcm]').forEach(el => {
      el.style.display = Auth.isPCM()  '' : 'none';
    });
  }

  // ── Imagem Base64 ─────────────────────────────────────
  function lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Formatar número ───────────────────────────────────
  function fmt(n) {
    return Number(n || 0).toLocaleString('pt-BR');
  }

  function gerarToken() {
    var array = new Uint8Array(24);
    window.crypto.getRandomValues(array);
    return Array.from(array).map(function(b) { return ('0' + b.toString(16)).slice(-2); }).join('') + '-' + Date.now().toString(36);
  }

  // ── Sanitize texto (evitar XSS) ───────────────────────
  function safe(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ── Badge HTML ────────────────────────────────────────
  function badgeEstoque(saldo, minimo) {
    const s = statusEstoque(saldo, minimo);
    return `<span class="badge badge-${s.label === 'Normal'  'ok' : s.label === 'Baixo'  'low' : 'critical'}">${s.label}</span>`;
  }

  // ── Tipo movimento label ──────────────────────────────
  function labelTipo(tipo) {
    const m = { ENTRADA:'Entrada', SAIDA:'Saída', AJUSTE:'Ajuste', AJUSTE_ADD:'Ajuste +', AJUSTE_SUB:'Ajuste −' };
    return m[tipo] || tipo;
  }

  // ── Tema Claro / Escuro ───────────────────────────────────────
  function applyTheme() {
    const t = localStorage.getItem('atlas_theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('.btn-theme').forEach(btn => {
      btn.textContent = t === 'dark'  '☀️' : '🌙';
      btn.title = t === 'dark'  'Mudar para tema claro' : 'Mudar para tema escuro';
    });
  }

  function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme') || 'light';
    const next = curr === 'dark'  'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('atlas_theme', next);
    document.querySelectorAll('.btn-theme').forEach(btn => {
      btn.textContent = next === 'dark'  '☀️' : '🌙';
      btn.title = next === 'dark'  'Mudar para tema claro' : 'Mudar para tema escuro';
    });
  }

  // ── Sino de Notificações ──────────────────────────────────────
  var _notifRefreshTimer = null;

  function renderNotificacoes() {
    if (!window.DB || !DB.Notificacoes) return;
    var sessao = Auth.getSessao();
    if (!sessao) return;
    var userId  = sessao.id;
    var naoLidas = DB.Notificacoes.naoLidas(userId);
    var todas    = DB.Notificacoes.porUsuario(userId).slice(0, 30);

    // Remover sinal antigo para re-renderizar
    var old = document.getElementById('notif-bell-wrapper');
    if (old) old.remove();

    var badgeHtml = naoLidas.length > 0
       '<span id="notif-badge" style="position:absolute;top:-5px;right:-5px;background:#e74c3c;color:#fff;border-radius:50%;font-size:10px;font-weight:700;min-width:17px;height:17px;display:flex;align-items:center;justify-content:center;padding:0 3px;pointer-events:none;line-height:1">' + (naoLidas.length > 9  '9+' : naoLidas.length) + '</span>'
      : '';

    var listaHtml = todas.length === 0
       '<div style="padding:28px 16px;text-align:center;color:var(--text-muted);font-size:13px">Nenhuma notificação</div>'
      : todas.map(function(n) {
          var icone = n.tipo === 'APROVADO'  'OK' : n.tipo === 'REJEITADO'  'X' : 'Info';
          var bgLida = n.lida  'transparent' : 'rgba(27,58,140,.07)';
          return '<div class="notif-item" data-id="' + n.id + '" data-lida="' + (n.lida  '1' : '0') + '" style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:' + bgLida + ';transition:background .15s">'
            + '<div style="display:flex;align-items:flex-start;gap:10px">'
            + '<span style="font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px">' + icone + '</span>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:13px;font-weight:' + (n.lida  '500' : '700') + ';color:var(--text);margin-bottom:2px">' + safe(n.titulo) + '</div>'
            + '<div style="font-size:12px;color:var(--text-muted);line-height:1.4">' + safe(n.mensagem) + '</div>'
            + '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">' + formatarDataHora(n.criadoEm) + '</div>'
            + '</div>'
            + (!n.lida  '<span style="width:8px;height:8px;min-width:8px;background:#e74c3c;border-radius:50%;margin-top:5px"></span>' : '')
            + '</div></div>';
        }).join('');

    var markAllBtn = naoLidas.length > 0
       '<button id="notif-mark-all" style="font-size:11px;color:var(--primary);background:none;border:none;cursor:pointer;font-weight:600;padding:0">Marcar todas como lidas</button>'
      : '';

    var wrapper = document.createElement('div');
    wrapper.id = 'notif-bell-wrapper';
    wrapper.style.cssText = 'position:relative;display:inline-flex;align-items:center';
    wrapper.innerHTML =
      '<button id="notif-bell-btn" title="Notifica-es" style="background:none;border:1px solid var(--border);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:700;color:var(--text);position:relative;line-height:1;height:36px;display:flex;align-items:center">NOTIF' + badgeHtml + '</button>'
      + '<div id="notif-dropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;width:340px;background:var(--card);border:1.5px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.2);z-index:9999;overflow:hidden">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">'
      + '<span style="font-weight:700;font-size:14px;color:var(--text)">Notifica-es</span>'
      + markAllBtn
      + '</div>'
      + '<div style="max-height:380px;overflow-y:auto">' + listaHtml + '</div>'
      + '</div>';

    var actions = document.querySelector('.topbar-actions');
    if (!actions) return;
    var themeBtn = document.getElementById('btn-theme');
    if (themeBtn) actions.insertBefore(wrapper, themeBtn);
    else actions.appendChild(wrapper);

    // Toggle dropdown
    document.getElementById('notif-bell-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      var dd = document.getElementById('notif-dropdown');
      if (dd) dd.style.display = dd.style.display === 'none'  'block' : 'none';
    });

    // Marcar como lida ao clicar
    wrapper.querySelectorAll('.notif-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var nid = el.dataset.id;
        if (nid) { DB.Notificacoes.marcarLida(nid); renderNotificacoes(); }
      });
      el.addEventListener('mouseover', function() { el.style.background = 'var(--bg)'; });
      el.addEventListener('mouseout', function() { el.style.background = el.dataset.lida === '1'  'transparent' : 'rgba(27,58,140,.07)'; });
    });

    // Marcar todas
    var markAllBtnEl = document.getElementById('notif-mark-all');
    if (markAllBtnEl) {
      markAllBtnEl.addEventListener('click', function(e) {
        e.stopPropagation();
        DB.Notificacoes.marcarTodasLidas(userId);
        renderNotificacoes();
      });
    }

    // Fechar ao clicar fora (usa flag para não duplicar listener)
    if (!document._notifOutsideListenerSet) {
      document._notifOutsideListenerSet = true;
      document.addEventListener('click', function(e) {
        var dd = document.getElementById('notif-dropdown');
        var bw = document.getElementById('notif-bell-wrapper');
        if (dd && bw && !bw.contains(e.target)) dd.style.display = 'none';
      });
    }

    // Auto-atualizar a cada 30s (configura apenas uma vez)
    if (!_notifRefreshTimer) {
      _notifRefreshTimer = setInterval(renderNotificacoes, 30000);
    }
  }

  // ── Logo da empresa ───────────────────────────────────────────
  function renderSidebarLogo() {
    const config = DB.Config.get();
    const img = document.getElementById('sidebar-logo-img');
    const txt = document.getElementById('sidebar-logo-text');
    if (img) {
      if (config.logo) {
        img.src = config.logo;
        img.style.display = 'block';
        if (txt) txt.style.display = 'none';
      } else {
        img.style.display = 'none';
        if (txt) txt.style.display = '';
      }
    }
  }

  function renderLoginLogo() {
    const config = DB.Config.get();
    const area  = document.getElementById('login-logo-area');
    if (!area) return;
    if (config.logo) {
      area.innerHTML = `<img src="${config.logo}" alt="Logo" style="max-height:72px;max-width:220px;object-fit:contain;margin-bottom:8px">`;
    } else {
      area.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="font-size:38px">🌟</div>
          <div style="font-size:22px;font-weight:800;color:#1B3A8C;letter-spacing:2px">ATLAS</div>
          <div style="font-size:10px;font-weight:700;color:#F7941D;letter-spacing:3px;text-transform:uppercase">Eletrodomésticos</div>
        </div>`;
    }
  }

  // ── Formatar moeda ──────────────────────────────────────────
  function fmtMoeda(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }

  // ── Select pesquisável ──────────────────────────────────────
  // Uso: Utils.initSearchSelect('id-do-select')
  // Transforma um <select> normal num input de busca com dropdown filtrado.
  // O select original é mantido oculto (para compatibilidade de form).
  function initSearchSelect(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel || sel.dataset.searchInit) return;
    sel.dataset.searchInit = '1';
    sel.style.display = 'none';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:block';
    sel.parentNode.insertBefore(wrapper, sel);
    wrapper.appendChild(sel);

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = sel.options[0]  sel.options[0].text : 'Buscar...';
    input.autocomplete = 'off';
    input.style.cssText = 'width:100%;box-sizing:border-box;';
    input.className = 'search-select-input';
    // Copiar classes do select para o input
    if (sel.className) input.className += ' ' + sel.className.replace('search-select-input','');
    wrapper.insertBefore(input, sel);

    var dropdown = document.createElement('div');
    dropdown.className = 'search-select-dropdown';
    dropdown.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--card);border:1.5px solid var(--primary);border-top:none;border-radius:0 0 8px 8px;z-index:999;max-height:220px;overflow-y:auto;display:none;box-shadow:0 6px 24px rgba(0,0,0,.18)';
    wrapper.appendChild(dropdown);

    function getOptions() {
      return Array.from(sel.options).map(function(o) { return { value: o.value, text: o.text }; });
    }

    function renderDropdown(q) {
      var opts = getOptions();
      var filtered = q  opts.filter(function(o) {
        return o.text.toLowerCase().includes(q.toLowerCase());
      }) : opts;
      if (!filtered.length) {
        dropdown.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:13px">Nenhum resultado</div>';
      } else {
        dropdown.innerHTML = filtered.map(function(o) {
          return '<div data-val="' + safe(o.value) + '" style="padding:9px 14px;cursor:pointer;font-size:13px;transition:background .1s" '
            + 'onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'\'">'
            + safe(o.text) + '</div>';
        }).join('');
        dropdown.querySelectorAll('div[data-val]').forEach(function(item) {
          item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            sel.value = item.dataset.val;
            input.value = item.textContent;
            dropdown.style.display = 'none';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          });
        });
      }
      dropdown.style.display = 'block';
    }

    // Sincronizar valor inicial
    if (sel.value && sel.selectedIndex > 0) {
      input.value = sel.options[sel.selectedIndex].text;
    }

    input.addEventListener('focus', function() { renderDropdown(input.value); });
    input.addEventListener('input', function() {
      sel.value = '';
      renderDropdown(input.value);
    });
    input.addEventListener('blur', function() {
      setTimeout(function() { dropdown.style.display = 'none'; }, 200);
      // Se o texto não corresponde a nenhuma opção, limpar
      var matched = Array.from(sel.options).find(function(o) { return o.text === input.value; });
      if (!matched) { input.value = sel.selectedIndex > 0  sel.options[sel.selectedIndex].text : ''; }
    });

    // Observar mudanças externas no select
    var mo = new MutationObserver(function() {
      if (sel.value && sel.selectedIndex > 0) {
        input.value = sel.options[sel.selectedIndex].text;
      } else if (!sel.value) {
        input.value = '';
      }
    });
    mo.observe(sel, { childList: true, attributes: true, attributeFilter: ['value'] });
  }

  // ── Lightbox com zoom ─────────────────────────────────
  var _lbZoom = 1;

  function _lbApplyZoom() {
    var img = document.getElementById('atlas-lb-img');
    var pct = document.getElementById('atlas-lb-zoom-pct');
    if (!img) return;
    var base = 'border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.6);display:block;transition:width .15s,height .15s;flex-shrink:0;';
    if (_lbZoom === 1) {
      img.style.cssText = 'max-width:88vw;max-height:72vh;width:auto;height:auto;object-fit:contain;' + base;
    } else {
      var nw = img.naturalWidth;
      var nh = img.naturalHeight;
      if (nw && nh) {
        var vw = window.innerWidth * 0.88;
        var vh = window.innerHeight * 0.72;
        var fitScale = Math.min(vw / nw, vh / nh);
        var w = Math.round(nw * fitScale * _lbZoom);
        var h = Math.round(nh * fitScale * _lbZoom);
        img.style.cssText = 'width:' + w + 'px;height:' + h + 'px;' + base;
      } else {
        // naturalWidth não disponível ainda — usa vw como base
        img.style.cssText = 'width:' + Math.round(88 * _lbZoom) + 'vw;height:auto;' + base;
      }
    }
    if (pct) pct.textContent = Math.round(_lbZoom * 100) + '%';
  }

  function abrirLightbox(src, titulo) {
    if (!src) return;
    var lb = document.getElementById('atlas-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'atlas-lightbox';
      lb.style.cssText = [
        'position:fixed;inset:0;z-index:9999',
        'background:rgba(0,0,0,.88)',
        'display:flex;flex-direction:column;align-items:center;justify-content:center',
        'padding:20px;box-sizing:border-box',
        'cursor:pointer'
      ].join(';');
      var btnStyle = 'background:rgba(255,255,255,.18);border:none;border-radius:8px;width:36px;height:36px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0;transition:background .15s;';
      lb.innerHTML = [
        '<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:94vw" onclick="event.stopPropagation()">',
          '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px">',
            '<span id="atlas-lb-titulo" style="color:#fff;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"></span>',
            '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">',
              '<button id="atlas-lb-zoom-out" style="' + btnStyle + 'font-size:24px;font-weight:300;" title="Diminuir (−)">−</button>',
              '<span id="atlas-lb-zoom-pct" style="color:rgba(255,255,255,.8);font-size:13px;font-weight:600;min-width:46px;text-align:center;user-select:none">100%</span>',
              '<button id="atlas-lb-zoom-in"  style="' + btnStyle + 'font-size:20px;" title="Ampliar (+)">+</button>',
              '<button id="atlas-lb-fechar"   style="' + btnStyle + 'border-radius:50%;font-size:18px;margin-left:6px;" title="Fechar (Esc)">✕</button>',
            '</div>',
          '</div>',
          '<div id="atlas-lb-wrap" style="overflow:auto;max-width:90vw;max-height:76vh;display:flex;align-items:flex-start;justify-content:center;width:100%;border-radius:10px;">',
            '<img id="atlas-lb-img" src="" alt="" style="max-width:88vw;max-height:72vh;object-fit:contain;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.6);display:block;">',
          '</div>',
        '</div>'
      ].join('');

      lb.addEventListener('click', function() {
        lb.style.display = 'none';
        _lbZoom = 1; _lbApplyZoom();
      });
      document.body.appendChild(lb);

      document.getElementById('atlas-lb-fechar').addEventListener('click', function(e) {
        e.stopPropagation();
        lb.style.display = 'none';
        _lbZoom = 1; _lbApplyZoom();
      });
      document.getElementById('atlas-lb-zoom-in').addEventListener('click', function(e) {
        e.stopPropagation();
        _lbZoom = Math.min(4, Math.round((_lbZoom + 0.25) * 100) / 100);
        _lbApplyZoom();
      });
      document.getElementById('atlas-lb-zoom-out').addEventListener('click', function(e) {
        e.stopPropagation();
        _lbZoom = Math.max(0.25, Math.round((_lbZoom - 0.25) * 100) / 100);
        _lbApplyZoom();
      });
      // Hover visual feedback
      ['atlas-lb-zoom-in','atlas-lb-zoom-out','atlas-lb-fechar'].forEach(function(id) {
        var btn = document.getElementById(id);
        btn.addEventListener('mouseenter', function() { this.style.background = 'rgba(255,255,255,.32)'; });
        btn.addEventListener('mouseleave', function() { this.style.background = 'rgba(255,255,255,.18)'; });
      });
      document.addEventListener('keydown', function(e) {
        if (lb.style.display === 'none') return;
        if (e.key === 'Escape') { lb.style.display = 'none'; _lbZoom = 1; _lbApplyZoom(); }
        if (e.key === '+' || e.key === '=') { _lbZoom = Math.min(4, Math.round((_lbZoom + 0.25)*100)/100); _lbApplyZoom(); }
        if (e.key === '-') { _lbZoom = Math.max(0.25, Math.round((_lbZoom - 0.25)*100)/100); _lbApplyZoom(); }
      });
    }
    _lbZoom = 1;
    _lbApplyZoom();
    document.getElementById('atlas-lb-img').src = src;
    document.getElementById('atlas-lb-titulo').textContent = titulo || '';
    lb.style.display = 'flex';
  }

  return {
    formatarData, formatarDataHora, dataHoje,
    statusEstoque, toast,
    abrirModal, fecharModal, fecharModalClicandoFora,
    marcarNavAtivo, renderSidebarUser, buildSidebar, aplicarPermissoes,
    lerArquivoBase64, fmt, safe, badgeEstoque, labelTipo, gerarToken,
    applyTheme, toggleTheme, renderSidebarLogo, renderLoginLogo, fmtMoeda, toggleSidebar,
    initSearchSelect, abrirLightbox, renderNotificacoes
  };
})();
