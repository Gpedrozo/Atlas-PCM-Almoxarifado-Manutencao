// ═══════════════════════════════════════════════════════
//  ENGINE DE E-MAIL — CONSERTOS
// ═══════════════════════════════════════════════════════

var _ejsConsertoKey = '';

function _initEmailJSConsertos() {
  var cfg = DB.Config.get();
  var key = cfg.emailjsPublicKey || '';
  if (!key) return false;
  if (key !== _ejsConsertoKey) {
    try {
      emailjs.init({ publicKey: key });
      _ejsConsertoKey = key;
    } catch (e) {
      console.warn('EmailJS init (consertos):', e);
      return false;
    }
  }
  return true;
}

function _buildConsertoParams(s, cfg) {
  var sysUrl = (cfg.sysUrl || window.location.origin + '/').replace(/\/$/, '/');
  var solicitante = DB.Usuarios.buscarId(s.solicitanteId);
  function fmtDate(d) { return d  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '-'; }
  function fmtMoeda(v) { return v  'R$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'; }
  return {
    // — Identificação —
    conserto_numero:                s.numeroSolicitacao || s.id,
    conserto_status:                _statusConserto(s.status) || '—',
    conserto_data_abertura:         s.data_abertura  new Date(s.data_abertura).toLocaleString('pt-BR') : '—',
    solicitante_nome:               solicitante  solicitante.nome : '—',
    to_name:                        solicitante  solicitante.nome : 'Equipe PCM',
    // — Material —
    conserto_material:              [(s.codigo_material_sap || ''), (s.descricao_material_sap || '')].filter(Boolean).join(' — ') || '—',
    conserto_codigo_sap:            s.codigo_material_sap || '—',
    conserto_descricao:             s.descricao_material_sap || s.descricao_interna || '—',
    conserto_quantidade:            s.quantidade || '—',
    conserto_unidade:               s.unidade_medida || '—',
    conserto_numero_serie:          s.numero_serie || '—',
    conserto_fabricante:            s.fabricante || '—',
    conserto_modelo:                s.modelo || '—',
    conserto_valor:                 fmtMoeda(s.valor_material),
    // — Localização —
    conserto_tag:                   s.tag_patrimonio || '—',
    conserto_localizacao:           s.localizacao || '—',
    conserto_setor:                 s.setor || '—',
    conserto_centro_custo:          s.centro_custo || '—',
    conserto_criticidade:           s.criticidade || '—',
    // — Diagnóstico —
    conserto_motivo:                s.motivo_envio || '—',
    conserto_diagnostico:           s.diagnostico_inicial || '—',
    conserto_observacoes:           s.observacoes_manutencao || '—',
    // — Fornecedor —
    conserto_fornecedor:            s.fornecedor_razao_social || '—',
    conserto_fornecedor_cnpj:       s.fornecedor_cnpj || '—',
    conserto_fornecedor_email:      s.fornecedor_email || '—',
    conserto_tipo_servico:          s.tipo_servico || '—',
    // — Datas & Envio —
    conserto_data_prevista_envio:   fmtDate(s.data_prevista_envio),
    conserto_data_prevista_retorno: fmtDate(s.data_prevista_retorno),
    conserto_data_envio:            fmtDate(s.data_real_envio),
    conserto_responsavel_envio:     s.responsavel_envio || '—',
    conserto_transportadora:        s.transportadora || '—',
    // — Retorno —
    conserto_data_retorno:          fmtDate(s.data_real_retorno),
    conserto_condicao:              s.condicao_item || '—',
    conserto_servico_executado:     s.servico_executado || '—',
    conserto_valor_final:           fmtMoeda(s.valor_final_conserto),
    conserto_nf_retorno:            s.nf_retorno || '—',
    conserto_nf_numero:             s.nf_retorno || '—',
    conserto_item_aprovado:         s.item_aprovado !== undefined  (s.item_aprovado  'Sim' : 'No') : '-',
    conserto_reenviar:              s.precisa_reenviar !== undefined  (s.precisa_reenviar  'Sim' : 'No') : '-',
    // — Links —
    link_conserto:                  sysUrl + 'consertos.html'
  };
}

function _getDestinatariosConserto(cfg) {
  return (cfg.emailAprovadores || '').split(',').map(function (e) { return e.trim(); }).filter(Boolean);
}

function _enviarEmailConserto(templateId, params, destinos, labelLog) {
  if (!templateId || !destinos.length) return;
  var cfg = DB.Config.get();
  if (!cfg.emailjsServiceId) return;
  if (!_initEmailJSConsertos()) return;
  destinos.forEach(function (email) {
    emailjs.send(cfg.emailjsServiceId, templateId, Object.assign({}, params, { to_email: email }))
      .catch(function (err) { console.warn('EmailJS ' + (labelLog || 'conserto') + ' → ' + email + ':', err); });
  });
}

/** E-mail disparado ao criar nova solicitação (vai para a equipe PCM). */
function enviarEmailConsertoNovo(s) {
  var cfg = DB.Config.get();
  var templateId = cfg.emailjsTemplateIdConsertoNovo;
  var destinos = _getDestinatariosConserto(cfg);
  if (!templateId || !destinos.length) return;
  _enviarEmailConserto(templateId, _buildConsertoParams(s, cfg), destinos, 'nova solicitação');
}

/** E-mail disparado ao registrar retorno físico do material. */
function enviarEmailConsertoRetorno(s) {
  var cfg = DB.Config.get();
  var templateId = cfg.emailjsTemplateIdConsertoRetorno;
  var destinos = _getDestinatariosConserto(cfg);
  if (!templateId || !destinos.length) return;
  _enviarEmailConserto(templateId, _buildConsertoParams(s, cfg), destinos, 'retorno');
  Utils.toast('E-mail de retorno enviado à equipe.', 'success');
}

/**
 * E-mail de prazo vencido. Evita reenvio usando flag `prazoEmailEnviadoEm`
 * gravada na própria solicitação.
 */
function enviarEmailConsertoPrazoVencido(s) {
  var cfg = DB.Config.get();
  var templateId = cfg.emailjsTemplateIdConsertoPrazo;
  var destinos = _getDestinatariosConserto(cfg);
  if (!templateId || !destinos.length) return;
  _enviarEmailConserto(templateId, _buildConsertoParams(s, cfg), destinos, 'prazo vencido');
}

/** E-mail disparado quando a contabilidade anexa a NF (chamado por consertos-link.js). */
function enviarEmailConsertoNFAnexada(s) {
  var cfg = DB.Config.get();
  var templateId = cfg.emailjsTemplateIdConsertoNF;
  var destinos = _getDestinatariosConserto(cfg);
  if (!templateId || !destinos.length) return;
  _enviarEmailConserto(templateId, _buildConsertoParams(s, cfg), destinos, 'NF anexada');
}

/**
 * Envia o link seguro por e-mail para o contato do fornecedor/contabilidade.
 * Usa o e-mail armazenado na solicitação (fornecedor_email).
 * Se não houver e-mail configurado, exibe aviso para copiar manualmente.
 */
function _enviarLinkConsertoEmail(item, linkUrl) {
  var cfg      = DB.Config.get();
  var destinos = (cfg.emailContabilidade || '').split(',').map(function(e){ return e.trim(); }).filter(Boolean);
  if (!destinos.length) {
    Utils.toast('Link gerado! E-mail da contabilidade não configurado em Configurações → Aprovação. Copie o link e envie manualmente.', 'warning');
    return;
  }
  var templateId = cfg.emailjsTemplateIdConsertoNovo;
  var params     = _buildConsertoParams(item, cfg);
  params.link_conserto   = linkUrl;
  params.conserto_status = 'Aguardando NF — Link de upload enviado para contabilidade';
  _enviarEmailConserto(templateId, params, destinos, 'link contabilidade');
  Utils.toast('Link enviado para contabilidade: ' + destinos.join(', ') + '.', 'success');
}

// ═══════════════════════════════════════════════════════

function _inicializar() {
  document.getElementById('busca-consertos').addEventListener('input', renderTabela);
  document.getElementById('filtro-status-consertos').addEventListener('change', function() {
    _filtroRapidoConsertos = 'todos';
    renderTabela();
  });
  document.getElementById('form-conserto').addEventListener('submit', salvarSolicitacao);

  // Filtros adicionais da aba Solicitações
  var fForn = document.getElementById('filtro-fornecedor-consertos');
  var fIni = document.getElementById('filtro-data-ini');
  var fFim = document.getElementById('filtro-data-fim');
  if (fForn) fForn.addEventListener('change', renderTabela);
  if (fIni) fIni.addEventListener('change', renderTabela);
  if (fFim) fFim.addEventListener('change', renderTabela);

  // ── Auto-preenchimento pelo Código SAP do material ──────────────
  var _sapTimer = null;
  var sapInput = document.getElementById('conserto-codigo-sap');
  sapInput.addEventListener('blur', function() {
    var v = this.value.trim();
    if (v && !solicitacaoAtualId) _autoPreencherByCodigo(v);
  });
  sapInput.addEventListener('input', function() {
    var v = this.value.trim();
    clearTimeout(_sapTimer);
    if (v.length >= 3 && !solicitacaoAtualId) {
      _sapTimer = setTimeout(function() { _autoPreencherByCodigo(v); }, 600);
    }
  });

  // ── Auto-preenchimento pelo Código SAP do fornecedor ────────────
  document.getElementById('conserto-fornecedor-codigo').addEventListener('blur', function() {
    var v = this.value.trim();
    if (v && !solicitacaoAtualId) _autoPreencherFornecedor(v);
  });

  renderAtivos();
  renderTabela();
  renderTabelasPrecos();
  checarPrazos();
}

// Aplica destaque visual transitório nos campos preenchidos automaticamente
function _flashAutoFill(el) {
  el.style.transition = 'background-color 0.25s';
  el.style.backgroundColor = 'rgba(99,102,241,0.13)';
  setTimeout(function() {
    el.style.backgroundColor = '';
    setTimeout(function() { el.style.transition = ''; }, 300);
  }, 1800);
}

// Busca o registro mais recente com o código SAP e preenche o formulário
function _autoPreencherByCodigo(codigo) {
  if (solicitacaoAtualId) return; // Somente em novas solicitações
  const item = DB.Consertos.buscarPorCodigoSAP(codigo);
  if (!item) return;

  const mapa = [
    ['conserto-descricao-sap',      item.descricao_material_sap],
    ['conserto-codigo-interno',     item.codigo_interno],
    ['conserto-descricao-interna',  item.descricao_interna],
    ['conserto-unidade',            item.unidade_medida],
    ['conserto-fabricante',         item.fabricante],
    ['conserto-modelo',             item.modelo],
    ['conserto-tag',                item.tag_patrimonio],
    ['conserto-localizacao',        item.localizacao],
    ['conserto-setor',              item.setor],
    ['conserto-centro-custo',       item.centro_custo],
    ['conserto-criticidade',        item.criticidade],
    ['conserto-prioridade',         item.prioridade],
    ['conserto-potencia',           item.potencia],
    ['conserto-fornecedor-codigo',  item.fornecedor_codigo_sap],
    ['conserto-fornecedor-razao',   item.fornecedor_razao_social],
    ['conserto-fornecedor-nome',    item.fornecedor_nome_fantasia],
    ['conserto-fornecedor-cnpj',    item.fornecedor_cnpj],
    ['conserto-fornecedor-email',   item.fornecedor_email],
    ['conserto-fornecedor-servico', item.tipo_servico],
    ['conserto-ativo-id',           item.ativo_id],
  ];

  var preenchidos = 0;
  mapa.forEach(function(par) {
    var el = document.getElementById(par[0]);
    if (el && par[1]) {
      el.value = par[1];
      _flashAutoFill(el);
      preenchidos++;
    }
  });

  if (preenchidos > 0) {
    Utils.toast(
      'Dados preenchidos automaticamente a partir do registro ' + item.numeroSolicitacao + '. Verifique e ajuste se necessário.',
      'info'
    );
  }
}

// Busca fornecedor pelo código SAP e preenche os campos de fornecedor
function _autoPreencherFornecedor(codigoFornecedor) {
  if (solicitacaoAtualId) return;
  const item = DB.Consertos.buscarFornecedorPorCodigo(codigoFornecedor);
  if (!item) return;

  const mapa = [
    ['conserto-fornecedor-razao',   item.fornecedor_razao_social],
    ['conserto-fornecedor-nome',    item.fornecedor_nome_fantasia],
    ['conserto-fornecedor-cnpj',    item.fornecedor_cnpj],
    ['conserto-fornecedor-email',   item.fornecedor_email],
    ['conserto-fornecedor-servico', item.tipo_servico],
  ];

  var preenchidos = 0;
  mapa.forEach(function(par) {
    var el = document.getElementById(par[0]);
    if (el && par[1]) {
      el.value = par[1];
      _flashAutoFill(el);
      preenchidos++;
    }
  });

  if (preenchidos > 0) {
    Utils.toast('Dados do fornecedor preenchidos automaticamente.', 'info');
  }
}

function checarPrazos() {
  const agora = new Date();
  DB.Consertos.listar().forEach(function(s) {
    if (!s.data_prevista_retorno) return;
    const st = _statusConserto(s.status);
    if (st === 'Material retornado' || st === 'Finalizado' || st === 'Cancelado') return;
    const prevista = new Date(s.data_prevista_retorno + 'T23:59:59');
    if (agora > prevista) {
      s.prazoVencido = true;
      // Atualiza status para "Prazo de retorno vencido" apenas se o material já foi enviado/está em conserto
      if (['Enviado para conserto', 'Em conserto', 'Liberado para envio'].includes(st)) {
        s.status = 'Prazo de retorno vencido';
      } else if (st !== 'Prazo de retorno vencido') {
        // Mantém o status atual para outros estados (aguardando NF, etc.)
      }
      // Envia e-mail de prazo vencido apenas uma vez por dia (evita spam)
      const hoje = agora.toISOString().slice(0, 10);
      if (s.prazoEmailEnviadoEm !== hoje) {
        s.prazoEmailEnviadoEm = hoje;
        enviarEmailConsertoPrazoVencido(s);
      }
      DB.Consertos.salvar(s);
      const _sessao = Auth.getSessao();
      if (_sessao) {
        DB.Notificacoes.criar({ userId: s.solicitanteId || _sessao.id, titulo: 'Prazo de retorno vencido', mensagem: 'Solicitação ' + (s.numeroSolicitacao||'') + ' está com prazo de retorno vencido.' });
      }
    }
  });
}

function renderAtivos() {
  const ativoSelect = document.getElementById('conserto-ativo-id');
  if (!ativoSelect) return;
  const ativos = DB.Ativos.ativos();
  ativoSelect.innerHTML = '<option value="">Não vincular ativo</option>' + ativos.map(function(a) {
    return '<option value="' + a.id + '">' + Utils.safe(a.tag || '') + ' — ' + Utils.safe(a.descricao || '') + '</option>';
  }).join('');
}

const STATUS_SOLICITACAO_ABERTA = 'Solicita\u00e7\u00e3o aberta';
const KANBAN_CONSERTOS = [
  { id: 'triagem', titulo: 'Triagem', desc: 'Abertura e conferencia SAP', statuses: [STATUS_SOLICITACAO_ABERTA, 'Solicitacao aberta', 'Dados SAP conferidos'] },
  { id: 'nf', titulo: 'NF / Contabilidade', desc: 'Link, acesso e NF anexada', statuses: ['Enviado para contabilidade', 'Aguardando NF', 'Link acessado', 'Link expirado', 'Novo link gerado', 'NF anexada'] },
  { id: 'envio', titulo: 'Envio', desc: 'Liberado para remessa', statuses: ['Liberado para envio'] },
  { id: 'conserto', titulo: 'Em conserto', desc: 'Fornecedor executando servico', statuses: ['Enviado para conserto', 'Em conserto', 'Prazo de retorno vencido'] },
  { id: 'retorno', titulo: 'Retorno', desc: 'Recebido e em encerramento', statuses: ['Material retornado'] },
  { id: 'finalizado', titulo: 'Finalizados', desc: 'Processos encerrados', statuses: ['Finalizado'] },
  { id: 'cancelado', titulo: 'Cancelados', desc: 'Interrompidos ou invalidados', statuses: ['Cancelado'] }
];

var _filtroRapidoConsertos = 'todos';

function _statusConserto(s) {
  const st = String(s || '').trim();
  const low = st.toLowerCase();
  if (!st) return STATUS_SOLICITACAO_ABERTA;
  if (low.includes('solicit') && low.includes('aberta')) return STATUS_SOLICITACAO_ABERTA;
  if (low === 'nf de remessa anexada') return 'NF anexada';
  return st;
}

function _laneConserto(item) {
  const st = _statusConserto(item.status);
  return KANBAN_CONSERTOS.find(function(col) { return col.statuses.includes(st); }) || KANBAN_CONSERTOS[0];
}

function _isConsertoVencido(item) {
  return !!item.prazoVencido || _statusConserto(item.status) === 'Prazo de retorno vencido';
}

function _matchFiltroRapidoConsertos(item) {
  const st = _statusConserto(item.status);
  const tipo = _filtroRapidoConsertos || 'todos';
  if (tipo === 'todos') return true;
  if (tipo === 'abertos') return [STATUS_SOLICITACAO_ABERTA, 'Dados SAP conferidos'].includes(st);
  if (tipo === 'nf') return ['Enviado para contabilidade', 'Aguardando NF', 'Link acessado', 'Link expirado', 'Novo link gerado', 'NF anexada'].includes(st);
  if (tipo === 'operacao') return ['Liberado para envio', 'Enviado para conserto', 'Em conserto', 'Prazo de retorno vencido'].includes(st);
  if (tipo === 'retorno') return st === 'Material retornado';
  if (tipo === 'vencidos') return _isConsertoVencido(item);
  if (tipo === 'finalizados') return st === 'Finalizado';
  return true;
}

function _setFiltroRapidoConsertos(tipo) {
  _filtroRapidoConsertos = tipo || 'todos';
  if (_filtroRapidoConsertos !== 'todos') {
    const sel = document.getElementById('filtro-status-consertos');
    if (sel) sel.value = '';
  }
  renderTabela();
}

function _valorDataConserto(v) {
  if (!v) return 0;
  const d = new Date(v + 'T12:00:00');
  const t = d.getTime();
  return Number.isFinite(t)  t : 0;
}

function _fmtDataConserto(v, fallback) {
  if (!v) return fallback || '-';
  const d = new Date(v + 'T12:00:00');
  return Number.isFinite(d.getTime())  d.toLocaleDateString('pt-BR') : (fallback || '-');
}

function _prazoConserto(item) {
  const st = _statusConserto(item.status);
  if (['Finalizado', 'Cancelado'].includes(st)) return { texto: st, classe: st === 'Finalizado'  'ok' : 'danger' };
  const data = item.data_prevista_retorno || item.dataPrevisaoRetorno || '';
  if (_isConsertoVencido(item)) return { texto: 'Prazo vencido', classe: 'danger' };
  if (!data) return { texto: 'Sem previsao', classe: '' };
  const hoje = new Date();
  const prazo = new Date(data + 'T12:00:00');
  if (!Number.isFinite(prazo.getTime())) return { texto: 'Prazo indefinido', classe: '' };
  hoje.setHours(0, 0, 0, 0);
  prazo.setHours(0, 0, 0, 0);
  const dias = Math.round((prazo - hoje) / 86400000);
  if (dias < 0) return { texto: 'Vencido ha ' + Math.abs(dias) + 'd', classe: 'danger' };
  if (dias === 0) return { texto: 'Vence hoje', classe: 'warn' };
  if (dias <= 3) return { texto: 'Vence em ' + dias + 'd', classe: 'warn' };
  return { texto: _fmtDataConserto(data, 'Sem previsao'), classe: '' };
}

function _ordenarConsertos(a, b) {
  const av = _isConsertoVencido(a)  1 : 0;
  const bv = _isConsertoVencido(b)  1 : 0;
  if (av !== bv) return bv - av;
  const ap = _valorDataConserto(a.data_prevista_retorno || a.dataPrevisaoRetorno);
  const bp = _valorDataConserto(b.data_prevista_retorno || b.dataPrevisaoRetorno);
  if (ap && bp && ap !== bp) return ap - bp;
  if (ap !== bp) return ap  -1 : 1;
  return _valorDataConserto(b.dataAbertura || b.data_abertura) - _valorDataConserto(a.dataAbertura || a.data_abertura);
}

function _consertosFiltrados() {
  const busca = (document.getElementById('busca-consertos') || {}).value || '';
  const buscaL = busca.toLowerCase();
  const rawStatusFiltro = (document.getElementById('filtro-status-consertos') || {}).value || '';
  const statusFiltro = rawStatusFiltro  _statusConserto(rawStatusFiltro) : '';
  const fornFiltro = (document.getElementById('filtro-fornecedor-consertos') || {}).value || '';
  const dataIni = (document.getElementById('filtro-data-ini') || {}).value || '';
  const dataFim = (document.getElementById('filtro-data-fim') || {}).value || '';

  return DB.Consertos.listar().filter(function(item) {
    const st = _statusConserto(item.status);
    if (!_matchFiltroRapidoConsertos(item)) return false;
    if (buscaL) {
      const texto = [item.numeroSolicitacao, item.codigo_material_sap, item.descricao_material_sap,
        item.fornecedor_razao_social, item.fornecedor_nome_fantasia, item.tag_patrimonio, st,
        item.descricao_interna, item.fabricante, item.modelo, item.responsavel_manutencao].join(' ').toLowerCase();
      if (!texto.includes(buscaL)) return false;
    }
    if (statusFiltro && st !== statusFiltro) return false;
    if (fornFiltro) {
      const fNome = (item.fornecedor_razao_social || item.fornecedor_nome_fantasia || '').trim();
      if (fNome !== fornFiltro) return false;
    }
    if (dataIni && (item.dataAbertura || item.data_abertura || '') < dataIni) return false;
    if (dataFim && (item.dataAbertura || item.data_abertura || '') > dataFim) return false;
    return true;
  }).sort(_ordenarConsertos);
}

function renderTabela() {
  const rows = _consertosFiltrados();
  const board = document.getElementById('kanban-consertos');
  if (!board) return;

  const byLane = {};
  KANBAN_CONSERTOS.forEach(function(col) { byLane[col.id] = []; });
  rows.forEach(function(item) { byLane[_laneConserto(item).id].push(item); });

  board.innerHTML = KANBAN_CONSERTOS.map(function(col) {
    const cards = byLane[col.id] || [];
    return '<section class="kanban-col" data-lane="' + col.id + '" ondragover="_kanbanDragOver(event)" ondragleave="_kanbanDragLeave(event)" ondrop="_kanbanDrop(event)">'
      + '<div class="kanban-col-head">'
      + '<div><div class="kanban-col-title">' + Utils.safe(col.titulo) + '</div><div class="kanban-col-sub">' + Utils.safe(col.desc) + '</div></div>'
      + '<div class="kanban-col-count">' + cards.length + '</div>'
      + '</div>'
      + '<div class="kanban-col-body">'
      + (cards.length  cards.map(_kanbanCard).join('') : '<div class="kanban-empty">Sem itens nesta etapa</div>')
      + '</div>'
      + '</section>';
  }).join('');

  const empty = document.getElementById('empty-state-consertos');
  if (empty) empty.style.display = rows.length  'none' : '';
  renderIndicadores();
  _preencherSelectFornecedorRelatorios();
}

function _kanbanCard(item) {
  const ativo = item.ativo_id  DB.Ativos.buscarId(item.ativo_id) : null;
  const st = _statusConserto(item.status);
  const prazo = _prazoConserto(item);
  const vencido = _isConsertoVencido(item);
  const done = ['Finalizado', 'Material retornado'].includes(st);
  const material = item.descricao_material_sap || item.descricao_interna || item.codigo_material_sap || 'Material sem descricao';
  const fornecedor = item.fornecedor_razao_social || item.fornecedor_nome_fantasia || 'Fornecedor nao definido';
  const tag = ativo  ativo.tag : (item.tag_patrimonio || '');
  const prev = _fmtDataConserto(item.data_prevista_retorno || item.dataPrevisaoRetorno, 'Sem previsao');
  const prioridade = item.prioridade || 'Normal';
  const actions = _kanbanActions(item);
  const temNF = item.data_nf_anexada  true : false; // MELHORIAS: Verificar se tem NF anexada

  return '<article class="kanban-card ' + (vencido  'is-overdue ' : '') + (done  'is-done' : '') + '" draggable="true" data-id="' + item.id + '"'
    + ' ondragstart="_kanbanDragStart(event)" ondragend="_kanbanDragEnd(event)" ondblclick="abrirDetalhes(\'' + item.id + '\')" onclick="_kanbanCardClick(event,\'' + item.id + '\')">'
    + '<div class="kanban-card-top">'
    + '<div><div class="kanban-num">' + Utils.safe(item.numeroSolicitacao || item.id) + '</div>' + statusBadge(st) + '</div>'
    + (temNF  '<span class="kanban-badge-nf">📄</span>' : '')
    + '</div>'
    + '<div class="kanban-title">' + Utils.safe(material) + '</div>'
    + '<div class="kanban-subtitle">' + Utils.safe(fornecedor) + '</div>' // MELHORIAS: Fornecedor como subtítulo
    + '<div class="kanban-meta">'
    + '<div class="kanban-meta-row"><span class="kanban-meta-label">TAG:</span><span class="kanban-meta-val">' + Utils.safe(tag || '-') + '</span></div>'
    + '<div class="kanban-meta-row"><span class="kanban-meta-label">Ret.:</span><span class="kanban-meta-val">' + Utils.safe(prev) + '</span></div>' // MELHORIAS: Simplificado "Ret.:" em vez de "Prev.:"
    + '</div>'
    + '<div class="kanban-tags">'
    + '<span class="kanban-tag">' + Utils.safe(prioridade) + '</span>'
    + '<span class="kanban-tag ' + Utils.safe(prazo.classe || '') + '">' + Utils.safe(prazo.texto) + '</span>'
    + '</div>'
    + '<div class="kanban-actions">'
    + (actions  actions : '<button class="btn btn-sm btn-primary" onclick="abrirDetalhes(\'' + item.id + '\')">Detalhes</button>')
    + '</div>'
    + '</article>';
}

function _kanbanActions(item) {
  const st = _statusConserto(item.status);
  if (st === STATUS_SOLICITACAO_ABERTA) return '<button class="btn btn-sm btn-primary" onclick="conferirSAP(\'' + item.id + '\')">Conferir SAP</button>';
  if (st === 'Dados SAP conferidos') return '<button class="btn btn-sm btn-primary" onclick="enviarParaContabilidade(\'' + item.id + '\')">Enviar NF</button>';
  if (['Enviado para contabilidade', 'Aguardando NF', 'Link acessado', 'Link expirado', 'Novo link gerado'].includes(st)) return '<button class="btn btn-sm btn-primary" onclick="gerarLinkSeguro(\'' + item.id + '\')">Gerar link</button>';
  if (st === 'NF anexada') return '<button class="btn btn-sm btn-success" onclick="liberarParaEnvio(\'' + item.id + '\')">Liberar envio</button>';
  if (st === 'Liberado para envio') return '<button class="btn btn-sm btn-primary" onclick="registrarEnvio(\'' + item.id + '\')">Registrar envio</button>';
  if (st === 'Enviado para conserto') return '<button class="btn btn-sm btn-primary" onclick="marcarEmConserto(\'' + item.id + '\')">Em conserto</button>';
  if (st === 'Em conserto' || st === 'Prazo de retorno vencido') return '<button class="btn btn-sm btn-success" onclick="registrarRetorno(\'' + item.id + '\')">Registrar retorno</button>';
  if (st === 'Material retornado') return '<button class="btn btn-sm btn-success" onclick="finalizarSolicitacao(\'' + item.id + '\')">Finalizar</button>';
  return '';
}

function _kanbanCardClick(event, id) {
  if (event.target.closest('button')) return;
  abrirDetalhes(id);
}

function _kanbanDragStart(event) {
  const card = event.currentTarget;
  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', card.dataset.id);
}

function _kanbanDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.kanban-col.is-drop').forEach(function(el) { el.classList.remove('is-drop'); });
}

function _kanbanDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('is-drop');
}

function _kanbanDragLeave(event) {
  event.currentTarget.classList.remove('is-drop');
}

function _kanbanDrop(event) {
  event.preventDefault();
  const lane = event.currentTarget.dataset.lane;
  const id = event.dataTransfer.getData('text/plain');
  event.currentTarget.classList.remove('is-drop');
  _moverKanban(id, lane);
}

function _moverKanban(id, lane) {
  const s = DB.Consertos.buscarId(id);
  if (!s) return;
  const atual = _laneConserto(s).id;
  if (lane === atual) return;
  const st = _statusConserto(s.status);
  if (lane === 'cancelado') return cancelarSolicitacao(id);
  if (lane === 'nf' && [STATUS_SOLICITACAO_ABERTA, 'Dados SAP conferidos'].includes(st)) return enviarParaContabilidade(id);
  if (lane === 'envio' && st === 'NF anexada') return liberarParaEnvio(id);
  if (lane === 'conserto' && st === 'Liberado para envio') return registrarEnvio(id);
  if (lane === 'conserto' && st === 'Enviado para conserto') return marcarEmConserto(id);
  if (lane === 'retorno' && ['Em conserto', 'Prazo de retorno vencido'].includes(st)) return registrarRetorno(id);
  if (lane === 'finalizado' && st === 'Material retornado') return finalizarSolicitacao(id);
  Utils.toast('Movimento exige etapa anterior ou dados complementares. Abra os detalhes do card.', 'warning');
  abrirDetalhes(id);
}

function statusBadge(status) {
  status = _statusConserto(status);
  const cor = status === STATUS_SOLICITACAO_ABERTA  'badge-low'
    : status === 'Dados SAP conferidos'  'badge-pending'
    : (status === 'Enviado para contabilidade' || status === 'Aguardando NF')  'badge-pending'
    : status === 'Link acessado'  'badge-pending'
    : status === 'Link expirado'  'badge-critical'
    : status === 'Novo link gerado'  'badge-pending'
    : status === 'NF anexada'  'badge-ok'
    : status === 'Liberado para envio'  'badge-ok'
    : status === 'Enviado para conserto'  'badge-pending'
    : status === 'Em conserto'  'badge-pending'
    : status === 'Prazo de retorno vencido'  'badge-critical'
    : status === 'Material retornado'  'badge-ok'
    : status === 'Finalizado'  'badge-ok'
    : status === 'Cancelado'  'badge-critical'
    : 'badge-pending';
  return '<span class="badge ' + cor + '">' + Utils.safe(status || '-') + '</span>';
}

function abrirNovaSolicitacao() {
  solicitacaoAtualId = null;
  document.getElementById('modal-conserto-titulo').textContent = 'Nova Solicitação de Conserto';
  document.getElementById('form-conserto').reset();
  document.getElementById('conserto-id').value = '';
  document.getElementById('conserto-numero').textContent = 'Será gerado automaticamente';
  document.getElementById('conserto-confirm-sap').checked = false;
  document.getElementById('conserto-status-banner').style.display = 'none';
  Utils.abrirModal('modal-conserto');
}

function editarSolicitacao(id) {
  const item = DB.Consertos.buscarId(id);
  if (!item) return Utils.toast('Solicitação não encontrada.', 'error');
  solicitacaoAtualId = id;
  document.getElementById('modal-conserto-titulo').textContent = 'Editar Solicitação #' + item.numeroSolicitacao;
  document.getElementById('conserto-id').value = item.id;
  document.getElementById('conserto-numero').textContent = item.numeroSolicitacao || '—';
  document.getElementById('conserto-codigo-sap').value = item.codigo_material_sap || '';
  document.getElementById('conserto-descricao-sap').value = item.descricao_material_sap || '';
  document.getElementById('conserto-codigo-interno').value = item.codigo_interno || '';
  document.getElementById('conserto-descricao-interna').value = item.descricao_interna || '';
  document.getElementById('conserto-quantidade').value = item.quantidade || '';
  document.getElementById('conserto-valor').value = item.valor_material || '';
  document.getElementById('conserto-unidade').value = item.unidade_medida || '';
  document.getElementById('conserto-numero-serie').value = item.numero_serie || '';
  document.getElementById('conserto-tag').value = item.tag_patrimonio || '';
  document.getElementById('conserto-fabricante').value = item.fabricante || '';
  document.getElementById('conserto-modelo').value = item.modelo || '';
  document.getElementById('conserto-localizacao').value = item.localizacao || '';
  document.getElementById('conserto-setor').value = item.setor || '';
  document.getElementById('conserto-centro-custo').value = item.centro_custo || '';
  document.getElementById('conserto-criticidade').value = item.criticidade || '';
  document.getElementById('conserto-prioridade').value = item.prioridade || '';
  document.getElementById('conserto-potencia').value = item.potencia || '';
  document.getElementById('conserto-responsavel-manutencao').value = item.responsavel_manutencao || '';
  document.getElementById('conserto-motivo').value = item.motivo_envio || '';
  document.getElementById('conserto-diagnostico').value = item.diagnostico_inicial || '';
  document.getElementById('conserto-observacoes').value = item.observacoes_manutencao || '';
  document.getElementById('conserto-fornecedor-codigo').value = item.fornecedor_codigo_sap || '';
  document.getElementById('conserto-fornecedor-razao').value = item.fornecedor_razao_social || '';
  document.getElementById('conserto-fornecedor-nome').value = item.fornecedor_nome_fantasia || '';
  document.getElementById('conserto-fornecedor-cnpj').value = item.fornecedor_cnpj || '';
  document.getElementById('conserto-fornecedor-email').value = item.fornecedor_email || '';
  document.getElementById('conserto-fornecedor-servico').value = item.tipo_servico || '';
  document.getElementById('conserto-data-prevista-envio').value = item.data_prevista_envio || '';
  document.getElementById('conserto-data-prevista-retorno').value = item.data_prevista_retorno || '';
  document.getElementById('conserto-ativo-id').value = item.ativo_id || '';
  document.getElementById('conserto-confirm-sap').checked = item.confirmadoSAP === true;
  document.getElementById('conserto-status-banner').textContent = 'Status atual: ' + (item.status || '—');
  document.getElementById('conserto-status-banner').style.display = '';
  Utils.abrirModal('modal-conserto');
}

function salvarSolicitacao(event) {
  event.preventDefault();
  const id = document.getElementById('conserto-id').value || null;
  const dados = {
    id: id || undefined,
    codigo_material_sap: document.getElementById('conserto-codigo-sap').value.trim(),
    descricao_material_sap: document.getElementById('conserto-descricao-sap').value.trim(),
    codigo_interno: document.getElementById('conserto-codigo-interno').value.trim(),
    descricao_interna: document.getElementById('conserto-descricao-interna').value.trim(),
    quantidade: document.getElementById('conserto-quantidade').value.trim(),
    valor_material: document.getElementById('conserto-valor').value.trim(),
    unidade_medida: document.getElementById('conserto-unidade').value.trim(),
    numero_serie: document.getElementById('conserto-numero-serie').value.trim(),
    tag_patrimonio: document.getElementById('conserto-tag').value.trim(),
    fabricante: document.getElementById('conserto-fabricante').value.trim(),
    modelo: document.getElementById('conserto-modelo').value.trim(),
    localizacao: document.getElementById('conserto-localizacao').value.trim(),
    setor: document.getElementById('conserto-setor').value.trim(),
    centro_custo: document.getElementById('conserto-centro-custo').value.trim(),
    criticidade: document.getElementById('conserto-criticidade').value.trim(),
    prioridade: document.getElementById('conserto-prioridade').value.trim(),
    potencia: document.getElementById('conserto-potencia').value.trim(),
    responsavel_manutencao: document.getElementById('conserto-responsavel-manutencao').value.trim(),
    motivo_envio: document.getElementById('conserto-motivo').value.trim(),
    diagnostico_inicial: document.getElementById('conserto-diagnostico').value.trim(),
    observacoes_manutencao: document.getElementById('conserto-observacoes').value.trim(),
    fornecedor_codigo_sap: document.getElementById('conserto-fornecedor-codigo').value.trim(),
    fornecedor_razao_social: document.getElementById('conserto-fornecedor-razao').value.trim(),
    fornecedor_nome_fantasia: document.getElementById('conserto-fornecedor-nome').value.trim(),
    fornecedor_cnpj: document.getElementById('conserto-fornecedor-cnpj').value.trim(),
    fornecedor_email: document.getElementById('conserto-fornecedor-email').value.trim(),
    tipo_servico: document.getElementById('conserto-fornecedor-servico').value.trim(),
    data_prevista_envio: document.getElementById('conserto-data-prevista-envio').value || null,
    data_prevista_retorno: document.getElementById('conserto-data-prevista-retorno').value || null,
    ativo_id: document.getElementById('conserto-ativo-id').value || null,
    confirmadoSAP: document.getElementById('conserto-confirm-sap').checked,
    status: id  undefined : (document.getElementById('conserto-confirm-sap').checked  'Dados SAP conferidos' : 'Solicitação aberta'),
    solicitanteId: Auth.getSessao().id,
    responsavelId: Auth.getSessao().id,
    data_abertura: id  undefined : new Date().toISOString(),
  };

  if (!dados.codigo_material_sap || !dados.descricao_material_sap || !dados.fornecedor_razao_social) {
    return Utils.toast('Preencha os dados SAP e fornecedor antes de salvar.', 'warning');
  }

  // Remove campos undefined para não sobrescrever valores existentes ao editar
  Object.keys(dados).forEach(function(k) { if (dados[k] === undefined) delete dados[k]; });

  const salvo = DB.Consertos.salvar(dados);
  if (salvo) {
    DB.ConsertosHistorico.criar({
      solicitacaoId: salvo.id,
      usuarioId: Auth.getSessao().id,
      acao: id  'Solicitação editada' : 'Solicitação criada',
      detalhes: 'Dados da solicitação salvos pelo usuário.'
    });
    // Notifica equipe PCM por e-mail apenas na criação
    if (!id) {
      enviarEmailConsertoNovo(salvo);
    }
    // Se editando com confirmadoSAP=true e status ainda inicial, avança para 'Dados SAP conferidos'
    if (id && dados.confirmadoSAP && _statusConserto(salvo.status) === STATUS_SOLICITACAO_ABERTA) {
      salvo.status = 'Dados SAP conferidos';
      DB.Consertos.salvar(salvo);
      DB.ConsertosHistorico.criar({
        solicitacaoId: id,
        usuarioId: Auth.getSessao().id,
        acao: 'Dados SAP conferidos',
        detalhes: 'Dados SAP verificados e confirmados pelo usuário.'
      });
    }
    Utils.toast('Solicitação salva com sucesso.', 'success');
  }
  renderTabela();
  Utils.fecharModal('modal-conserto');
}

function enviarParaContabilidade(id) {
  const item = DB.Consertos.buscarId(id);
  if (!item) return Utils.toast('Solicitação não encontrada.', 'error');
  // Valida campos mínimos
  if (!item.fornecedor_razao_social && !item.fornecedor_nome_fantasia) {
    return Utils.toast('Informe o fornecedor antes de enviar para a contabilidade.', 'warning');
  }
  if (!item.fornecedor_email) {
    return Utils.toast('Informe o e-mail do fornecedor / contabilidade antes de enviar.', 'warning');
  }
  // Validar que SAP foi conferido ANTES de enviar
  if (!item.confirmadoSAP) {
    return Utils.toast('⚠️ Os dados SAP ainda NÃO foram conferidos. Clique em "Confirmar Dados SAP" primeiro.', 'warning');
  }
  const cfg = DB.Config.get();
  const emailContab = (cfg.emailContabilidade || '').split(',').map(function(e){ return e.trim(); }).filter(Boolean);
  if (!emailContab.length && !item.fornecedor_email) {
    Utils.toast('Configure o e-mail da contabilidade em Configurações antes de enviar.', 'warning');
    return;
  }
  item.status = 'Enviado para contabilidade';
  item.data_envio_contabilidade = new Date().toISOString();
  DB.Consertos.salvar(item);
  DB.ConsertosHistorico.criar({
    solicitacaoId: item.id,
    usuarioId: Auth.getSessao().id,
    acao: 'Enviado para contabilidade',
    detalhes: 'Solicitação de emissão de NF de remessa enviada à contabilidade. Link seguro gerado automaticamente.'
  });
  DB.Notificacoes.criar({
    userId: item.solicitanteId || Auth.getSessao().id,
    titulo: 'Enviado para contabilidade',
    mensagem: 'Solicitação ' + (item.numeroSolicitacao || '') + ' enviada. A contabilidade receberá o link para anexar a NF de remessa.'
  });
  renderTabela();
  // Gera link seguro e envia por e-mail
  gerarLinkSeguro(id);
}

async function gerarLinkSeguro(id) {
  const item = DB.Consertos.buscarId(id);
  if (!item) return Utils.toast('Solicitação não encontrada.', 'error');
  const token = Utils.gerarToken();
  const tokenHash = await gerarSha256(token);
  const registro = {
    solicitacaoId: item.id,
    token_hash: tokenHash,
    expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    maxAcessos: 2,
    acessosRealizados: 0,
    status: 'ativo'
  };
  // Invalidar todos os tokens ativos anteriores desta solicitação
  DB.ConsertosTokens.listar().filter(function(t) {
    return t.solicitacaoId === item.id && t.status === 'ativo';
  }).forEach(function(t) {
    t.status = 'invalidado';
    t.invalidadoEm = new Date().toISOString();
    t.motivo_invalidacao = 'Novo link gerado pelo usuário';
    DB.ConsertosTokens.salvar(t);
  });
  DB.ConsertosTokens.salvar(registro);
  DB.ConsertosHistorico.criar({
    solicitacaoId: item.id,
    usuarioId: Auth.getSessao().id,
    acao: 'Novo link gerado',
    detalhes: 'Link seguro criado para contabilidade.',
    statusAnterior: item.status,
    statusNovo: 'Novo link gerado'
  });
  // Atualiza status da solicitação para "Novo link gerado" quando for uma regeneração,
  // mas protege statuses que representam progresso já consolidado
  const statusProtegidosLink = ['Enviado para contabilidade', 'NF anexada', 'Liberado para envio', 'Enviado para conserto', 'Em conserto', 'Material retornado', 'Finalizado', 'Cancelado'];
  if (!statusProtegidosLink.includes(item.status)) {
    item.status = 'Novo link gerado';
    DB.Consertos.salvar(item);
  }
  const cfg = DB.Config.get();
  const sysUrl = (cfg.sysUrl || (window.location.protocol + '//' + window.location.host + '/')).replace(/\/$/, '/');
  const link = sysUrl + 'consertos-link.htmltoken=' + encodeURIComponent(token);
  // Corrigido: usar .value em <textarea> para que o botão "Copiar" funcione corretamente
  document.getElementById('link-seguro-text').value = link;
  Utils.abrirModal('link-seguro-result');
  // Enviar o link por e-mail para o contato do fornecedor/contabilidade
  _enviarLinkConsertoEmail(item, link);
}

function cancelarSolicitacao(id) {
  const item = DB.Consertos.buscarId(id);
  if (!item) return Utils.toast('Solicitação não encontrada.', 'error');
  if (!confirm('Tem certeza que deseja cancelar a solicitação ' + item.numeroSolicitacao + '')) return;
  item.status = 'Cancelado';
  item.canceladoEm = new Date().toISOString();
  DB.Consertos.salvar(item);
  DB.ConsertosHistorico.criar({
    solicitacaoId: item.id,
    usuarioId: Auth.getSessao().id,
    acao: 'Solicitação cancelada',
    detalhes: 'Solicitação cancelada pelo usuário.'
  });
  Utils.toast('Solicitação cancelada.', 'warning');
  renderTabela();
}

async function gerarSha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
}

let solicitacaoAtualId = null;

function abrirDetalhes(id) {
  const s = DB.Consertos.buscarId(id);
  if (!s) return Utils.toast('Solicitação não encontrada.', 'error');
  const body = document.getElementById('detalhes-conserto-body');
  const ativo = s.ativo_id  DB.Ativos.buscarId(s.ativo_id) : null;

  // Helpers de layout
  function row(label, val) {
    const vHtml = (val === undefined || val === null || val === '' || val === '—')
       '<span style="color:var(--text-muted)">—</span>' : val;
    return '<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">'
      + '<div style="width:190px;min-width:190px;font-weight:600;color:var(--text-muted);font-size:12px;padding-right:8px">' + label + '</div>'
      + '<div style="flex:1;font-size:13px">' + vHtml + '</div></div>';
  }
  function sec(icon, title, inner) {
    return '<div style="margin-top:14px">'
      + '<div style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.6px;padding:5px 10px;background:var(--bg-secondary);border-radius:6px;margin-bottom:4px">' + icon + ' ' + title + '</div>'
      + inner + '</div>';
  }

  // ── Cálculos de tempo ────────────────────────────────────────────────
  const diasAtraso = (function() {
    if (!s.data_prevista_retorno) return 0;
    if (['Material retornado','Finalizado','Cancelado'].includes(_statusConserto(s.status))) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(s.data_prevista_retorno + 'T23:59:59').getTime()) / 86400000));
  })();
  const diasFora2 = s.data_real_envio  (function() {
    const fim2 = s.data_real_retorno  new Date(s.data_real_retorno + 'T12:00:00') : new Date();
    return Math.round((fim2 - new Date(s.data_real_envio + 'T12:00:00')) / 86400000);
  })() : null;
  const diasRestantes = (s.data_real_envio && s.data_prevista_retorno && !s.data_real_retorno)  (function() {
    return Math.round((new Date(s.data_prevista_retorno + 'T23:59:59') - new Date()) / 86400000);
  })() : null;

  // ── Timeline de fluxo ────────────────────────────────────────────────
  const _FLUXO = [
    { st:STATUS_SOLICITACAO_ABERTA, icon:'📋' },
    { st:'Enviado para contabilidade', icon:'📨' },
    { st:'Aguardando NF', icon:'⏳' },
    { st:'NF anexada', icon:'📄' },
    { st:'Enviado para conserto', icon:'📦' },
    { st:'Em conserto', icon:'🔧' },
    { st:'Material retornado', icon:'🔙' },
    { st:'Finalizado', icon:'✅' }
  ];
  const _stIdx = _FLUXO.findIndex(function(f){ return f.st === _statusConserto(s.status); });
  let timelineHtml = '<div style="overflow-x:auto;padding:6px 0;margin-bottom:12px;">'
    + '<div style="display:flex;align-items:flex-start;min-width:max-content;">';
  _FLUXO.forEach(function(f, i) {
    var _ativo = f.st === _statusConserto(s.status);
    var _passado = _stIdx >= 0 && i < _stIdx;
    var _cor = _ativo  'var(--primary)' : (_passado  'var(--success)' : 'var(--border)');
    var _lbl = f.st.replace('para contabilidade','p/ contab.').replace('de remessa','').replace('para conserto','').replace('retornado','retornado').trim();
    timelineHtml += '<div style="display:flex;align-items:center">'
      + '<div style="text-align:center;width:70px">'
        + '<div style="font-size:' + (_ativo  18 : 14) + 'px">' + f.icon + '</div>'
        + '<div style="font-size:9px;font-weight:' + (_ativo  '700' : '500') + ';color:' + (_ativo  'var(--primary)' : (_passado  'var(--success)' : 'var(--text-muted)')) + ';margin-top:2px;white-space:nowrap;max-width:70px;overflow:hidden">'
          + (_passado  'OK ' : '') + _lbl + '</div>'
      + '</div>'
      + (i < _FLUXO.length - 1  '<div style="width:20px;height:2px;background:' + _cor + ';flex-shrink:0;margin-bottom:12px"></div>' : '')
      + '</div>';
  });
  timelineHtml += '</div></div>';
  if (_statusConserto(s.status) === 'Cancelado') {
    timelineHtml = '<div style="background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;color:var(--danger);margin-bottom:12px">Solicita-o CANCELADA</div>';
  } else if (_statusConserto(s.status) === 'Prazo de retorno vencido') {
    timelineHtml = '<div style="background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;color:var(--danger);margin-bottom:8px">Prazo de retorno VENCIDO - ' + diasAtraso + ' dia(s) em atraso</div>' + timelineHtml;
  }

  // ── Contador de dias em campo ─────────────────────────────────────────
  var contadorHtml = '';
  if (diasFora2 !== null && !['Finalizado','Cancelado',STATUS_SOLICITACAO_ABERTA,'Dados SAP conferidos','Enviado para contabilidade','Aguardando NF','NF anexada'].includes(_statusConserto(s.status))) {
    var dtEnvio = new Date(s.data_real_envio + 'T12:00:00').toLocaleDateString('pt-BR');
    var dtPrev2  = s.data_prevista_retorno  new Date(s.data_prevista_retorno + 'T12:00:00').toLocaleDateString('pt-BR') : null;
    var _corFundo = diasRestantes !== null  (diasRestantes < 0  'rgba(220,38,38,.1)' : (diasRestantes <= 2  'rgba(245,158,11,.1)' : 'rgba(16,185,129,.07)')) : 'rgba(99,102,241,.07)';
    var _corBorda = diasRestantes !== null  (diasRestantes < 0  'rgba(220,38,38,.3)' : (diasRestantes <= 2  'rgba(245,158,11,.3)' : 'rgba(16,185,129,.25)')) : 'rgba(99,102,241,.2)';
    contadorHtml = '<div style="background:' + _corFundo + ';border:1px solid ' + _corBorda + ';border-radius:8px;padding:10px 14px;margin-bottom:10px;display:flex;gap:20px;flex-wrap:wrap;align-items:center">'
      + '<div style="text-align:center"><div style="font-size:28px;font-weight:800;line-height:1">' + diasFora2 + '</div><div style="font-size:10px;color:var(--text-muted)">dia(s) fora</div></div>'
      + '<div style="border-left:1px solid var(--border);padding-left:16px;font-size:12.5px;line-height:2">'
        + 'Enviado em: <strong>' + dtEnvio + '</strong><br>'
        + (dtPrev2  'Previso de retorno: <strong>' + dtPrev2 + '</strong><br>' : '')
        + (diasRestantes !== null  (diasRestantes < 0  '<strong style="color:var(--danger)">' + Math.abs(diasRestantes) + ' dia(s) em atraso</strong>' : '<strong>' + diasRestantes + ' dia(s) restantes</strong>') : '')
      + '</div>'
    + '</div>';
  }

  // ── Garantia ativa ─────────────────────────────────────────────────────
  var garantiaHtml = '';
  if (s.data_fim_garantia && ['Material retornado','Finalizado'].includes(_statusConserto(s.status))) {
    var diasGar = Math.ceil((new Date(s.data_fim_garantia + 'T23:59:59') - new Date()) / 86400000);
    garantiaHtml = '<div style="background:' + (diasGar >= 0  'rgba(16,185,129,.07)' : 'rgba(156,163,175,.1)') + ';border:1px solid ' + (diasGar >= 0  'rgba(16,185,129,.25)' : 'rgba(156,163,175,.3)') + ';border-radius:8px;padding:8px 14px;margin-bottom:10px;font-size:12.5px">'
      + '&#128737;&#65039; <strong>Garantia do serviço:</strong> ' + (s.garantia_dias || '') + ' dias — '
      + (diasGar >= 0  '<span style="color:var(--success)">Vlida at ' + new Date(s.data_fim_garantia + 'T12:00:00').toLocaleDateString('pt-BR') + ' (' + diasGar + ' dia(s))</span>' : '<span style="color:var(--text-muted)">Expirada em ' + new Date(s.data_fim_garantia + 'T12:00:00').toLocaleDateString('pt-BR') + '</span>')
    + '</div>';
  }
  if (s.avaliacao_fornecedor) {
    var nota = parseInt(s.avaliacao_fornecedor) || 0;
    garantiaHtml += '<div style="font-size:12.5px;margin-bottom:8px">&#11088; Avaliação do fornecedor: ' + '★'.repeat(nota) + '☆'.repeat(Math.max(0,5-nota)) + ' (' + nota + '/5)</div>';
  }

  // ── Cabeçalho ─────────────────────────────────────────────────────────
  let html = '<div style="margin-bottom:4px">'
    + timelineHtml + contadorHtml + garantiaHtml
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-bottom:10px;border-bottom:2px solid var(--border)">'
    + '<span style="font-size:16px;font-weight:800">' + Utils.safe(s.numeroSolicitacao || '—') + '</span>'
    + statusBadge(s.status)
    + '</div></div>';

  // 📦 Material
  html += sec('📦', 'Material',
    row('Código SAP', Utils.safe(s.codigo_material_sap)) +
    row('Descrição SAP', Utils.safe(s.descricao_material_sap)) +
    row('Código Interno', Utils.safe(s.codigo_interno)) +
    row('Quantidade / UN', Utils.safe(s.quantidade) + (s.unidade_medida  ' ' + Utils.safe(s.unidade_medida) : '')) +
    row('Valor estimado', s.valor_material  Utils.fmtMoeda(s.valor_material) : null) +
    row('Nº de Série', Utils.safe(s.numero_serie)) +
    row('Fabricante', Utils.safe(s.fabricante)) +
    row('Modelo', Utils.safe(s.modelo))
  );

  // 📍 Localização
  html += sec('📍', 'Localização & Ativo',
    row('TAG / Patrimônio', Utils.safe(s.tag_patrimonio)) +
    row('Ativo vinculado', ativo  Utils.safe(ativo.tag + ' - ' + ativo.descricao) : null) +
    row('Localização', Utils.safe(s.localizacao)) +
    row('Setor', Utils.safe(s.setor)) +
    row('Centro de custo', Utils.safe(s.centro_custo)) +
    row('Criticidade', Utils.safe(s.criticidade)) +
    row('Prioridade', Utils.safe(s.prioridade)) +
    row('Responsável manutenção', Utils.safe(s.responsavel_manutencao))
  );

  // 🔧 Diagnóstico
  html += sec('🔧', 'Diagnóstico & Motivo',
    row('Motivo do envio', Utils.safe(s.motivo_envio)) +
    row('Diagnóstico inicial', Utils.safe(s.diagnostico_inicial)) +
    row('Potência / Ref. técnica', Utils.safe(s.potencia)) +
    row('Observações técnicas', Utils.safe(s.observacoes_manutencao))
  );

  // 🏭 Fornecedor
  html += sec('🏭', 'Fornecedor',
    row('Código SAP', Utils.safe(s.fornecedor_codigo_sap)) +
    row('Razão social', Utils.safe(s.fornecedor_razao_social)) +
    row('Nome fantasia', Utils.safe(s.fornecedor_nome_fantasia)) +
    row('CNPJ', Utils.safe(s.fornecedor_cnpj)) +
    row('E-mail', s.fornecedor_email  '<a href="mailto:' + Utils.safe(s.fornecedor_email) + '">' + Utils.safe(s.fornecedor_email) + '</a>' : null) +
    row('Tipo de serviço', Utils.safe(s.tipo_servico))
  );

  // 📅 Envio
  html += sec('📅', 'Datas & Envio',
    row('Abertura', s.data_abertura  new Date(s.data_abertura).toLocaleString('pt-BR') : null) +
    row('Previsto envio', s.data_prevista_envio  new Date(s.data_prevista_envio + 'T12:00:00').toLocaleDateString('pt-BR') : null) +
    row('Previsto retorno', s.data_prevista_retorno  new Date(s.data_prevista_retorno + 'T12:00:00').toLocaleDateString('pt-BR') + (diasAtraso > 0  ' <span style="color:var(--danger);font-size:11px">(' + diasAtraso + 'd atraso)</span>' : '')
      : null) +
    row('Data real de envio', s.data_real_envio  new Date(s.data_real_envio + 'T12:00:00').toLocaleDateString('pt-BR') : null) +
    row('Responsável pelo envio', Utils.safe(s.responsavel_envio)) +
    row('Transportadora', Utils.safe(s.transportadora)) +
    row('Dados SAP conferidos', s.confirmadoSAP  '<span style="color:var(--success);font-weight:600">Sim</span>' : '<span style="color:var(--danger)">No</span>') +
    row('Obs. de envio', Utils.safe(s.observacoes_envio))
  );

  // 🔄 Retorno (mostra sempre, mas campos vazios ficam com —)
  const diasFora = (function() {
    if (!s.data_real_envio) return null;
    const fim = s.data_real_retorno  new Date(s.data_real_retorno + 'T12:00:00') : new Date();
    return Math.round((fim - new Date(s.data_real_envio + 'T12:00:00')) / 86400000);
  })();
  const custoTotal = (function() {
    const base = parseFloat(s.valor_material) || 0;
    const final = parseFloat(s.valor_final_conserto) || 0;
    return (base || final)  Utils.fmtMoeda(final || base) : null;
  })();
  html += sec('🔄', 'Retorno & Resultado',
    row('Data real de retorno', s.data_real_retorno  new Date(s.data_real_retorno + 'T12:00:00').toLocaleDateString('pt-BR') : null) +
    row('Dias fora da empresa', diasFora !== null  (diasFora + ' dia(s)' + (!s.data_real_retorno  ' (em andamento)' : '')) : null) +
    row('Condição do item', Utils.safe(s.condicao_item)) +
    row('Serviço executado', Utils.safe(s.servico_executado)) +
    row('Laudo técnico', Utils.safe(s.laudo_tecnico)) +
    row('Responsável recebimento', Utils.safe(s.responsavel_recebimento)) +
    row('Valor final', s.valor_final_conserto  Utils.fmtMoeda(s.valor_final_conserto) : null) +
    row('Custo total', custoTotal) +
    row('NF de retorno', Utils.safe(s.nf_retorno)) +
    row('Item aprovado', s.item_aprovado !== undefined  (s.item_aprovado  '<span style="color:var(--success);font-weight:600">Sim</span>' : '<span style="color:var(--danger)">No</span>') : null) +
    row('Precisa reenviar', s.precisa_reenviar !== undefined  (s.precisa_reenviar  '<span style="color:var(--warning);font-weight:600">Sim</span>' : 'No') : null) +
    row('Obs. da contabilidade', Utils.safe(s.observacoes_contabilidade)) +
    row('Obs. de retorno', Utils.safe(s.observacoes_retorno))
  );

  body.innerHTML = html;

  // Seção de Anexos (DOM direto para evitar XSS em onclick)
  const secAnexos = document.createElement('div');
  secAnexos.style.marginTop = '14px';
  secAnexos.innerHTML = '<div style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.6px;padding:5px 10px;background:var(--bg-secondary);border-radius:6px;margin-bottom:4px">📎 Anexos</div>';
  const anexos = DB.ConsertosAnexos.porSolicitacao(s.id) || [];
  if (!anexos.length) {
    const p = document.createElement('p');
    p.style.cssText = 'color:var(--text-muted);font-size:13px;padding:4px 0';
    p.textContent = 'Nenhum anexo';
    secAnexos.appendChild(p);
  } else {
    const ul = document.createElement('ul');
    ul.style.cssText = 'margin:0;padding-left:20px';
    anexos.forEach(function(a) {
      const armazenado = a.nomeArmazenado || a.nome_armazenado || a.nome;
      const nomeOriginal = a.nomeOriginal || a.nome || armazenado || 'arquivo';
      const li = document.createElement('li');
      li.style.cssText = 'padding:4px 0;font-size:13px';
      li.textContent = (a.tipoAnexo || a.tipo || '') + ' — ' + nomeOriginal + ' ';
      const aVer = document.createElement('a');
      aVer.href = '#';
      aVer.textContent = '[visualizar]';
      // Obter URL segura: usa caminho armazenado (com key) ou consulta a rota consertos-file-key
      aVer.addEventListener('click', function(e) {
        e.preventDefault();
        _resolverUrlAnexo(a).then(function(url) { previewAnexo(url, encodeURIComponent(nomeOriginal)); });
      });
      const aBaixar = document.createElement('a');
      aBaixar.href = '#';
      aBaixar.textContent = ' [baixar]';
      aBaixar.addEventListener('click', function(e) {
        e.preventDefault();
        _resolverUrlAnexo(a).then(function(url) {
          const tmp = document.createElement('a');
          tmp.href = url;
          tmp.download = nomeOriginal;
          tmp.click();
        });
      });
      li.appendChild(aVer);
      li.appendChild(aBaixar);
      ul.appendChild(li);
    });
    secAnexos.appendChild(ul);
  }
  body.appendChild(secAnexos);

  // Seção de Histórico
  const secHist = document.createElement('div');
  secHist.style.marginTop = '14px';
  secHist.innerHTML = '<div style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.6px;padding:5px 10px;background:var(--bg-secondary);border-radius:6px;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between">'
    + '<span>📋 Histórico</span>'
    + '<div style="display:flex;gap:6px;align-items:center">'
      + '<input id="hist-filtro-busca" placeholder="Filtrar..." style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text)">'
      + '<select id="hist-filtro-acao" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text)"><option value="">Todas ações</option></select>'
    + '</div>'
    + '</div>'
    + '<div id="hist-lista"></div>';
  body.appendChild(secHist);

  function renderHist() {
    const listaEl = document.getElementById('hist-lista');
    const filtroTxt = (document.getElementById('hist-filtro-busca') || {}).value || '';
    const filtroAcao = (document.getElementById('hist-filtro-acao') || {}).value || '';
    const histAll = DB.ConsertosHistorico.porSolicitacao(s.id) || [];
    const sel = document.getElementById('hist-filtro-acao');
    if (sel) {
      const prev = sel.value;
      const acoes = Array.from(new Set(histAll.map(function(h){ return h.acao; }).filter(Boolean)));
      sel.innerHTML = '<option value="">Todas ações</option>' + acoes.map(function(a){ return '<option value="' + Utils.safe(a) + '">' + Utils.safe(a) + '</option>'; }).join('');
      if (prev) sel.value = prev;
    }
    const filtered = histAll.filter(function(h) {
      if (filtroAcao && h.acao !== filtroAcao) return false;
      if (filtroTxt) {
        const txt = [h.acao, h.detalhes, h.usuarioNome].join(' ').toLowerCase();
        if (!txt.includes(filtroTxt.toLowerCase())) return false;
      }
      return true;
    });
    if (!filtered.length) { listaEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Sem registros</div>'; return; }
    listaEl.innerHTML = '<ul style="margin:0;padding-left:20px">' + filtered.map(function(h) {
      return '<li style="padding:4px 0;font-size:13px">'
        + '<span style="color:var(--text-muted)">' + Utils.formatarDataHora(h.dataHora) + '</span> — '
        + '<strong>' + Utils.safe(h.acao) + '</strong>'
        + (h.detalhes  ' - ' + Utils.safe(h.detalhes) : '')
        + (h.usuarioNome  '<br><span style="color:var(--text-muted);font-size:11px">' + Utils.safe(h.usuarioNome) + '</span>' : '')
        + '</li>';
    }).join('') + '</ul>';
  }

  setTimeout(function() {
    const inpt = document.getElementById('hist-filtro-busca');
    const sel  = document.getElementById('hist-filtro-acao');
    if (inpt) inpt.addEventListener('input', renderHist);
    if (sel)  sel.addEventListener('change', renderHist);
    renderHist();
  }, 8);

  // ── Botões de ação — visibilidade condicional por status ─────────────
  const st = _statusConserto(s.status);
  const btnConferirSAP     = document.getElementById('btn-conferir-sap');
  const btnEnviarContab    = document.getElementById('btn-enviar-contabilidade');
  const btnLink            = document.getElementById('btn-gerar-link-detalhe');
  const btnLiberarEnvio    = document.getElementById('btn-liberar-envio');
  const btnEnvio           = document.getElementById('btn-registrar-envio');
  const btnEmConserto      = document.getElementById('btn-marcar-em-conserto');
  const btnRetorno         = document.getElementById('btn-registrar-retorno');
  const btnFinalizar       = document.getElementById('btn-finalizar-conserto');
  const btnCancelar        = document.getElementById('btn-cancelar-conserto');
  const btnEditar          = document.getElementById('btn-editar-detalhe');

  const ATIVOS_CANCELAVEIS = [STATUS_SOLICITACAO_ABERTA,'Dados SAP conferidos','Enviado para contabilidade','Aguardando NF','NF anexada','Liberado para envio'];

  if (btnConferirSAP)  btnConferirSAP.style.display  = st === STATUS_SOLICITACAO_ABERTA  '' : 'none';
  if (btnEnviarContab) btnEnviarContab.style.display  = [STATUS_SOLICITACAO_ABERTA,'Dados SAP conferidos'].includes(st)  '' : 'none';
  if (btnLink)         btnLink.style.display          = ['Enviado para contabilidade','Aguardando NF','NF anexada','Liberado para envio','Link expirado','Novo link gerado'].includes(st)  '' : 'none';
  if (btnLiberarEnvio) btnLiberarEnvio.style.display  = st === 'NF anexada'  '' : 'none';
  if (btnEnvio)        btnEnvio.style.display         = ['NF anexada','Liberado para envio'].includes(st)  '' : 'none';
  if (btnEmConserto)   btnEmConserto.style.display    = st === 'Enviado para conserto'  '' : 'none';
  if (btnRetorno)      btnRetorno.style.display       = ['Enviado para conserto','Em conserto','Prazo de retorno vencido'].includes(st)  '' : 'none';
  if (btnFinalizar)    btnFinalizar.style.display     = st === 'Material retornado'  '' : 'none';
  if (btnCancelar)     btnCancelar.style.display      = ATIVOS_CANCELAVEIS.includes(st)  '' : 'none';
  if (btnEditar)       btnEditar.style.display        = [STATUS_SOLICITACAO_ABERTA,'Dados SAP conferidos'].includes(st)  '' : 'none';

  if (btnConferirSAP)  btnConferirSAP.onclick  = function() { Utils.fecharModal('modal-conserto-detalhes'); conferirSAP(s.id); };
  if (btnEnviarContab) btnEnviarContab.onclick  = function() { Utils.fecharModal('modal-conserto-detalhes'); enviarParaContabilidade(s.id); };
  if (btnLink)         btnLink.onclick          = function() { gerarLinkSeguro(s.id); };
  if (btnLiberarEnvio) btnLiberarEnvio.onclick  = function() { liberarParaEnvio(s.id); };
  if (btnEnvio)        btnEnvio.onclick         = function() { registrarEnvio(s.id); };
  if (btnEmConserto)   btnEmConserto.onclick    = function() { marcarEmConserto(s.id); };
  if (btnRetorno)      btnRetorno.onclick       = function() { registrarRetorno(s.id); };
  if (btnFinalizar)    btnFinalizar.onclick     = function() { finalizarSolicitacao(s.id); };
  if (btnCancelar)     btnCancelar.onclick      = function() { Utils.fecharModal('modal-conserto-detalhes'); cancelarSolicitacao(s.id); };
  if (btnEditar)       btnEditar.onclick        = function() { Utils.fecharModal('modal-conserto-detalhes'); editarSolicitacao(s.id); };

  Utils.abrirModal('modal-conserto-detalhes');
}

// Resolve URL segura para download de anexo de conserto.
// Usa caminho armazenado no registro (gerado com key= pelo servidor) se disponível.
// Caso contrário, consulta /api/consertos-file-key/:filename para obter a chave HMAC.
function _resolverUrlAnexo(anexo) {
  if (anexo.caminho && String(anexo.caminho).includes('key=')) {
    return Promise.resolve(anexo.caminho);
  }
  const armazenado = anexo.nomeArmazenado || anexo.nome_armazenado || anexo.nome || '';
  if (!armazenado) return Promise.resolve('#');
  return fetch('/api/consertos-file-key/' + encodeURIComponent(armazenado))
    .then(function(r) { return r.ok  r.json() : null; })
    .then(function(d) {
      return d && d.caminho  d.caminho : ('/api/consertos-anexos/' + encodeURIComponent(armazenado));
    })
    .catch(function() { return '/api/consertos-anexos/' + encodeURIComponent(armazenado); });
}

function previewAnexo(url, nomeEnc) {
  const nome = decodeURIComponent(nomeEnc || 'arquivo');
  const body = document.getElementById('preview-body');
  const download = document.getElementById('preview-download');
  download.href = url;
  download.setAttribute('download', nome);
  body.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">Carregando...</div>';
  const ext = (nome.split('.').pop() || '').toLowerCase();
  if (['png','jpg','jpeg','gif','webp','bmp'].includes(ext)) {
    body.innerHTML = '<img src="' + url + '" style="max-width:100%;height:auto;border-radius:6px" />';
    Utils.abrirModal('modal-conserto-preview');
    return;
  }
  if (ext === 'pdf') {
    body.innerHTML = '<iframe src="' + url + '" style="width:100%;height:70vh;border:0"></iframe>';
    Utils.abrirModal('modal-conserto-preview');
    return;
  }
  // fallback: try iframe, otherwise provide link
  body.innerHTML = '<div style="padding:12px">Não é possível visualizar este tipo de arquivo inline.<div style="margin-top:8px"><a href="' + url + '" download="' + nome + '">Clique para baixar</a></div></div>';
  Utils.abrirModal('modal-conserto-preview');
}

function registrarEnvio(id) {
  const s = DB.Consertos.buscarId(id);
  if (!s) return Utils.toast('Solicitação não encontrada.', 'error');
  document.getElementById('envio-solicitacao-id').value = id;
  document.getElementById('envio-data').value = new Date().toISOString().slice(0, 10);
  document.getElementById('envio-data-retorno').value = s.data_prevista_retorno || '';
  document.getElementById('envio-responsavel').value = Auth.getSessao().nome || '';
  document.getElementById('envio-transportadora').value = s.transportadora || '';
  document.getElementById('envio-observacoes').value = '';
  // Preenche info do item
  var infoEl = document.getElementById('envio-info-item');
  if (infoEl) infoEl.innerHTML = '&#128230; <strong>' + Utils.safe(s.codigo_material_sap || '—') + '</strong> — ' + Utils.safe(s.descricao_material_sap || '—')
    + '<br>&#127981; Fornecedor: <strong>' + Utils.safe(s.fornecedor_razao_social || '—') + '</strong>';
  _atualizarContadorEnvio();
  document.getElementById('form-registrar-envio').onsubmit = function(e) {
    e.preventDefault();
    const data = document.getElementById('envio-data').value;
    const dataRetorno = document.getElementById('envio-data-retorno').value;
    if (!data) return Utils.toast('Informe a data de envio.', 'warning');
    if (!dataRetorno) return Utils.toast('Informe a data prevista de retorno.', 'warning');
    if (dataRetorno <= data) return Utils.toast('A data prevista de retorno deve ser posterior à data de envio.', 'warning');
    s.data_real_envio = data;
    s.data_prevista_retorno = dataRetorno;
    s.responsavel_envio = document.getElementById('envio-responsavel').value.trim() || Auth.getSessao().nome;
    s.transportadora = document.getElementById('envio-transportadora').value.trim();
    s.observacoes_envio = document.getElementById('envio-observacoes').value.trim();
    s.status = 'Enviado para conserto';
    s.prazoVencido = false;
    DB.Consertos.salvar(s);
    DB.ConsertosHistorico.criar({
      solicitacaoId: s.id,
      usuarioId: Auth.getSessao().id,
      acao: 'Enviado para conserto',
      detalhes: 'Data envio: ' + s.data_real_envio + ' | Previsão retorno: ' + s.data_prevista_retorno + (s.transportadora  ' | Transportadora: ' + s.transportadora : '')
    });
    Utils.toast('Envio registrado! O item está em conserto.', 'success');
    renderTabela();
    Utils.fecharModal('modal-registrar-envio');
    Utils.fecharModal('modal-conserto-detalhes');
  };
  Utils.abrirModal('modal-registrar-envio');
}

function registrarRetorno(id) {
  const s = DB.Consertos.buscarId(id);
  if (!s) return Utils.toast('Solicitação não encontrada.', 'error');
  document.getElementById('retorno-solicitacao-id').value = id;
  document.getElementById('retorno-data').value = new Date().toISOString().slice(0, 10);
  document.getElementById('retorno-condicao').value = s.condicao_item || '';
  document.getElementById('retorno-servico').value = s.servico_executado || '';
  document.getElementById('retorno-valor-final').value = s.valor_final_conserto || '';
  document.getElementById('retorno-nf').value = s.nf_retorno || '';
  document.getElementById('retorno-aprovado').checked = s.item_aprovado !== false;
  document.getElementById('retorno-reenviar').checked = s.precisa_reenviar === true;
  document.getElementById('retorno-laudo').value = s.laudo_tecnico || '';
  document.getElementById('retorno-responsavel-recebimento').value = s.responsavel_recebimento || Auth.getSessao().nome || '';
  document.getElementById('retorno-observacoes').value = '';
  document.getElementById('retorno-garantia-dias').value = s.garantia_dias || '';
  document.getElementById('retorno-garantia-fim').value = s.data_fim_garantia  new Date(s.data_fim_garantia + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  document.getElementById('retorno-avaliacao').value = s.avaliacao_fornecedor || 0;
  _setAvaliacao(parseInt(s.avaliacao_fornecedor) || 0);
  // Info do item
  var infoEl = document.getElementById('retorno-info-item');
  if (infoEl) {
    var diasForaInfo = s.data_real_envio  Math.round((new Date() - new Date(s.data_real_envio + 'T12:00:00')) / 86400000) : null;
    infoEl.innerHTML = '&#128230; <strong>' + Utils.safe(s.codigo_material_sap || '—') + '</strong> — ' + Utils.safe(s.descricao_material_sap || '—')
      + '<br>&#127981; Fornecedor: <strong>' + Utils.safe(s.fornecedor_razao_social || '—') + '</strong>'
      + (diasForaInfo !== null  '<br>Ficou fora por: <strong>' + diasForaInfo + ' dia(s)</strong>' : '');
  }
  _calcGarantia();
  document.getElementById('form-registrar-retorno').onsubmit = function(e) {
    e.preventDefault();
    const data = document.getElementById('retorno-data').value;
    if (!data) return Utils.toast('Informe a data de retorno.', 'warning');
    const valorFinal = parseFloat(document.getElementById('retorno-valor-final').value);
    if (!valorFinal || valorFinal <= 0) return Utils.toast('Informe o valor final do conserto.', 'warning');
    s.data_real_retorno = data;
    s.condicao_item = document.getElementById('retorno-condicao').value.trim();
    s.servico_executado = document.getElementById('retorno-servico').value.trim();
    s.valor_final_conserto = valorFinal;
    s.nf_retorno = document.getElementById('retorno-nf').value.trim();
    s.laudo_tecnico = document.getElementById('retorno-laudo').value.trim();
    s.responsavel_recebimento = document.getElementById('retorno-responsavel-recebimento').value.trim();
    s.item_aprovado = document.getElementById('retorno-aprovado').checked;
    s.precisa_reenviar = document.getElementById('retorno-reenviar').checked;
    s.observacoes_retorno = document.getElementById('retorno-observacoes').value.trim();
    s.avaliacao_fornecedor = parseInt(document.getElementById('retorno-avaliacao').value) || 0;
    // Validar avaliação dentro do range 0-5
    if (s.avaliacao_fornecedor < 0 || s.avaliacao_fornecedor > 5) {
      s.avaliacao_fornecedor = Math.max(0, Math.min(5, s.avaliacao_fornecedor));
    }
    // Garantia
    const garantiaDias = parseInt(document.getElementById('retorno-garantia-dias').value) || 0;
    // Limitar garantia a máximo 10 anos (3650 dias)
    if (garantiaDias > 3650) {
      Utils.toast('Garantia não pode exceder 10 anos (3650 dias). Limitando a 10 anos.', 'warning');
      document.getElementById('retorno-garantia-dias').value = 3650;
      s.garantia_dias = 3650;
    } else {
      s.garantia_dias = garantiaDias;
    }
    if (s.garantia_dias > 0 && data) {
      const dtFimGar = new Date(data + 'T12:00:00');
      dtFimGar.setDate(dtFimGar.getDate() + s.garantia_dias);
      s.data_fim_garantia = dtFimGar.toISOString().slice(0, 10);
    } else {
      s.data_fim_garantia = null;
    }
    s.status = s.precisa_reenviar  'Solicitação aberta' : 'Material retornado';
    s.prazoVencido = false;
    if (s.precisa_reenviar) {
      s.numeroSolicitacao = s.numeroSolicitacao; // mantém o número
      s.data_abertura = new Date().toISOString();
      s.confirmadoSAP = false;
    }
    DB.Consertos.salvar(s);
    DB.ConsertosHistorico.criar({
      solicitacaoId: s.id,
      usuarioId: Auth.getSessao().id,
      acao: s.precisa_reenviar  'Retorno — reenvio necessário' : 'Retorno registrado',
      detalhes: 'Retornado em: ' + s.data_real_retorno
        + ' | Condição: ' + (s.condicao_item || '—')
        + ' | Valor: R$ ' + valorFinal.toFixed(2)
        + (s.garantia_dias  ' | Garantia: ' + s.garantia_dias + ' dias' : '')
        + (s.avaliacao_fornecedor  ' | Avalia-o: ' + s.avaliacao_fornecedor + '/5' : '')
    });
    enviarEmailConsertoRetorno(s);
    Utils.toast(s.precisa_reenviar  'Retorno registrado — item será reenviado.' : 'Retorno registrado com sucesso!', 'success');
    renderTabela();
    Utils.fecharModal('modal-registrar-retorno');
    Utils.fecharModal('modal-conserto-detalhes');
  };
  Utils.abrirModal('modal-registrar-retorno');
}

function finalizarSolicitacao(id) {
  const s = DB.Consertos.buscarId(id);
  if (!s) return Utils.toast('Solicitação não encontrada.', 'error');
  if (!confirm('Finalizar processo ' + (s.numeroSolicitacao || '') + '')) return;
  s.status = 'Finalizado';
  s.finalizado_em = new Date().toISOString();
  DB.Consertos.salvar(s);
  DB.ConsertosHistorico.criar({ solicitacaoId: s.id, usuarioId: Auth.getSessao().id, acao: 'Finalizado', detalhes: 'Processo finalizado pelo usuário.' });
  Utils.toast('Processo finalizado.', 'success');
  renderTabela();
  Utils.fecharModal('modal-conserto-detalhes');
}

// ─── MARCAR EM CONSERTO ─────────────────────────────────
function marcarEmConserto(id) {
  const s = DB.Consertos.buscarId(id);
  if (!s) return Utils.toast('Solicitação não encontrada.', 'error');
  if (!confirm('Confirmar que o material já se encontra em conserto no fornecedor')) return;
  const statusAnterior = s.status;
  s.status = 'Em conserto';
  s.em_conserto_em = new Date().toISOString();
  DB.Consertos.salvar(s);
  DB.ConsertosHistorico.criar({
    solicitacaoId: s.id,
    usuarioId: Auth.getSessao().id,
    acao: 'Em conserto',
    detalhes: 'Material confirmado no fornecedor para conserto.',
    statusAnterior: statusAnterior,
    statusNovo: 'Em conserto'
  });
  Utils.toast('Status atualizado para Em conserto.', 'success');
  renderTabela();
  Utils.fecharModal('modal-conserto-detalhes');
}

// ─── LIBERAR PARA ENVIO ─────────────────────────────────
function liberarParaEnvio(id) {
  const s = DB.Consertos.buscarId(id);
  if (!s) return Utils.toast('Solicitação não encontrada.', 'error');
  if (!confirm('Liberar solicitação ' + (s.numeroSolicitacao || '') + ' para envio físico ao fornecedor')) return;
  s.status = 'Liberado para envio';
  s.liberado_envio_em = new Date().toISOString();
  DB.Consertos.salvar(s);
  DB.ConsertosHistorico.criar({
    solicitacaoId: s.id,
    usuarioId: Auth.getSessao().id,
    acao: 'Liberado para envio',
    detalhes: 'NF conferida. Solicitação liberada para envio físico ao fornecedor.'
  });
  DB.Notificacoes.criar({
    userId: s.solicitanteId || Auth.getSessao().id,
    titulo: 'Liberado para envio',
    mensagem: 'Solicitação ' + (s.numeroSolicitacao || '') + ' foi liberada para envio físico.'
  });
  Utils.toast('Solicitação liberada para envio!', 'success');
  renderTabela();
  Utils.fecharModal('modal-conserto-detalhes');
}

// ─── INDICADORES ────────────────────────────────────────
function renderIndicadores() {
  const el = document.getElementById('indicadores-rapidos');
  if (!el) return;
  const todos = DB.Consertos.listar();
  const c = { total: 0, abertas: 0, nf: 0, operacao: 0, retorno: 0, vencido: 0, finalizado: 0 };
  let somaTempoFora = 0, countFinalizado = 0, somaCusto = 0;
  todos.forEach(function(s) {
    const st = _statusConserto(s.status);
    c.total++;
    if ([STATUS_SOLICITACAO_ABERTA, 'Dados SAP conferidos'].includes(st)) c.abertas++;
    else if (['Enviado para contabilidade','Aguardando NF','NF anexada','Link acessado','Link expirado','Novo link gerado'].includes(st)) c.nf++;
    else if (['Liberado para envio','Enviado para conserto','Em conserto','Prazo de retorno vencido'].includes(st)) c.operacao++;
    else if (st === 'Material retornado') c.retorno++;
    if (_isConsertoVencido(s)) c.vencido++;
    if (st === 'Finalizado') {
      c.finalizado++;
      if (s.data_real_envio && s.data_real_retorno) {
        const dias = Math.round((new Date(s.data_real_retorno + 'T12:00:00') - new Date(s.data_real_envio + 'T12:00:00')) / 86400000);
        if (dias >= 0) { somaTempoFora += dias; countFinalizado++; }
      }
      const custo = parseFloat(s.valor_final_conserto) || parseFloat(s.valor_material) || 0;
      somaCusto += custo;
    }
  });
  const tempoMedio = countFinalizado > 0  Math.round(somaTempoFora / countFinalizado) : null;
  function card(tipo, label, val, sub) {
    const active = (_filtroRapidoConsertos || 'todos') === tipo  ' active' : '';
    return '<button type="button" class="conserto-kpi' + active + '" onclick="_setFiltroRapidoConsertos(\'' + tipo + '\')" title="Filtrar: ' + Utils.safe(label) + '">'
      + '<div class="conserto-kpi-label">' + Utils.safe(label) + '</div>'
      + '<div class="conserto-kpi-value">' + Utils.safe(String(val)) + '</div>'
      + '<div class="conserto-kpi-sub">' + Utils.safe(sub || '') + '</div>'
      + '</button>';
  }
  el.innerHTML =
    card('todos', 'Total', c.total, 'toda a fila') +
    card('abertos', 'Triagem', c.abertas, 'abertura e SAP') +
    card('nf', 'NF / contab.', c.nf, 'link e anexos') +
    card('operacao', 'Operacao', c.operacao, 'envio e servico') +
    card('retorno', 'Retorno', c.retorno, 'aguarda finalizar') +
    card('vencidos', 'Vencidos', c.vencido, 'prioridade alta') +
    card('finalizados', 'Finalizados', c.finalizado, tempoMedio !== null  'media ' + tempoMedio + 'd' : 'encerrados') +
    (somaCusto > 0  card('finalizados', 'Custo fechado', Utils.fmtMoeda(somaCusto), 'finalizados') : '');

  const oldRanking = document.getElementById('indicadores-ranking-consertos');
  if (oldRanking) oldRanking.remove();

  const alerta = document.getElementById('consertos-operacao-alertas');
  if (alerta) {
    const vencidos = todos.filter(_isConsertoVencido);
    if (vencidos.length) {
      const exemplo = vencidos.slice(0, 3).map(function(s) {
        return s.numeroSolicitacao || s.codigo_material_sap || s.id;
      }).join(', ');
      alerta.classList.add('active');
      alerta.innerHTML = '<div><div class="consertos-alert-title">' + vencidos.length + ' processo(s) com prazo vencido</div>'
        + '<div class="consertos-alert-text">Priorize retorno ou renegociacao. Primeiros casos: ' + Utils.safe(exemplo) + '</div></div>'
        + '<button class="btn btn-danger btn-sm" onclick="_setFiltroRapidoConsertos(\'vencidos\')">Ver vencidos</button>';
    } else {
      alerta.classList.remove('active');
      alerta.innerHTML = '';
    }
  }
} // fim de renderIndicadores

function filtrarIndicador(label) {
  const map = {
    'Total': 'todos',
    'Abertas': 'abertos',
    'Aguardando NF': 'nf',
    'Em conserto': 'operacao',
    'Prazo vencido': 'vencidos',
    'Finalizados': 'finalizados',
    'Tempo médio (dias)': 'todos',
    'Custo total finaliz.': 'finalizados'
  };
  _setFiltroRapidoConsertos(map[label] || 'todos');
}

// ─── TABELAS DE PREÇOS ──────────────────────────────────
function renderTabelasPrecos() {
  const tbody = document.getElementById('tbody-tabelas-precos');
  const empty = document.getElementById('empty-state-tabelas-precos');
  if (!tbody) return;
  const lista = (DB.ConsertosTabelasPrecos.listar() || []).filter(function(t){ return t.status !== 'Excluído'; });
  if (empty) empty.style.display = lista.length  'none' : '';
  function fmtD(d) { return d  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '-'; }
  tbody.innerHTML = lista.map(function(t) {
    const stCor = t.status === 'Ativo'  'badge-ok' : (t.status === 'Vencido'  'badge-critical' : 'badge');
    return '<tr>'
      + '<td>' + Utils.safe(t.fornecedor || '—') + '</td>'
      + '<td>' + Utils.safe(t.tipoServico || '—') + '</td>'
      + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + Utils.safe(t.descricaoServico || '—') + '</td>'
      + '<td>' + Utils.safe(t.faixaPotencia || '—') + '</td>'
      + '<td>' + (t.valorContratado  Utils.fmtMoeda(t.valorContratado) : '—') + '</td>'
      + '<td style="font-size:12px">' + fmtD(t.vigenciaInicial) + ' → ' + fmtD(t.vigenciaFinal) + '</td>'
      + '<td><span class="badge ' + stCor + '">' + Utils.safe(t.status || '—') + '</span></td>'
      + '<td style="white-space:nowrap">'
        + (t.anexo_url  '<a href="' + Utils.safe(t.anexo_url) + '" class="btn btn-sm btn-outline" download="' + Utils.safe(t.anexo_nome||'tabela') + '" title="Baixar anexo" style="margin-right:4px">Anexo</a>' : '')
        + '<button class="btn btn-sm" onclick="abrirModalTabelaPreco(\'' + t.id + '\')">✏️</button> '
        + '<button class="btn btn-sm btn-danger" onclick="excluirTabelaPreco(\'' + t.id + '\')">🗑️</button>'
      + '</td>'
      + '</tr>';
  }).join('');
}

function abrirModalTabelaPreco(id) {
  document.getElementById('modal-tabela-titulo').textContent = id  'Editar Tabela de Preço' : 'Nova Tabela de Preço';
  document.getElementById('form-tabela-preco').reset();
  document.getElementById('tabela-id').value = '';
  if (id) {
    const t = DB.ConsertosTabelasPrecos.buscarId(id);
    if (!t) return;
    document.getElementById('tabela-id').value = t.id;
    document.getElementById('tabela-fornecedor').value = t.fornecedor || '';
    document.getElementById('tabela-fornecedor-sap').value = t.fornecedorSap || '';
    document.getElementById('tabela-tipo').value = t.tipoServico || 'Outros contratos';
    document.getElementById('tabela-descricao').value = t.descricaoServico || '';
    document.getElementById('tabela-faixa').value = t.faixaPotencia || '';
    document.getElementById('tabela-unidade').value = t.unidade || '';
    document.getElementById('tabela-valor').value = t.valorContratado || '';
    document.getElementById('tabela-indice').value = t.indiceReajuste || '';
    document.getElementById('tabela-vigencia-ini').value = t.vigenciaInicial || '';
    document.getElementById('tabela-vigencia-fim').value = t.vigenciaFinal || '';
    document.getElementById('tabela-status').value = t.status || 'Ativo';
    document.getElementById('tabela-obs').value = t.observacoes || '';
    // Mostra anexo atual se existir
    const anexoAtual = document.getElementById('tabela-anexo-atual');
    if (t.anexo_nome) {
      anexoAtual.innerHTML = 'Anexo atual: <a href="' + Utils.safe(t.anexo_url || '#') + '" target="_blank" download="' + Utils.safe(t.anexo_nome) + '">' + Utils.safe(t.anexo_nome) + '</a> (envie novo para substituir)';
    } else {
      anexoAtual.textContent = '';
    }
  }
  document.getElementById('form-tabela-preco').onsubmit = salvarTabelaPreco;
  Utils.abrirModal('modal-tabela-preco');
}

function salvarTabelaPreco(event) {
  event.preventDefault();
  const id = document.getElementById('tabela-id').value || null;
  const dados = {
    fornecedor: document.getElementById('tabela-fornecedor').value.trim(),
    fornecedorSap: document.getElementById('tabela-fornecedor-sap').value.trim(),
    tipoServico: document.getElementById('tabela-tipo').value,
    descricaoServico: document.getElementById('tabela-descricao').value.trim(),
    faixaPotencia: document.getElementById('tabela-faixa').value.trim(),
    unidade: document.getElementById('tabela-unidade').value.trim(),
    valorContratado: parseFloat(document.getElementById('tabela-valor').value) || 0,
    indiceReajuste: document.getElementById('tabela-indice').value.trim(),
    vigenciaInicial: document.getElementById('tabela-vigencia-ini').value || null,
    vigenciaFinal: document.getElementById('tabela-vigencia-fim').value || null,
    status: document.getElementById('tabela-status').value,
    observacoes: document.getElementById('tabela-obs').value.trim(),
  };
  if (!dados.fornecedor) return Utils.toast('Informe o fornecedor.', 'warning');
  if (id) dados.id = id;

  const fileInput = document.getElementById('tabela-anexo');
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (file) {
    Utils.lerArquivoBase64(file).then(function(base64) {
      dados.anexo_nome = file.name;
      dados.anexo_base64 = base64;
      dados.anexo_url = base64; // base64 data URL usada diretamente
      // Se editando, mantém o id
      if (id) dados.id = id;
      DB.ConsertosTabelasPrecos.salvar(dados);
      Utils.toast('Tabela de preço salva com sucesso!', 'success');
      renderTabelasPrecos();
      Utils.fecharModal('modal-tabela-preco');
    }).catch(function() { Utils.toast('Erro ao ler o arquivo.', 'error'); });
  } else {
    // Se editando, preserva anexo anterior
    if (id) {
      const existing = DB.ConsertosTabelasPrecos.buscarId(id);
      if (existing && existing.anexo_nome) {
        dados.anexo_nome = existing.anexo_nome;
        dados.anexo_base64 = existing.anexo_base64;
        dados.anexo_url = existing.anexo_url;
      }
    }
    DB.ConsertosTabelasPrecos.salvar(dados);
    Utils.toast('Tabela de preço salva com sucesso!', 'success');
    renderTabelasPrecos();
    Utils.fecharModal('modal-tabela-preco');
  }
}

function excluirTabelaPreco(id) {
  if (!confirm('Excluir esta tabela de preçoA ação não pode ser desfeita.')) return;
  const t = DB.ConsertosTabelasPrecos.buscarId(id);
  if (!t) return;
  DB.ConsertosTabelasPrecos.remover(id);
  Utils.toast('Tabela de preço excluída.', 'success');
  renderTabelasPrecos();
}

// ═══════════════════════════════════════════════════════════════════
//  ETAPA 3 — NAVEGAÇÃO POR ABAS E FUNÇÕES DE SUPORTE
// ═══════════════════════════════════════════════════════════════════

// Ativa a aba principal pelo nome (solicitacoes | fornecedores | materiais | tabelas | indicadores | relatorios)
function ativarAba(nome) {
  var abas = ['solicitacoes', 'fornecedores', 'materiais', 'tabelas', 'indicadores', 'relatorios'];
  abas.forEach(function(a) {
    var content = document.getElementById('tab-' + a);
    var btn = document.querySelector('[data-tab="' + a + '"]');
    if (content) content.classList.toggle('active', a === nome);
    if (btn) btn.classList.toggle('active', a === nome);
  });
  // Preenche selects de fornecedor nos filtros e relatórios ao trocar de aba
  if (nome === 'relatorios') _preencherSelectFornecedorRelatorios();
  if (nome === 'indicadores') renderIndicadoresCompletos();
  if (nome === 'fornecedores') renderFornecedores();
  if (nome === 'materiais') renderMateriais();
}

// Ativa sub-aba do modal de detalhes (geral | anexos | historico | auditoria)
function ativarAbaDetalhe(nome) {
  var abas = ['geral', 'anexos', 'historico', 'auditoria'];
  abas.forEach(function(a) {
    var content = document.getElementById('dtab-' + a);
    var btn = document.getElementById('dtab-btn-' + a);
    if (content) content.style.display = a === nome  '' : 'none';
    if (btn) btn.classList.toggle('active', a === nome);
  });
}

// Preenche selects de fornecedor na aba Relatórios
function _preencherSelectFornecedorRelatorios() {
  var fornecedores = DB.Fornecedores  DB.Fornecedores.listar() : [];
  var consertos = DB.Consertos.listar();
  var nomesUnicos = {};
  consertos.forEach(function(s) {
    var n = (s.fornecedor_razao_social || s.fornecedor_nome_fantasia || '').trim();
    if (n) nomesUnicos[n] = true;
  });
  fornecedores.forEach(function(f) {
    var n = (f.razaoSocial || f.razao_social || '').trim();
    if (n) nomesUnicos[n] = true;
  });
  var sel = document.getElementById('rel-filtro-fornecedor');
  if (!sel) return;
  var val = sel.value;
  sel.innerHTML = '<option value="">Todos os fornecedores</option>' +
    Object.keys(nomesUnicos).sort().map(function(n) {
      return '<option value="' + Utils.safe(n) + '">' + Utils.safe(n) + '</option>';
    }).join('');
  sel.value = val;
  // Também preenche o select da aba Solicitações
  var selF = document.getElementById('filtro-fornecedor-consertos');
  if (selF) {
    var valF = selF.value;
    selF.innerHTML = '<option value="">Todos os fornecedores</option>' +
      Object.keys(nomesUnicos).sort().map(function(n) {
        return '<option value="' + Utils.safe(n) + '">' + Utils.safe(n) + '</option>';
      }).join('');
    selF.value = valF;
  }
}

// ─── LIMPAR FILTROS ─────────────────────────────────────────────────
function limparFiltros() {
  var b = document.getElementById('busca-consertos');
  var s = document.getElementById('filtro-status-consertos');
  var f = document.getElementById('filtro-fornecedor-consertos');
  var di = document.getElementById('filtro-data-ini');
  var df = document.getElementById('filtro-data-fim');
  _filtroRapidoConsertos = 'todos';
  if (b) b.value = '';
  if (s) s.value = '';
  if (f) f.value = '';
  if (di) di.value = '';
  if (df) df.value = '';
  renderTabela();
}

// ─── COPIAR LINK SEGURO ──────────────────────────────────────────────
function copiarLink() {
  var ta = document.getElementById('link-seguro-text');
  if (!ta) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(function() {
      Utils.toast('Link copiado para a área de transferência!', 'success');
    }).catch(function() { _copiarLinkFallback(ta); });
  } else {
    _copiarLinkFallback(ta);
  }
}
function _copiarLinkFallback(ta) {
  ta.select();
  ta.setSelectionRange(0, 99999);
  try {
    document.execCommand('copy');
    Utils.toast('Link copiado!', 'success');
  } catch (e) {
    Utils.toast('Não foi possível copiar. Selecione e copie manualmente.', 'error');
  }
}

// ─── FORNECEDORES ────────────────────────────────────────────────────
function renderFornecedores() {
  var busca = (document.getElementById('busca-fornecedores') || {}).value || '';
  var filtroStatus = (document.getElementById('filtro-status-fornecedores') || {}).value || '';
  var lista = DB.Fornecedores  DB.Fornecedores.listar() : [];
  if (busca) {
    var bL = busca.toLowerCase();
    lista = lista.filter(function(f) {
      return (f.razaoSocial || '').toLowerCase().includes(bL) ||
        (f.codigoSap || '').toLowerCase().includes(bL) ||
        (f.cnpj || '').toLowerCase().includes(bL) ||
        (f.nomeFantasia || '').toLowerCase().includes(bL);
    });
  }
  if (filtroStatus) lista = lista.filter(function(f) { return (f.status || '') === filtroStatus; });
  var tbody = document.getElementById('tbody-fornecedores');
  var empty = document.getElementById('empty-state-fornecedores');
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = lista.map(function(f) {
    var stFornecedor = f.status || 'Ativo';
    var stBadge = stFornecedor === 'Ativo'  'badge-ok' : (stFornecedor === 'Inativo'  'badge-critical' : 'badge-low');
    var homologado = f.homologado === true || f.homologado === 'true';
    return '<tr>'
      + '<td><code>' + Utils.safe(f.codigoInterno || '—') + '</code></td>'
      + '<td>' + Utils.safe(f.codigoSap || '—') + '</td>'
      + '<td>' + Utils.safe(f.razaoSocial || '—') + '</td>'
      + '<td>' + Utils.safe(f.nomeFantasia || '—') + '</td>'
      + '<td>' + Utils.safe(f.cnpj || '—') + '</td>'
      + '<td>' + Utils.safe(f.tipoServico || '—') + '</td>'
      + '<td>' + (f.prazoMedio  f.prazoMedio + ' dias' : '-') + '</td>'
      + '<td><span class="badge ' + (homologado  'badge-ok' : 'badge-critical') + '">' + (homologado  'Sim' : 'Nao') + '</span></td>'
      + '<td><span class="badge ' + stBadge + '">' + Utils.safe(stFornecedor) + '</span></td>'
      + '<td style="white-space:nowrap"><button class="btn btn-sm btn-outline" onclick="abrirModalFornecedor(\'' + f.id + '\')">Editar</button>'
      + ' <button class="btn btn-sm btn-outline" onclick="excluirFornecedor(\'' + f.id + '\')">Excluir</button></td>'
      + '</tr>';
  }).join('');
  // Adiciona listeners de busca se ainda não foram adicionados
  _setupFornecedoresFiltros();
}

var _fornecedoresFiltrosSetup = false;
function _setupFornecedoresFiltros() {
  if (_fornecedoresFiltrosSetup) return;
  _fornecedoresFiltrosSetup = true;
  var b = document.getElementById('busca-fornecedores');
  var s = document.getElementById('filtro-status-fornecedores');
  if (b) b.addEventListener('input', renderFornecedores);
  if (s) s.addEventListener('change', renderFornecedores);
}

function abrirModalFornecedor(id) {
  var form = document.getElementById('form-fornecedor');
  if (!form) return;
  form.reset();
  document.getElementById('fornecedor-id').value = '';
  document.getElementById('forn-codigo-interno').value = '';
  document.getElementById('modal-fornecedor-titulo').textContent = 'Novo Fornecedor';
  if (id) {
    var f = DB.Fornecedores  DB.Fornecedores.buscarId(id) : null;
    if (!f) return;
    document.getElementById('modal-fornecedor-titulo').textContent = 'Editar Fornecedor — ' + (f.razaoSocial || '');
    document.getElementById('fornecedor-id').value = f.id;
    document.getElementById('forn-codigo-interno').value = f.codigoInterno || '';
    document.getElementById('forn-codigo-sap').value = f.codigoSap || '';
    document.getElementById('forn-razao-social').value = f.razaoSocial || '';
    document.getElementById('forn-nome-fantasia').value = f.nomeFantasia || '';
    document.getElementById('forn-cnpj').value = f.cnpj || '';
    document.getElementById('forn-ie').value = f.inscricaoEstadual || '';
    document.getElementById('forn-email').value = f.emailPrincipal || '';
    document.getElementById('forn-email-financeiro').value = f.emailFinanceiro || '';
    document.getElementById('forn-telefone').value = f.telefone || '';
    document.getElementById('forn-responsavel').value = f.responsavelComercial || '';
    document.getElementById('forn-tipo-servico').value = f.tipoServico || '';
    document.getElementById('forn-status').value = f.status || 'Ativo';
    document.getElementById('forn-homologado').value = String(f.homologado === true || f.homologado === 'true');
    document.getElementById('forn-prazo-medio').value = f.prazoMedio || '';
    document.getElementById('forn-observacoes').value = f.observacoes || '';
  }
  // Registrar submit
  form.onsubmit = function(e) {
    e.preventDefault();
    salvarFornecedor();
  };
  Utils.abrirModal('modal-fornecedor');
}

function salvarFornecedor() {
  if (!DB.Fornecedores) return;
  var fId = document.getElementById('fornecedor-id').value || null;
  var dados = {
    codigoSap: document.getElementById('forn-codigo-sap').value.trim(),
    razaoSocial: document.getElementById('forn-razao-social').value.trim(),
    nomeFantasia: document.getElementById('forn-nome-fantasia').value.trim(),
    cnpj: document.getElementById('forn-cnpj').value.trim(),
    inscricaoEstadual: document.getElementById('forn-ie').value.trim(),
    emailPrincipal: document.getElementById('forn-email').value.trim(),
    emailFinanceiro: document.getElementById('forn-email-financeiro').value.trim(),
    telefone: document.getElementById('forn-telefone').value.trim(),
    responsavelComercial: document.getElementById('forn-responsavel').value.trim(),
    tipoServico: document.getElementById('forn-tipo-servico').value.trim(),
    status: document.getElementById('forn-status').value,
    homologado: document.getElementById('forn-homologado').value === 'true',
    prazoMedio: parseInt(document.getElementById('forn-prazo-medio').value) || null,
    observacoes: document.getElementById('forn-observacoes').value.trim()
  };
  if (fId) dados.id = fId;
  DB.Fornecedores.salvar(dados);
  Utils.toast('Fornecedor salvo com sucesso!', 'success');
  renderFornecedores();
  Utils.fecharModal('modal-fornecedor');
}

function excluirFornecedor(id) {
  if (!DB.Fornecedores) return;
  if (!confirm('Excluir este fornecedorA ação não pode ser desfeita.')) return;
  DB.Fornecedores.remover(id);
  Utils.toast('Fornecedor excluído.', 'success');
  renderFornecedores();
}

// ─── MATERIAIS ───────────────────────────────────────────────────────
function renderMateriais() {
  var busca = (document.getElementById('busca-materiais') || {}).value || '';
  var filtroCateg = (document.getElementById('filtro-categoria-materiais') || {}).value || '';
  var lista = DB.MateriaisConsertos  DB.MateriaisConsertos.listar() : [];
  if (busca) {
    var bL = busca.toLowerCase();
    lista = lista.filter(function(m) {
      return (m.descricaoSap || '').toLowerCase().includes(bL) ||
        (m.codigoSap || '').toLowerCase().includes(bL) ||
        (m.tag || '').toLowerCase().includes(bL) ||
        (m.fabricante || '').toLowerCase().includes(bL);
    });
  }
  if (filtroCateg) lista = lista.filter(function(m) { return (m.categoria || '') === filtroCateg; });
  var tbody = document.getElementById('tbody-materiais');
  var empty = document.getElementById('empty-state-materiais');
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = lista.map(function(m) {
    var criticidade = m.criticidade || '-';
    var criticBadge = criticidade === 'Alta'  'badge-critical' : ((criticidade === 'Media' || criticidade === 'Mdia')  'badge-low' : 'badge-pending');
    return '<tr>'
      + '<td><code>' + Utils.safe(m.codigoInterno || '—') + '</code></td>'
      + '<td>' + Utils.safe(m.codigoSap || '—') + '</td>'
      + '<td>' + Utils.safe(m.descricaoSap || '—') + '</td>'
      + '<td>' + Utils.safe(m.categoria || '—') + '</td>'
      + '<td>' + Utils.safe((m.fabricante || '—') + (m.modelo  ' / ' + m.modelo : '')) + '</td>'
      + '<td>' + Utils.safe(m.tag || '—') + '</td>'
      + '<td>' + Utils.safe(m.setor || '—') + '</td>'
      + '<td><span class="badge ' + criticBadge + '">' + Utils.safe(criticidade) + '</span></td>'
      + '<td style="white-space:nowrap"><button class="btn btn-sm btn-outline" onclick="abrirModalMaterial(\'' + m.id + '\')">Editar</button>'
      + ' <button class="btn btn-sm btn-outline" onclick="excluirMaterial(\'' + m.id + '\')">Excluir</button></td>'
      + '</tr>';
  }).join('');
  _setupMateriaisFiltros();
}

var _materiaisFiltrosSetup = false;
function _setupMateriaisFiltros() {
  if (_materiaisFiltrosSetup) return;
  _materiaisFiltrosSetup = true;
  var b = document.getElementById('busca-materiais');
  var s = document.getElementById('filtro-categoria-materiais');
  if (b) b.addEventListener('input', renderMateriais);
  if (s) s.addEventListener('change', renderMateriais);
}

function abrirModalMaterial(id) {
  var form = document.getElementById('form-material');
  if (!form) return;
  form.reset();
  document.getElementById('material-id').value = '';
  document.getElementById('mat-codigo-interno').value = '';
  document.getElementById('modal-material-titulo').textContent = 'Novo Material';
  if (id) {
    var m = DB.MateriaisConsertos  DB.MateriaisConsertos.buscarId(id) : null;
    if (!m) return;
    document.getElementById('modal-material-titulo').textContent = 'Editar Material — ' + (m.descricaoSap || '');
    document.getElementById('material-id').value = m.id;
    document.getElementById('mat-codigo-interno').value = m.codigoInterno || '';
    document.getElementById('mat-codigo-sap').value = m.codigoSap || '';
    document.getElementById('mat-descricao-sap').value = m.descricaoSap || '';
    document.getElementById('mat-descricao-interna').value = m.descricaoInterna || '';
    document.getElementById('mat-categoria').value = m.categoria || '';
    document.getElementById('mat-tipo-item').value = m.tipoItem || '';
    document.getElementById('mat-unidade').value = m.unidade || '';
    document.getElementById('mat-valor').value = m.valorEstimado || '';
    document.getElementById('mat-tag').value = m.tag || '';
    document.getElementById('mat-numero-serie').value = m.numeroSerie || '';
    document.getElementById('mat-fabricante').value = m.fabricante || '';
    document.getElementById('mat-modelo').value = m.modelo || '';
    document.getElementById('mat-potencia').value = m.potencia || '';
    document.getElementById('mat-localizacao').value = m.localizacao || '';
    document.getElementById('mat-setor').value = m.setor || '';
    document.getElementById('mat-centro-custo').value = m.centroCusto || '';
    document.getElementById('mat-criticidade').value = m.criticidade || '';
    document.getElementById('mat-observacoes').value = m.observacoes || '';
  }
  form.onsubmit = function(e) {
    e.preventDefault();
    salvarMaterial();
  };
  Utils.abrirModal('modal-material');
}

function salvarMaterial() {
  if (!DB.MateriaisConsertos) return;
  var mId = document.getElementById('material-id').value || null;
  var dados = {
    codigoSap: document.getElementById('mat-codigo-sap').value.trim(),
    descricaoSap: document.getElementById('mat-descricao-sap').value.trim(),
    descricaoInterna: document.getElementById('mat-descricao-interna').value.trim(),
    categoria: document.getElementById('mat-categoria').value,
    tipoItem: document.getElementById('mat-tipo-item').value.trim(),
    unidade: document.getElementById('mat-unidade').value.trim(),
    valorEstimado: parseFloat(document.getElementById('mat-valor').value) || null,
    tag: document.getElementById('mat-tag').value.trim(),
    numeroSerie: document.getElementById('mat-numero-serie').value.trim(),
    fabricante: document.getElementById('mat-fabricante').value.trim(),
    modelo: document.getElementById('mat-modelo').value.trim(),
    potencia: document.getElementById('mat-potencia').value.trim(),
    localizacao: document.getElementById('mat-localizacao').value.trim(),
    setor: document.getElementById('mat-setor').value.trim(),
    centroCusto: document.getElementById('mat-centro-custo').value.trim(),
    criticidade: document.getElementById('mat-criticidade').value,
    observacoes: document.getElementById('mat-observacoes').value.trim()
  };
  if (mId) dados.id = mId;
  DB.MateriaisConsertos.salvar(dados);
  Utils.toast('Material salvo com sucesso!', 'success');
  renderMateriais();
  Utils.fecharModal('modal-material');
}

function excluirMaterial(id) {
  if (!DB.MateriaisConsertos) return;
  if (!confirm('Excluir este materialA ação não pode ser desfeita.')) return;
  DB.MateriaisConsertos.remover(id);
  Utils.toast('Material excluído.', 'success');
  renderMateriais();
}

// ─── BUSCA DE MATERIAL / FORNECEDOR NO FORMULÁRIO DE SOLICITAÇÃO ────
function buscarMaterialCadastrado() {
  if (!DB.MateriaisConsertos) return;
  var v = (document.getElementById('busca-material-cadastro') || {}).value || '';
  var resultDiv = document.getElementById('resultado-busca-material');
  if (!resultDiv || !v.trim()) return;
  var lista = DB.MateriaisConsertos.buscarPorCodigoSap(v.trim()) ||
    (DB.MateriaisConsertos.buscarPorTexto  DB.MateriaisConsertos.buscarPorTexto(v.trim()) : DB.MateriaisConsertos.listar().filter(function(m) {
      var bL = v.toLowerCase();
      return (m.codigoSap || '').toLowerCase().includes(bL) ||
        (m.descricaoSap || '').toLowerCase().includes(bL);
    }));
  if (!Array.isArray(lista)) lista = [lista].filter(Boolean);
  if (!lista || !lista.length) {
    resultDiv.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Nenhum material cadastrado encontrado.</div>';
    return;
  }
  resultDiv.innerHTML = '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;max-height:180px;overflow-y:auto">'
    + lista.slice(0, 10).map(function(m) {
      return '<div onclick="preencherMaterialNaForm(\'' + m.id + '\')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12.5px" onmouseover="this.style.background=\'var(--bg-secondary)\'" onmouseout="this.style.background=\'\'">'
        + '<strong>' + Utils.safe(m.codigoSap) + '</strong> — ' + Utils.safe(m.descricaoSap)
        + (m.fabricante  ' <span style="color:var(--text-muted)">(' + Utils.safe(m.fabricante) + ')</span>' : '')
        + '</div>';
    }).join('') + '</div>';
}

function preencherMaterialNaForm(id) {
  if (!DB.MateriaisConsertos) return;
  var m = DB.MateriaisConsertos.buscarId(id);
  if (!m) return;
  var campos = [
    ['conserto-codigo-sap', m.codigoSap],
    ['conserto-descricao-sap', m.descricaoSap],
    ['conserto-codigo-interno', m.codigoInterno],
    ['conserto-descricao-interna', m.descricaoInterna],
    ['conserto-unidade', m.unidade],
    ['conserto-fabricante', m.fabricante],
    ['conserto-modelo', m.modelo],
    ['conserto-tag', m.tag],
    ['conserto-localizacao', m.localizacao],
    ['conserto-setor', m.setor],
    ['conserto-centro-custo', m.centroCusto],
    ['conserto-potencia', m.potencia],
    ['conserto-numero-serie', m.numeroSerie]
  ];
  campos.forEach(function(par) {
    var el = document.getElementById(par[0]);
    if (el && par[1]) { el.value = par[1]; _flashAutoFill(el); }
  });
  var catEl = document.getElementById('conserto-categoria');
  if (catEl && m.categoria) catEl.value = m.categoria;
  var critEl = document.getElementById('conserto-criticidade');
  if (critEl && m.criticidade) critEl.value = m.criticidade;
  var resultDiv = document.getElementById('resultado-busca-material');
  if (resultDiv) resultDiv.innerHTML = '<div style="color:var(--success);font-size:12px">✔ Campos preenchidos com dados do material cadastrado.</div>';
}

function limparCamposMaterial() {
  ['conserto-codigo-sap','conserto-descricao-sap','conserto-codigo-interno','conserto-descricao-interna',
   'conserto-unidade','conserto-fabricante','conserto-modelo','conserto-tag','conserto-localizacao',
   'conserto-setor','conserto-centro-custo','conserto-potencia','conserto-numero-serie'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var resultDiv = document.getElementById('resultado-busca-material');
  if (resultDiv) resultDiv.innerHTML = '';
  var busca = document.getElementById('busca-material-cadastro');
  if (busca) busca.value = '';
}

function buscarFornecedorCadastrado() {
  if (!DB.Fornecedores) return;
  var v = (document.getElementById('busca-fornecedor-cadastro') || {}).value || '';
  var resultDiv = document.getElementById('resultado-busca-fornecedor');
  if (!resultDiv || !v.trim()) return;
  var bL = v.toLowerCase();
  var lista = DB.Fornecedores.listar().filter(function(f) {
    return (f.codigoSap || '').toLowerCase().includes(bL) ||
      (f.cnpj || '').replace(/\D/g,'').includes(v.replace(/\D/g,'')) ||
      (f.razaoSocial || '').toLowerCase().includes(bL) ||
      (f.nomeFantasia || '').toLowerCase().includes(bL);
  });
  if (!lista.length) {
    resultDiv.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Nenhum fornecedor cadastrado encontrado.</div>';
    return;
  }
  resultDiv.innerHTML = '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;max-height:180px;overflow-y:auto">'
    + lista.slice(0, 10).map(function(f) {
      return '<div onclick="preencherFornecedorNaForm(\'' + f.id + '\')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12.5px" onmouseover="this.style.background=\'var(--bg-secondary)\'" onmouseout="this.style.background=\'\'">'
        + '<strong>' + Utils.safe(f.codigoSap) + '</strong> — ' + Utils.safe(f.razaoSocial)
        + (f.cnpj  ' <span style="color:var(--text-muted)">(' + Utils.safe(f.cnpj) + ')</span>' : '')
        + '</div>';
    }).join('') + '</div>';
}

function preencherFornecedorNaForm(id) {
  if (!DB.Fornecedores) return;
  var f = DB.Fornecedores.buscarId(id);
  if (!f) return;
  var campos = [
    ['conserto-fornecedor-codigo', f.codigoSap],
    ['conserto-fornecedor-razao', f.razaoSocial],
    ['conserto-fornecedor-nome', f.nomeFantasia],
    ['conserto-fornecedor-cnpj', f.cnpj],
    ['conserto-fornecedor-email', f.emailPrincipal]
  ];
  campos.forEach(function(par) {
    var el = document.getElementById(par[0]);
    if (el && par[1]) { el.value = par[1]; _flashAutoFill(el); }
  });
  var servEl = document.getElementById('conserto-fornecedor-servico');
  if (servEl && f.tipoServico) servEl.value = f.tipoServico;
  var resultDiv = document.getElementById('resultado-busca-fornecedor');
  if (resultDiv) resultDiv.innerHTML = '<div style="color:var(--success);font-size:12px">✔ Campos preenchidos com dados do fornecedor cadastrado.</div>';
}

function limparCamposFornecedor() {
  ['conserto-fornecedor-codigo','conserto-fornecedor-razao','conserto-fornecedor-nome',
   'conserto-fornecedor-cnpj','conserto-fornecedor-email'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var servEl = document.getElementById('conserto-fornecedor-servico');
  if (servEl) servEl.value = '';
  var resultDiv = document.getElementById('resultado-busca-fornecedor');
  if (resultDiv) resultDiv.innerHTML = '';
  var busca = document.getElementById('busca-fornecedor-cadastro');
  if (busca) busca.value = '';
}

// ─── INDICADORES COMPLETOS (ABA INDICADORES) ─────────────────────────
function renderIndicadoresCompletos() {
  var filtroAno = (document.getElementById('ind-filtro-ano') || {}).value || '';
  var filtroMes = (document.getElementById('ind-filtro-mes') || {}).value || '';
  var todos = DB.Consertos.listar();
  // Preenche select de anos
  var anosEl = document.getElementById('ind-filtro-ano');
  if (anosEl && anosEl.options.length <= 1) {
    var anos = {};
    todos.forEach(function(s) { if (s.dataAbertura) anos[s.dataAbertura.slice(0,4)] = true; });
    Object.keys(anos).sort().forEach(function(a) {
      var op = document.createElement('option'); op.value = a; op.textContent = a;
      anosEl.appendChild(op);
    });
  }
  // Filtra por período
  if (filtroAno || filtroMes) {
    todos = todos.filter(function(s) {
      var d = (s.dataAbertura || '').slice(0,7);
      if (filtroAno && !d.startsWith(filtroAno)) return false;
      if (filtroMes && d.slice(5,7) !== filtroMes) return false;
      return true;
    });
  }
  // KPIs
  var kpi = {
    total: todos.length,
    abertas: 0, aguardandoNF: 0, emConserto: 0, vencido: 0, finalizado: 0, cancelado: 0,
    custoPrev: 0, custoFinal: 0, diasTotal: 0, diasCount: 0
  };
  todos.forEach(function(s) {
    var st = _statusConserto(s.status);
    if ([STATUS_SOLICITACAO_ABERTA,'Dados SAP conferidos'].includes(st)) kpi.abertas++;
    if (['Enviado para contabilidade','Aguardando NF','NF anexada','Link acessado','Link expirado','Novo link gerado'].includes(st)) kpi.aguardandoNF++;
    if (['Liberado para envio','Enviado para conserto','Em conserto','Prazo de retorno vencido'].includes(st)) kpi.emConserto++;
    if (_isConsertoVencido(s)) kpi.vencido++;
    if (st === 'Finalizado') {
      kpi.finalizado++;
      kpi.custoFinal += parseFloat(s.valor_final_conserto) || 0;
      if (s.data_real_envio && s.data_real_retorno) {
        var d = Math.round((new Date(s.data_real_retorno + 'T12:00:00') - new Date(s.data_real_envio + 'T12:00:00')) / 86400000);
        if (d >= 0) { kpi.diasTotal += d; kpi.diasCount++; }
      }
    }
    if (st === 'Cancelado') kpi.cancelado++;
    kpi.custoPrev += parseFloat(s.valor_material) || 0;
  });
  var tempoMedio = kpi.diasCount > 0  Math.round(kpi.diasTotal / kpi.diasCount) : null;
  function kpiCard(icon, lbl, val, cor) {
    return '<div class="ind-card"><div style="font-size:18px">' + icon + '</div>'
      + '<div class="val" style="color:' + (cor || 'var(--text)') + '">' + val + '</div>'
      + '<div class="lbl">' + lbl + '</div></div>';
  }
  var kpiEl = document.getElementById('kpi-cards');
  if (kpiEl) {
    kpiEl.innerHTML =
      kpiCard('', 'Total Solicita-es', kpi.total, 'var(--text)') +
      kpiCard('', 'Abertas', kpi.abertas, 'var(--primary)') +
      kpiCard('', 'Aguardando NF', kpi.aguardandoNF, 'var(--warning)') +
      kpiCard('', 'Em Conserto', kpi.emConserto, 'var(--primary)') +
      kpiCard('', 'Prazo Vencido', kpi.vencido, 'var(--danger)') +
      kpiCard('', 'Finalizados', kpi.finalizado, 'var(--success)') +
      kpiCard('', 'Cancelados', kpi.cancelado, 'var(--danger)') +
      (tempoMedio !== null  kpiCard('', 'Tempo Mdio (dias)', tempoMedio, 'var(--primary)') : '') +
      (kpi.custoFinal > 0  kpiCard('', 'Custo Total Final', 'R$ ' + kpi.custoFinal.toLocaleString('pt-BR', {minimumFractionDigits:2}), 'var(--success)') : '');
  }
  // Ranking de fornecedores com atraso
  var fornAtraso = {};
  todos.filter(function(s) { return !['Finalizado','Cancelado'].includes(_statusConserto(s.status)); }).forEach(function(s) {
    var f = (s.fornecedor_razao_social || s.fornecedor_nome_fantasia || 'Sem fornecedor').trim();
    if (!fornAtraso[f]) fornAtraso[f] = { total: 0, vencido: 0 };
    fornAtraso[f].total++;
    if (_isConsertoVencido(s)) fornAtraso[f].vencido++;
  });
  var raEl = document.getElementById('ind-ranking-atraso');
  if (raEl) {
    var raRows = Object.entries(fornAtraso).sort(function(a,b) { return b[1].vencido - a[1].vencido; }).slice(0,5);
    raEl.innerHTML = raRows.length  '<table style="width:100%;font-size:12px;border-collapse:collapse">'
      + '<thead><tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--border)">Fornecedor</th>'
      + '<th style="text-align:center;padding:4px;border-bottom:1px solid var(--border)">Em aberto</th>'
      + '<th style="text-align:center;padding:4px;border-bottom:1px solid var(--border)">Vencido</th></tr></thead><tbody>'
      + raRows.map(function(r) {
        return '<tr><td style="padding:4px">' + Utils.safe(r[0]) + '</td>'
          + '<td style="text-align:center;padding:4px">' + r[1].total + '</td>'
          + '<td style="text-align:center;padding:4px;color:' + (r[1].vencido > 0  'var(--danger)' : 'inherit') + '">' + r[1].vencido + '</td></tr>';
      }).join('') + '</tbody></table>'
      : '<div style="color:var(--text-muted);font-size:13px">Nenhum item em aberto.</div>';
  }
  // Ranking de itens mais enviados
  var itensRank = {};
  todos.forEach(function(s) {
    var chave = (s.codigo_material_sap || 'Sem código') + ' — ' + (s.descricao_material_sap || 'Sem descrição');
    itensRank[chave] = (itensRank[chave] || 0) + 1;
  });
  var riEl = document.getElementById('ind-ranking-itens');
  if (riEl) {
    var riRows = Object.entries(itensRank).sort(function(a,b) { return b[1]-a[1]; }).slice(0,8);
    riEl.innerHTML = riRows.length  '<table style="width:100%;font-size:12px;border-collapse:collapse">'
      + '<thead><tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--border)">Item</th>'
      + '<th style="text-align:center;padding:4px;border-bottom:1px solid var(--border)">Qtd</th></tr></thead><tbody>'
      + riRows.map(function(r) {
        return '<tr><td style="padding:4px">' + Utils.safe(r[0]) + '</td>'
          + '<td style="text-align:center;padding:4px">' + r[1] + '</td></tr>';
      }).join('') + '</tbody></table>'
      : '<div style="color:var(--text-muted);font-size:13px">Sem dados suficientes.</div>';
  }
  // Custo por fornecedor
  var custoForn = {};
  todos.filter(function(s) { return _statusConserto(s.status) === 'Finalizado'; }).forEach(function(s) {
    var f = (s.fornecedor_razao_social || s.fornecedor_nome_fantasia || 'Sem fornecedor').trim();
    custoForn[f] = (custoForn[f] || 0) + (parseFloat(s.valor_final_conserto) || 0);
  });
  var cfEl = document.getElementById('ind-custo-fornecedor');
  if (cfEl) {
    var cfRows = Object.entries(custoForn).sort(function(a,b) { return b[1]-a[1]; }).slice(0,8);
    cfEl.innerHTML = cfRows.length  '<table style="width:100%;font-size:12px;border-collapse:collapse">'
      + '<thead><tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--border)">Fornecedor</th>'
      + '<th style="text-align:right;padding:4px;border-bottom:1px solid var(--border)">Total Gasto</th></tr></thead><tbody>'
      + cfRows.map(function(r) {
        return '<tr><td style="padding:4px">' + Utils.safe(r[0]) + '</td>'
          + '<td style="text-align:right;padding:4px">R$ ' + r[1].toLocaleString('pt-BR',{minimumFractionDigits:2}) + '</td></tr>';
      }).join('') + '</tbody></table>'
      : '<div style="color:var(--text-muted);font-size:13px">Sem dados de custo finalizados.</div>';
  }
  // Custo por ativo
  var custoAtivo = {};
  todos.forEach(function(s) {
    var tag = (s.tag_patrimonio || s.ativo_tag || 'Sem TAG').trim();
    custoAtivo[tag] = (custoAtivo[tag] || 0) + 1;
  });
  var caEl = document.getElementById('ind-custo-ativo');
  if (caEl) {
    var caRows = Object.entries(custoAtivo).sort(function(a,b) { return b[1]-a[1]; }).slice(0,8);
    caEl.innerHTML = caRows.length  '<table style="width:100%;font-size:12px;border-collapse:collapse">'
      + '<thead><tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--border)">TAG / Ativo</th>'
      + '<th style="text-align:center;padding:4px;border-bottom:1px solid var(--border)">Qtd Consertos</th></tr></thead><tbody>'
      + caRows.map(function(r) {
        return '<tr><td style="padding:4px">' + Utils.safe(r[0]) + '</td>'
          + '<td style="text-align:center;padding:4px">' + r[1] + '</td></tr>';
      }).join('') + '</tbody></table>'
      : '<div style="color:var(--text-muted);font-size:13px">Sem dados de ativos.</div>';
  }
}

// ─── RELATÓRIOS ───────────────────────────────────────────────────────
var _relatorioAtual = null;

function gerarRelatorio(tipo) {
  var ini  = (document.getElementById('rel-data-ini') || {}).value || '';
  var fim  = (document.getElementById('rel-data-fim') || {}).value || '';
  var forn = (document.getElementById('rel-filtro-fornecedor') || {}).value || '';
  var st   = (document.getElementById('rel-filtro-status') || {}).value || '';
  var todos = DB.Consertos.listar();
  // Filtros globais
  if (ini) todos = todos.filter(function(s) { return (s.dataAbertura || '') >= ini; });
  if (fim) todos = todos.filter(function(s) { return (s.dataAbertura || '') <= fim; });
  if (forn) todos = todos.filter(function(s) {
    return (s.fornecedor_razao_social || s.fornecedor_nome_fantasia || '') === forn;
  });
  if (st) {
    var statusRel = _statusConserto(st);
    todos = todos.filter(function(s) { return _statusConserto(s.status) === statusRel; });
  }
  var tituloMap = {
    'periodo': 'Solicitações por Período',
    'por-fornecedor': 'Materiais por Fornecedor',
    'pendentes-retorno': 'Itens Pendentes de Retorno',
    'prazo-vencido': 'Itens com Prazo Vencido',
    'custo-ativo': 'Custos por Ativo',
    'custo-fornecedor': 'Custos por Fornecedor',
    'historico-item': 'Histórico por Item / Material',
    'historico-ativo': 'Histórico por Ativo',
    'historico-links': 'Histórico de Links Gerados',
    'historico-nf': 'Histórico de NF Anexada',
    'auditoria-acessos': 'Auditoria de Acessos'
  };
  document.getElementById('rel-titulo-atual').textContent = tituloMap[tipo] || tipo;
  var html = '';
  if (tipo === 'periodo') {
    html = _relTabela(todos, ['#', 'Material / SAP', 'Fornecedor', 'TAG', 'Status', 'Abertura', 'Prev. Retorno', 'Custo Final'],
      function(s) { return [
        s.numeroSolicitacao || '—', (s.codigo_material_sap||'—') + ' ' + (s.descricao_material_sap||''),
        s.fornecedor_razao_social || s.fornecedor_nome_fantasia || '—',
        s.tag_patrimonio || '—', _statusConserto(s.status),
        _fmtDataRel(s.dataAbertura), _fmtDataRel(s.data_prevista_retorno),
        s.valor_final_conserto  'R$ ' + parseFloat(s.valor_final_conserto).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '-'
      ]; });
  } else if (tipo === 'pendentes-retorno') {
    var pend = todos.filter(function(s) { return !['Finalizado','Cancelado'].includes(_statusConserto(s.status)); });
    html = _relTabela(pend, ['#', 'Material / SAP', 'Fornecedor', 'TAG', 'Status', 'Envio', 'Prev. Retorno', 'Dias Fora'],
      function(s) {
        var diasFora = '—';
        if (s.data_real_envio) {
          var d = Math.round((new Date() - new Date(s.data_real_envio + 'T12:00:00')) / 86400000);
          diasFora = d + ' dias';
        }
        return [ s.numeroSolicitacao || '—', (s.codigo_material_sap||'—'), s.fornecedor_razao_social||'—',
          s.tag_patrimonio||'—', _statusConserto(s.status), _fmtDataRel(s.data_real_envio), _fmtDataRel(s.data_prevista_retorno), diasFora ];
      });
  } else if (tipo === 'prazo-vencido') {
    var venc = todos.filter(_isConsertoVencido);
    html = _relTabela(venc, ['#', 'Material / SAP', 'Fornecedor', 'TAG', 'Envio', 'Prev. Retorno', 'Dias em Atraso'],
      function(s) {
        var diasAtraso = '—';
        if (s.data_prevista_retorno) {
          var d = Math.round((new Date() - new Date(s.data_prevista_retorno + 'T12:00:00')) / 86400000);
          diasAtraso = d + ' dias';
        }
        return [ s.numeroSolicitacao||'—', s.codigo_material_sap||'—', s.fornecedor_razao_social||'—',
          s.tag_patrimonio||'—', _fmtDataRel(s.data_real_envio), _fmtDataRel(s.data_prevista_retorno), diasAtraso ];
      });
  } else if (tipo === 'custo-fornecedor') {
    var agrup = {};
    todos.forEach(function(s) {
      var f = s.fornecedor_razao_social || s.fornecedor_nome_fantasia || 'Sem fornecedor';
      if (!agrup[f]) agrup[f] = { qtd: 0, custo: 0 };
      agrup[f].qtd++;
      agrup[f].custo += parseFloat(s.valor_final_conserto) || 0;
    });
    html = _relTabela(Object.entries(agrup).sort(function(a,b){return b[1].custo-a[1].custo;}),
      ['Fornecedor','Qtd Solicitações','Total Gasto'],
      function(r) { return [ r[0], r[1].qtd, 'R$ ' + r[1].custo.toLocaleString('pt-BR',{minimumFractionDigits:2}) ]; });
  } else if (tipo === 'custo-ativo') {
    var agrAtv = {};
    todos.forEach(function(s) {
      var tag = s.tag_patrimonio || s.ativo_tag || 'Sem TAG';
      if (!agrAtv[tag]) agrAtv[tag] = { qtd: 0, custo: 0 };
      agrAtv[tag].qtd++;
      agrAtv[tag].custo += parseFloat(s.valor_final_conserto) || 0;
    });
    html = _relTabela(Object.entries(agrAtv).sort(function(a,b){return b[1].custo-a[1].custo;}),
      ['TAG / Ativo','Qtd Consertos','Total Gasto'],
      function(r) { return [ r[0], r[1].qtd, 'R$ ' + r[1].custo.toLocaleString('pt-BR',{minimumFractionDigits:2}) ]; });
  } else if (tipo === 'auditoria-acessos') {
    var audit = DB.ConsertosAuditoria  DB.ConsertosAuditoria.listar() : [];
    html = _relTabela(audit, ['Data/Hora','Usuário','Ação','Detalhes','IP','Navegador'],
      function(a) { return [
        a.dataHora  new Date(a.dataHora).toLocaleString('pt-BR') : '—',
        a.usuarioNome || '—', a.acao || '—',
        (a.detalhes || '').slice(0,80),
        a.ip || '—', (a.navegador || '').slice(0,40)
      ]; });
  } else {
    html = '<div style="color:var(--text-muted);padding:20px;text-align:center">Relatório em desenvolvimento nas próximas etapas.</div>';
  }
  _relatorioAtual = { tipo: tipo, html: html };
  var cont = document.getElementById('rel-conteudo');
  if (cont) cont.innerHTML = html || '<div style="color:var(--text-muted);padding:20px;text-align:center">Sem dados para o filtro selecionado.</div>';
  var area = document.getElementById('area-relatorio');
  if (area) area.style.display = '';
  area && area.scrollIntoView({ behavior: 'smooth' });
}

function _fmtDataRel(d) { return d  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '-'; }

function _relTabela(linhas, cabecalhos, mapFn) {
  if (!linhas || !linhas.length) return '<div style="color:var(--text-muted);padding:20px;text-align:center">Sem dados para o filtro selecionado.</div>';
  return '<table style="width:100%;border-collapse:collapse;font-size:12.5px">'
    + '<thead><tr>' + cabecalhos.map(function(h) {
      return '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);white-space:nowrap">' + Utils.safe(String(h)) + '</th>';
    }).join('') + '</tr></thead>'
    + '<tbody>' + linhas.map(function(row) {
      var cells = mapFn(row);
      return '<tr>' + cells.map(function(c) {
        return '<td style="padding:5px 10px;border-bottom:1px solid var(--border)">' + Utils.safe(String(c == null  '—' : c)) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table>'
    + '<div style="font-size:11px;color:var(--text-muted);padding:8px 10px">Total: ' + linhas.length + ' registro(s)</div>';
}

function exportarRelatorioCSV() {
  if (!_relatorioAtual) { Utils.toast('Nenhum relatório gerado.', 'error'); return; }
  // Extrai dados da tabela HTML para CSV
  var cont = document.getElementById('rel-conteudo');
  if (!cont) return;
  var table = cont.querySelector('table');
  if (!table) { Utils.toast('Sem tabela para exportar.', 'error'); return; }
  var rows = [];
  table.querySelectorAll('tr').forEach(function(tr) {
    var cells = [];
    tr.querySelectorAll('th,td').forEach(function(td) {
      var v = (td.textContent || '').trim().replace(/"/g,'""');
      cells.push('"' + v + '"');
    });
    if (cells.length) rows.push(cells.join(';'));
  });
  var csv = '\uFEFF' + rows.join('\r\n'); // BOM para Excel
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio-consertos-' + _relatorioAtual.tipo + '-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Utils.toast('CSV exportado com sucesso!', 'success');
}

function imprimirRelatorio() {
  var cont = document.getElementById('rel-conteudo');
  if (!cont) return;
  var titulo = (document.getElementById('rel-titulo-atual') || {}).textContent || 'Relatório';
  var janela = window.open('', '_blank', 'width=900,height=600');
  janela.document.write('<!DOCTYPE html><html><head><title>' + titulo + '</title>'
    + '<style>body{font-family:sans-serif;font-size:12px;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:5px 8px;border:1px solid #ddd}th{background:#f5f5f5}h2{margin-bottom:10px}</style></head><body>'
    + '<h2>' + titulo + '</h2>'
    + cont.innerHTML
    + '</body></html>');
  janela.document.close();
  janela.focus();
  janela.print();
}

// ═══════════════════════════════════════════════════════════════════
//  FLUXO COMPLETO — FUNÇÕES DE APOIO
// ═══════════════════════════════════════════════════════════════════

// Confirma dados SAP e avança status para "Dados SAP conferidos"
function conferirSAP(id) {
  var s = DB.Consertos.buscarId(id);
  if (!s) return Utils.toast('Solicitação não encontrada.', 'error');
  if (!confirm('Confirmar que todos os dados SAP foram conferidos para a solicitação ' + (s.numeroSolicitacao || '') + '')) return;
  s.confirmadoSAP = true;
  s.status = 'Dados SAP conferidos';
  DB.Consertos.salvar(s);
  DB.ConsertosHistorico.criar({
    solicitacaoId: s.id,
    usuarioId: Auth.getSessao().id,
    acao: 'Dados SAP conferidos',
    detalhes: 'Dados SAP verificados e confirmados pelo usuário.'
  });
  Utils.toast('Dados SAP confirmados! Agora você pode enviar para a contabilidade.', 'success');
  renderTabela();
}

// Avaliação do fornecedor — estrelas
function _setAvaliacao(v) {
  var inp = document.getElementById('retorno-avaliacao');
  var lbl = document.getElementById('retorno-avaliacao-label');
  if (inp) inp.value = v;
  var labels = ['', 'Péssimo (1/5)', 'Ruim (2/5)', 'Regular (3/5)', 'Bom (4/5)', 'Ótimo (5/5)'];
  if (lbl) lbl.textContent = labels[v] || '';
  document.querySelectorAll('#retorno-avaliacao-stars span').forEach(function(s) {
    s.style.color = parseInt(s.getAttribute('data-v')) <= v  '#f59e0b' : '#ddd';
  });
}

// Calcula data fim da garantia com base na data retorno + dias
function _calcGarantia() {
  var dataRetorno = (document.getElementById('retorno-data') || {}).value || '';
  var diasStr = (document.getElementById('retorno-garantia-dias') || {}).value || '';
  var fimEl = document.getElementById('retorno-garantia-fim');
  var infoEl = document.getElementById('retorno-garantia-info');
  if (!fimEl) return;
  var dias = parseInt(diasStr) || 0;
  if (!dataRetorno || dias <= 0) {
    fimEl.value = '';
    if (infoEl) infoEl.textContent = dias > 0  'Informe a data de retorno.' : '';
    return;
  }
  var dtFim = new Date(dataRetorno + 'T12:00:00');
  dtFim.setDate(dtFim.getDate() + dias);
  fimEl.value = dtFim.toLocaleDateString('pt-BR');
  if (infoEl) infoEl.textContent = 'Garantia válida de ' + new Date(dataRetorno + 'T12:00:00').toLocaleDateString('pt-BR') + ' até ' + dtFim.toLocaleDateString('pt-BR') + '.';
}

// Atualiza preview do contador no modal de envio
function _atualizarContadorEnvio() {
  var dataEnvio = (document.getElementById('envio-data') || {}).value || '';
  var dataRetorno = (document.getElementById('envio-data-retorno') || {}).value || '';
  var el = document.getElementById('envio-contador-preview');
  if (!el) return;
  if (!dataEnvio || !dataRetorno) { el.style.display = 'none'; return; }
  var dEnvio = new Date(dataEnvio + 'T12:00:00');
  var dRet   = new Date(dataRetorno + 'T12:00:00');
  var dias = Math.round((dRet - dEnvio) / 86400000);
  if (dias <= 0) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = '&#128197; Enviado em <strong>' + dEnvio.toLocaleDateString('pt-BR') + '</strong> &rarr; '
    + 'Retorno previsto em <strong>' + dRet.toLocaleDateString('pt-BR') + '</strong> &nbsp;|&nbsp; '
    + '<strong>' + dias + ' dia(s)</strong> de prazo';
}

// ── Wrappers globais para onclicks do HTML ──────────────────────────
// (usados como fallback; abrirDetalhes() substitui os onclick diretamente)
function conferirSAPDetalhe()           { if (solicitacaoAtualId) { Utils.fecharModal('modal-conserto-detalhes'); conferirSAP(solicitacaoAtualId); } }
function enviarContabilidadeDetalhe()   { if (solicitacaoAtualId) { Utils.fecharModal('modal-conserto-detalhes'); enviarParaContabilidade(solicitacaoAtualId); } }
function gerarLinkDetalhe()             { if (solicitacaoAtualId) gerarLinkSeguro(solicitacaoAtualId); }
function liberarEnvioDetalhe()          { if (solicitacaoAtualId) liberarParaEnvio(solicitacaoAtualId); }
function abrirRegistrarEnvioDetalhe()   { if (solicitacaoAtualId) registrarEnvio(solicitacaoAtualId); }
function marcarEmConsertoDetalhe()      { if (solicitacaoAtualId) marcarEmConserto(solicitacaoAtualId); }
function abrirRegistrarRetornoDetalhe() { if (solicitacaoAtualId) registrarRetorno(solicitacaoAtualId); }
function finalizarConsertoDetalhe()     { if (solicitacaoAtualId) finalizarSolicitacao(solicitacaoAtualId); }
function cancelarConsertoDetalhe()      { if (solicitacaoAtualId) { Utils.fecharModal('modal-conserto-detalhes'); cancelarSolicitacao(solicitacaoAtualId); } }
function editarDetalhe()                { if (solicitacaoAtualId) { Utils.fecharModal('modal-conserto-detalhes'); editarSolicitacao(solicitacaoAtualId); } }
