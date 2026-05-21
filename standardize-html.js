/**
 * standardize-html.js
 * Padroniza os HTMLs para usar sidebar com SVG icons
 * Aplica identidade visual Atlas consistentemente
 */
const fs = require('fs');
const path = require('path');

// Template do sidebar padronizado
const SIDEBAR_TEMPLATE = `<aside class="sidebar" id="sidebar">
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
  </div>
</aside>`;

// SVG Sprite para injetar em utils.js
const SVG_SPRITE_HTML = `<!-- Sprites SVG — Injetados por utils.js -->
<svg id="atlas-svg-sprite" xmlns="http://www.w3.org/2000/svg" style="display:none">
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

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'consertos-link.html' && f !== 'retirada.html' && f !== 'index.html');

files.forEach(f => {
  console.log(`\nProcessando: ${f}`);
  const fp = path.join(dir, f);
  let html = fs.readFileSync(fp, 'utf-8');

  // 1. Remover sidebar antiga
  html = html.replace(/<aside class="sidebar"[^]*?<\/aside>/i, SIDEBAR_TEMPLATE);

  // 2. Garantir SVG sprite injetado (utils.js já faz isso dinamicamente)
  // Mas deixamos o template pronto

  // 3. Fix: remover '' vazios do CSS link
  html = html.replace(/style\.css([^\d\w?])/g, 'style.css?v=3$1');

  // 4. Garantir correto encoding nos títulos
  html = html.replace(/class="topbar-title">\s*[^<]*/g, (match) => {
    // Se tem ??, deixar como está (será corrigido em próxima iteração)
    // Remover prefixo de emoji/caracteres estranhos
    const inner = match.substring(match.indexOf('>') + 1).trim();
    if (inner.startsWith('??') || inner.startsWith('Gest')) {
      // Titulo foi decodificado ou tem símbolos — limpar
      const titulo = inner.replace(/^[\?]+\s*/, '').trim();
      const cleanTitle = match.substring(0, match.indexOf('>') + 1) + titulo;
      return cleanTitle;
    }
    return match;
  });

  fs.writeFileSync(fp, html, 'utf-8');
  console.log(`  ✓ Sidebar padronizado`);
  console.log(`  ✓ CSS link atualizado`);
});

console.log(`\n✅ Padronização completa!`);
