'use strict';
/* =========================================================
   schema.js — Definição formal dos modelos de dados
   Atlas PCM — Almoxarifado Manutenção

   Usado por:
     - server.js    → validação de campos obrigatórios
     - DataStore    → abstração sobre o backend de armazenamento
     - migrar-para-sqlite.js → geração de DDL SQL

   Tipos suportados:
     TEXT     → string / VARCHAR / TEXT no SQL
     INTEGER  → número inteiro / booleano (0/1) no SQLite
     REAL     → número decimal / FLOAT no SQL
     JSON     → array ou objeto serializado como TEXT no SQL
     BLOB     → binário (não usado atualmente, reservado para futuro)

   Relacionamentos (references):
     'tabela.campo' → equivale a FOREIGN KEY em SQL

   Notas de migração:
     • Campos booleanos usam INTEGER (0/1) no SQLite / BOOLEAN no PostgreSQL
     • Campos de data são TEXT ISO-8601 no JSON; DATE/TIMESTAMPTZ no PostgreSQL
     • Campos JSON serão TEXT (JSON) no SQLite; JSONB no PostgreSQL
     • Imagens (base64) estão sendo migradas para arquivos em disco; campo 'imagem'
       será NULL para novos registros no modelo de arquivos
   ========================================================= */

const SCHEMAS = {

  // ── PEÇAS DE ESTOQUE ────────────────────────────────────────────────────────
  pecas: {
    tableName: 'pecas',
    fields: {
      id:               { type: 'TEXT',    primaryKey: true },
      codigo:           { type: 'TEXT',    required: true, unique: true,  index: true,  comment: 'Código interno do almoxarifado' },
      nome:             { type: 'TEXT',    required: true,                               comment: 'Nome/descrição da peça' },
      categoria:        { type: 'TEXT',                                                   comment: 'Categoria (Rolamentos, Elétrica, etc.)' },
      unidade:          { type: 'TEXT',    default: 'UN',                                comment: 'Unidade de medida (UN, KG, MT, LT)' },
      estoqueMinimo:    { type: 'INTEGER', default: 0,                                   comment: 'Nível mínimo para alerta de reposição' },
      localizacao:      { type: 'TEXT',                                                   comment: 'Prateleira / gaveta / local físico' },
      fornecedor:       { type: 'TEXT',                                                   comment: 'Nome do fornecedor padrão' },
      precoUnitario:    { type: 'REAL',    default: 0,                                   comment: 'Preço unitário de reposição (R$)' },
      descricao:        { type: 'TEXT',                                                   comment: 'Descrição técnica complementar' },
      ativo:            { type: 'INTEGER', default: 1,                                   comment: 'Soft-delete: 1=ativo, 0=inativo' },
      imagem:           { type: 'TEXT',                                                   comment: 'Base64 legado (novo modelo usa imagens[])' },
      imagemExplodida:  { type: 'TEXT',                                                   comment: 'Base64 legado vista explodida' },
      imagens:          { type: 'JSON',    default: '[]',                                comment: 'Array de filenames em /data/imagens/' },
      criadoEm:         { type: 'TEXT',                                                   comment: 'ISO-8601 timestamp de criação' },
    },
    indexes: ['codigo', 'categoria', 'ativo'],
    relations: [],
  },

  // ── MOVIMENTOS DE ESTOQUE ───────────────────────────────────────────────────
  movimentos: {
    tableName: 'movimentos',
    fields: {
      id:            { type: 'TEXT',    primaryKey: true },
      tipo:          { type: 'TEXT',    required: true,  index: true,  comment: 'ENTRADA | SAIDA | AJUSTE | AJUSTE_ADD | AJUSTE_SUB' },
      pecaId:        { type: 'TEXT',    required: true,  index: true,  references: 'pecas.id',     comment: 'FK → pecas' },
      ativoId:       { type: 'TEXT',                     index: true,  references: 'ativos.id',    comment: 'FK → ativo vinculado (opcional)' },
      quantidade:    { type: 'REAL',    required: true,                comment: 'Quantidade movimentada (positivo)' },
      data:          { type: 'TEXT',                     index: true,  comment: 'Data do movimento (ISO-8601)' },
      responsavel:   { type: 'TEXT',                                   references: 'usuarios.id',  comment: 'FK → usuário responsável' },
      ordemServico:  { type: 'TEXT',                                   comment: 'Número da OS relacionada' },
      observacao:    { type: 'TEXT',                                   comment: 'Observação livre' },
      criadoEm:      { type: 'TEXT',                                   comment: 'ISO-8601 timestamp de criação' },
    },
    indexes: ['pecaId', 'ativoId', 'tipo', 'data'],
    relations: [
      { from: 'pecaId',      to: 'pecas.id',    type: 'many-to-one' },
      { from: 'ativoId',     to: 'ativos.id',   type: 'many-to-one', optional: true },
      { from: 'responsavel', to: 'usuarios.id', type: 'many-to-one', optional: true },
    ],
  },

  // ── USUÁRIOS DO SISTEMA ─────────────────────────────────────────────────────
  usuarios: {
    tableName: 'usuarios',
    fields: {
      id:       { type: 'TEXT',    primaryKey: true },
      nome:     { type: 'TEXT',    required: true,                             comment: 'Nome completo' },
      email:    { type: 'TEXT',    required: true, unique: true, index: true,  comment: 'Email de acesso (único)' },
      senha:    { type: 'TEXT',    required: true,                             comment: 'Senha em base64 — MIGRAR para bcrypt/argon2 em produção' },
      nivel:    { type: 'TEXT',    required: true, index: true,               comment: 'ADMIN | MANUTENCAO | CONSULTA' },
      ativo:    { type: 'INTEGER', default: 1,                                comment: 'Soft-delete: 1=ativo, 0=inativo' },
      criadoEm: { type: 'TEXT',                                               comment: 'ISO-8601 timestamp de criação' },
    },
    indexes: ['email', 'nivel', 'ativo'],
    relations: [],
    // NOTA DE SEGURANÇA: no banco de dados de produção, 'senha' deve ser hash bcrypt/argon2,
    // nunca base64. Ao migrar, executar script de re-hash antes de ativar o banco.
    securityNote: 'senha armazenada em base64 — NÃO adequado para produção. Migrar para hash argon2id.',
  },

  // ── ATIVOS / EQUIPAMENTOS ────────────────────────────────────────────────────
  ativos: {
    tableName: 'ativos',
    fields: {
      id:          { type: 'TEXT',    primaryKey: true },
      tag:         { type: 'TEXT',    required: true, unique: true, index: true,  comment: 'TAG patrimonial / código do equipamento' },
      descricao:   { type: 'TEXT',    required: true,                              comment: 'Descrição do equipamento' },
      setor:       { type: 'TEXT',                    index: true,                 comment: 'Setor / área de instalação' },
      fabricante:  { type: 'TEXT',                                                 comment: 'Fabricante do equipamento' },
      modelo:      { type: 'TEXT',                                                 comment: 'Modelo do equipamento' },
      ativo:       { type: 'INTEGER', default: 1,                                 comment: 'Soft-delete: 1=ativo, 0=desativado' },
      criadoEm:    { type: 'TEXT',                                                 comment: 'ISO-8601 timestamp de criação' },
    },
    indexes: ['tag', 'setor', 'ativo'],
    relations: [],
  },

  // ── AJUSTES DE ESTOQUE ───────────────────────────────────────────────────────
  ajustes: {
    tableName: 'ajustes',
    fields: {
      id:            { type: 'TEXT',    primaryKey: true },
      pecaId:        { type: 'TEXT',    required: true, index: true, references: 'pecas.id',     comment: 'FK → peça ajustada' },
      tipo:          { type: 'TEXT',    required: true, index: true,                               comment: 'ENTRADA | SAIDA' },
      quantidade:    { type: 'REAL',    required: true,                                            comment: 'Quantidade do ajuste' },
      motivo:        { type: 'TEXT',                                                               comment: 'Justificativa do ajuste' },
      status:        { type: 'TEXT',    default: 'PENDENTE', index: true,                         comment: 'PENDENTE | APROVADO | REJEITADO' },
      solicitanteId: { type: 'TEXT',                         references: 'usuarios.id',           comment: 'FK → usuário solicitante' },
      aprovadorId:   { type: 'TEXT',                         references: 'usuarios.id',           comment: 'FK → usuário aprovador' },
      criadoEm:      { type: 'TEXT',                                                               comment: 'ISO-8601 timestamp de criação' },
      aprovadoEm:    { type: 'TEXT',                                                               comment: 'ISO-8601 timestamp de aprovação/rejeição' },
    },
    indexes: ['pecaId', 'status', 'solicitanteId'],
    relations: [
      { from: 'pecaId',        to: 'pecas.id',     type: 'many-to-one' },
      { from: 'solicitanteId', to: 'usuarios.id',  type: 'many-to-one', optional: true },
      { from: 'aprovadorId',   to: 'usuarios.id',  type: 'many-to-one', optional: true },
    ],
  },

  // ── REQUISIÇÕES DE MATERIAL ──────────────────────────────────────────────────
  requisicoes: {
    tableName: 'requisicoes',
    fields: {
      id:            { type: 'TEXT',    primaryKey: true },
      numero:        { type: 'TEXT',    required: true, unique: true, index: true,  comment: 'Número sequencial (REQ-0001)' },
      status:        { type: 'TEXT',    default: 'PENDENTE', index: true,           comment: 'PENDENTE | APROVADO | REJEITADO | ENTREGUE' },
      solicitanteId: { type: 'TEXT',                    index: true,               comment: 'FK → usuário solicitante' },
      itens:         { type: 'JSON',    default: '[]',                             comment: 'Array [{pecaId, quantidade, observacao}]' },
      observacao:    { type: 'TEXT',                                               comment: 'Observação geral da requisição' },
      ordemServico:  { type: 'TEXT',                    index: true,               comment: 'Número da OS relacionada' },
      criadoEm:      { type: 'TEXT',                                               comment: 'ISO-8601 timestamp de criação' },
      aprovadoEm:    { type: 'TEXT',                                               comment: 'ISO-8601 timestamp de aprovação' },
      aprovadorId:   { type: 'TEXT',                                               references: 'usuarios.id', comment: 'FK → aprovador' },
    },
    indexes: ['numero', 'status', 'solicitanteId', 'ordemServico'],
    relations: [
      { from: 'solicitanteId', to: 'usuarios.id', type: 'many-to-one', optional: true },
      { from: 'aprovadorId',   to: 'usuarios.id', type: 'many-to-one', optional: true },
    ],
  },

  // ── NOTIFICAÇÕES INTERNAS ────────────────────────────────────────────────────
  notificacoes: {
    tableName: 'notificacoes',
    fields: {
      id:       { type: 'TEXT',    primaryKey: true },
      userId:   { type: 'TEXT',    required: true, index: true,  references: 'usuarios.id',  comment: 'FK → destinatário' },
      titulo:   { type: 'TEXT',    required: true,                                            comment: 'Título curto' },
      mensagem: { type: 'TEXT',                                                               comment: 'Corpo da notificação' },
      tipo:     { type: 'TEXT',                                                               comment: 'info | warning | error | success' },
      lida:     { type: 'INTEGER', default: 0, index: true,                                  comment: '0=não lida, 1=lida' },
      criadoEm: { type: 'TEXT',                                                               comment: 'ISO-8601 timestamp de criação' },
    },
    indexes: ['userId', 'lida'],
    relations: [
      { from: 'userId', to: 'usuarios.id', type: 'many-to-one' },
    ],
  },

  // ── USUÁRIOS DE RETIRADA (portaria / chão de fábrica) ───────────────────────
  usuarios_retirada: {
    tableName: 'usuarios_retirada',
    fields: {
      id:        { type: 'TEXT',    primaryKey: true },
      nome:      { type: 'TEXT',    required: true,                              comment: 'Nome do colaborador' },
      matricula: { type: 'TEXT',                   index: true,                  comment: 'Matrícula do colaborador' },
      setor:     { type: 'TEXT',                                                 comment: 'Setor / área' },
      ativo:     { type: 'INTEGER', default: 1,                                 comment: 'Soft-delete: 1=ativo, 0=inativo' },
      criadoEm:  { type: 'TEXT',                                                 comment: 'ISO-8601 timestamp de criação' },
    },
    indexes: ['matricula', 'ativo'],
    relations: [],
  },

  // ── CONSERTOS — SOLICITAÇÕES ────────────────────────────────────────────────
  consertos_solicitacoes: {
    tableName: 'consertos_solicitacoes',
    fields: {
      id:                        { type: 'TEXT',    primaryKey: true },
      numeroSolicitacao:         { type: 'TEXT',    required: true, unique: true, index: true,  comment: 'Número sequencial (CON-00001)' },
      status:                    { type: 'TEXT',    default: 'Solicitação aberta', index: true, comment: 'Status do fluxo de conserto' },
      // Material
      codigo_material_sap:       { type: 'TEXT',    required: true, index: true,               comment: 'Código SAP do material' },
      descricao_material_sap:    { type: 'TEXT',    required: true,                             comment: 'Descrição SAP do material' },
      codigo_interno:            { type: 'TEXT',                                                comment: 'Código interno PCM-Atlas' },
      descricao_interna:         { type: 'TEXT',                                                comment: 'Descrição interna complementar' },
      quantidade:                { type: 'INTEGER', default: 1,                                comment: 'Quantidade de itens' },
      valor:                     { type: 'REAL',                                               comment: 'Valor estimado do conserto (R$)' },
      unidade:                   { type: 'TEXT',                                               comment: 'Unidade de medida' },
      numero_serie:              { type: 'TEXT',                                               comment: 'Número de série do item' },
      tag:                       { type: 'TEXT',                                               comment: 'TAG / patrimônio do item' },
      fabricante:                { type: 'TEXT',                                               comment: 'Fabricante do item' },
      modelo:                    { type: 'TEXT',                                               comment: 'Modelo do item' },
      localizacao:               { type: 'TEXT',                                               comment: 'Local de instalação / origem' },
      setor:                     { type: 'TEXT',                                               comment: 'Setor de origem' },
      // Fornecedor de serviço
      fornecedor_razao_social:   { type: 'TEXT',    required: true,                             comment: 'Razão social do fornecedor' },
      fornecedor_codigo_sap:     { type: 'TEXT',                   index: true,               comment: 'Código SAP do fornecedor' },
      fornecedor_email:          { type: 'TEXT',                                               comment: 'Email de contato do fornecedor' },
      fornecedor_telefone:       { type: 'TEXT',                                               comment: 'Telefone do fornecedor' },
      fornecedor_cnpj:           { type: 'TEXT',                                               comment: 'CNPJ do fornecedor' },
      fornecedor_servico:        { type: 'TEXT',                                               comment: 'Tipo de serviço (Elétrico, Mecânico, etc.)' },
      // Relacionamentos
      ativo_id:                  { type: 'TEXT',                   index: true, references: 'ativos.id',    comment: 'FK → ativo vinculado' },
      solicitanteId:             { type: 'TEXT',                   index: true, references: 'usuarios.id',  comment: 'FK → usuário solicitante' },
      // Controle SAP / aprovação
      confirmadoSAP:             { type: 'INTEGER', default: 0,                comment: '1=dados SAP conferidos manualmente' },
      // Datas do fluxo
      data_prevista_envio:       { type: 'TEXT',                               comment: 'Data prevista de envio para conserto' },
      data_prevista_retorno:     { type: 'TEXT',                               comment: 'Data prevista de retorno do conserto' },
      data_envio_contabilidade:  { type: 'TEXT',                               comment: 'Quando foi enviado para contabilidade' },
      data_envio_fisico:         { type: 'TEXT',                               comment: 'Quando o material foi fisicamente enviado' },
      data_retorno:              { type: 'TEXT',                               comment: 'Quando o material retornou do conserto' },
      data_finalizacao:          { type: 'TEXT',                               comment: 'Quando o processo foi finalizado' },
      prazoEmailEnviadoEm:       { type: 'TEXT',                               comment: 'Timestamp do último email de prazo vencido (evita spam)' },
      // Observações
      observacoes:               { type: 'TEXT',                               comment: 'Observações internas do PCM' },
      observacoes_contabilidade: { type: 'TEXT',                               comment: 'Observações preenchidas pela contabilidade' },
      // Auditoria
      criadoEm:                  { type: 'TEXT',                               comment: 'ISO-8601 timestamp de criação' },
      atualizadoEm:              { type: 'TEXT',                               comment: 'ISO-8601 timestamp da última atualização' },
    },
    indexes: [
      'numeroSolicitacao', 'status', 'codigo_material_sap',
      'fornecedor_codigo_sap', 'solicitanteId', 'ativo_id',
    ],
    relations: [
      { from: 'ativo_id',      to: 'ativos.id',    type: 'many-to-one', optional: true },
      { from: 'solicitanteId', to: 'usuarios.id',  type: 'many-to-one', optional: true },
    ],
  },

  // ── CONSERTOS — TOKENS DE LINK SEGURO ───────────────────────────────────────
  consertos_tokens: {
    tableName: 'consertos_tokens',
    fields: {
      id:                      { type: 'TEXT',    primaryKey: true },
      solicitacaoId:           { type: 'TEXT',    required: true, index: true, references: 'consertos_solicitacoes.id', comment: 'FK → solicitação' },
      token_hash:              { type: 'TEXT',    required: true, unique: true, index: true, comment: 'SHA-256 do token em texto claro (nunca armazenado)' },
      status:                  { type: 'TEXT',    default: 'ativo', index: true,             comment: 'ativo | expirado | expirado_temporariamente | invalidado | usado' },
      maxAcessos:              { type: 'INTEGER', default: 2,                               comment: 'Máximo de acessos permitidos' },
      acessosRealizados:       { type: 'INTEGER', default: 0,                               comment: 'Contador de acessos ao link' },
      expiraEm:                { type: 'TEXT',                                              comment: 'Timestamp de expiração (ISO-8601)' },
      criadoEm:                { type: 'TEXT',                                              comment: 'ISO-8601 timestamp de criação' },
      ultimoAcessoEm:          { type: 'TEXT',                                              comment: 'ISO-8601 do último acesso' },
      usadoEm:                 { type: 'TEXT',                                              comment: 'ISO-8601 quando foi marcado como usado' },
      ip_ultimo_acesso:        { type: 'TEXT',                                              comment: 'IP do último acesso (auditoria)' },
      navegador_ultimo_acesso: { type: 'TEXT',                                              comment: 'User-Agent do último acesso (auditoria)' },
    },
    indexes: ['solicitacaoId', 'status', 'token_hash'],
    relations: [
      { from: 'solicitacaoId', to: 'consertos_solicitacoes.id', type: 'many-to-one' },
    ],
  },

  // ── CONSERTOS — ANEXOS (NF, XML) ────────────────────────────────────────────
  consertos_anexos: {
    tableName: 'consertos_anexos',
    fields: {
      id:             { type: 'TEXT',    primaryKey: true },
      solicitacaoId:  { type: 'TEXT',    required: true, index: true, references: 'consertos_solicitacoes.id', comment: 'FK → solicitação' },
      tipoAnexo:      { type: 'TEXT',                                                                          comment: 'PDF | XML' },
      nomeOriginal:   { type: 'TEXT',    required: true,                                                       comment: 'Nome original do arquivo enviado' },
      nomeArmazenado: { type: 'TEXT',    required: true, unique: true,                                         comment: 'Nome em disco em /data/consertos_anexos/' },
      caminho:        { type: 'TEXT',                                                                          comment: 'URL de acesso seguro com key= (HMAC)' },
      extensao:       { type: 'TEXT',                                                                          comment: '.pdf | .xml' },
      mimeType:       { type: 'TEXT',                                                                          comment: 'MIME type declarado pelo cliente' },
      tamanho:        { type: 'INTEGER',                                                                       comment: 'Tamanho do arquivo em bytes' },
      hashArquivo:    { type: 'TEXT',                                                                          comment: 'SHA-256 do conteúdo do arquivo (integridade)' },
      origemUpload:   { type: 'TEXT',                                                                          comment: 'contabilidade | interno' },
      enviadoEm:      { type: 'TEXT',                                                                          comment: 'ISO-8601 timestamp do upload' },
    },
    indexes: ['solicitacaoId'],
    relations: [
      { from: 'solicitacaoId', to: 'consertos_solicitacoes.id', type: 'many-to-one' },
    ],
  },

  // ── CONSERTOS — HISTÓRICO / AUDITORIA ───────────────────────────────────────
  consertos_historico: {
    tableName: 'consertos_historico',
    fields: {
      id:            { type: 'TEXT',    primaryKey: true },
      solicitacaoId: { type: 'TEXT',    index: true, references: 'consertos_solicitacoes.id', comment: 'FK → solicitação' },
      acao:          { type: 'TEXT',    required: true,                                        comment: 'Ação realizada (ex: NF anexada, Status alterado)' },
      detalhes:      { type: 'TEXT',                                                           comment: 'Detalhes livres da ação' },
      usuarioId:     { type: 'TEXT',                    references: 'usuarios.id',            comment: 'FK → usuário que realizou a ação' },
      usuarioNome:   { type: 'TEXT',                                                           comment: 'Nome do usuário no momento da ação' },
      dataHora:      { type: 'TEXT',                    index: true,                           comment: 'ISO-8601 timestamp da ação' },
      ip:            { type: 'TEXT',                                                           comment: 'IP de origem (servidor)' },
      userAgent:     { type: 'TEXT',                                                           comment: 'User-Agent do cliente' },
      origemUrl:     { type: 'TEXT',                                                           comment: 'URL da página de origem' },
      xForwardedFor: { type: 'TEXT',                                                           comment: 'Cabeçalho X-Forwarded-For (proxy/VPN)' },
    },
    indexes: ['solicitacaoId', 'dataHora'],
    relations: [
      { from: 'solicitacaoId', to: 'consertos_solicitacoes.id', type: 'many-to-one', optional: true },
      { from: 'usuarioId',     to: 'usuarios.id',               type: 'many-to-one', optional: true },
    ],
  },

  // ── CONSERTOS — TABELAS DE PREÇOS ────────────────────────────────────────────
  consertos_tabelas_precos: {
    tableName: 'consertos_tabelas_precos',
    fields: {
      id:               { type: 'TEXT',    primaryKey: true },
      fornecedorCodigo: { type: 'TEXT',    index: true,                 comment: 'Código SAP do fornecedor' },
      fornecedorNome:   { type: 'TEXT',                                 comment: 'Nome do fornecedor' },
      descricaoServico: { type: 'TEXT',    required: true,              comment: 'Descrição do serviço / peça' },
      valorUnitario:    { type: 'REAL',    required: true,              comment: 'Valor unitário negociado (R$)' },
      unidade:          { type: 'TEXT',                                 comment: 'Unidade de medida do serviço' },
      observacoes:      { type: 'TEXT',                                 comment: 'Observações do contrato / tabela' },
      criadoEm:         { type: 'TEXT',                                 comment: 'ISO-8601 timestamp de criação' },
    },
    indexes: ['fornecedorCodigo'],
    relations: [],
  },

};

// ── Helpers de uso no servidor e na migração ─────────────────────────────────

/**
 * Retorna todos os campos obrigatórios de um schema.
 * Usado para validação server-side antes de inserir/atualizar.
 */
function getCamposObrigatorios(nome) {
  const schema = SCHEMAS[nome];
  if (!schema) return [];
  return Object.entries(schema.fields)
    .filter(function(e) { return e[1].required && !e[1].primaryKey; })
    .map(function(e) { return e[0]; });
}

/**
 * Valida um objeto contra o schema, retornando array de erros.
 * Retorna [] se válido.
 */
function validar(nome, obj) {
  const erros = [];
  const schema = SCHEMAS[nome];
  if (!schema) { erros.push('Schema "' + nome + '" não encontrado'); return erros; }
  Object.entries(schema.fields).forEach(function(entry) {
    const campo = entry[0];
    const def   = entry[1];
    if (def.required && !def.primaryKey && (obj[campo] === undefined || obj[campo] === null || obj[campo] === '')) {
      erros.push('Campo obrigatório ausente: ' + campo);
    }
  });
  return erros;
}

/**
 * Gera o DDL SQL (CREATE TABLE) para um schema.
 * Compatível com SQLite e (com pequenas adaptações) PostgreSQL.
 */
function gerarCreateTable(nome) {
  const schema = SCHEMAS[nome];
  if (!schema) throw new Error('Schema "' + nome + '" não encontrado');
  const typeMap = { TEXT: 'TEXT', INTEGER: 'INTEGER', REAL: 'REAL', JSON: 'TEXT', BLOB: 'BLOB' };
  const cols = Object.entries(schema.fields).map(function(entry) {
    const campo = entry[0];
    const def   = entry[1];
    const tipo  = typeMap[def.type] || 'TEXT';
    let col = '  "' + campo + '" ' + tipo;
    if (def.primaryKey)                 col += ' PRIMARY KEY';
    if (def.required && !def.primaryKey) col += ' NOT NULL';
    if (def.unique && !def.primaryKey)   col += ' UNIQUE';
    if (def.default !== undefined) {
      col += ' DEFAULT ' + (typeof def.default === 'string'  "'" + def.default + "'" : String(def.default));
    }
    if (def.comment) col += ' -- ' + def.comment;
    return col;
  });
  const lines = ['CREATE TABLE IF NOT EXISTS "' + nome + '" ('].concat(
    cols.map(function(c, i) { return c + (i < cols.length - 1  ',' : ''); })
  ).concat([')']);
  return lines.join('\n');
}

/**
 * Gera os CREATE INDEX para um schema.
 */
function gerarIndexes(nome) {
  const schema = SCHEMAS[nome];
  if (!schema || !schema.indexes) return [];
  return schema.indexes.map(function(campo) {
    return 'CREATE INDEX IF NOT EXISTS "idx_' + nome + '_' + campo + '" ON "' + nome + '" ("' + campo + '")';
  });
}

module.exports = { SCHEMAS, getCamposObrigatorios, validar, gerarCreateTable, gerarIndexes };
