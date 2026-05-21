/* ====================================================================
  requisicoes-email-sap.js - Funções atualizadas para email e SAP
  ==================================================================== */

// Função para confirmar número do SAP
function salvarOrdemSAP(reqId) {
  var r = DB.Requisicoes.buscarId(reqId);
  if (!r) return;
  
  var inputOrdemSAP = document.getElementById('input-ordem-sap');
  var numeroSAP = inputOrdemSAP.value.trim();
  
  if (!numeroSAP) {
    Utils.toast('Digite o número da Ordem de Compra SAP.', 'warning');
    return;
  }
  
  r.numeroOrdemSAP = numeroSAP;
  r.status = 'SOLICITADO';
  r.aprovadoEm = new Date().toISOString();
  DB.Requisicoes.salvar(r);
  
  Utils.toast('Ordem SAP ' + numeroSAP + ' confirmada! Requisição atualizada para "Solicitado".', 'success');
  verDetalhe(reqId);
}

// Função para reprovar no SAP
function reprovarSAP(reqId) {
  var r = DB.Requisicoes.buscarId(reqId);
  if (!r) return;
  
  var motivo = document.getElementById('input-motivo-reprovacao').value.trim();
  if (!motivo) {
    Utils.toast('Digite o motivo da reprovação.', 'warning');
    return;
  }
  
  r.status = 'REJEITADO';
  r.motivoRejeicao = motivo;
  r.rejeitadoEm = new Date().toISOString();
  var sessao = Auth.getSessao();
  r.rejeitadoPorNome = sessao  sessao.nome : 'Sistema';
  DB.Requisicoes.salvar(r);
  
  Utils.toast('Requisição reprovada no SAP.', 'info');
  verDetalhe(reqId);
}

// Função para confirmar recebimento
function confirmarRecebimento(reqId) {
  var r = DB.Requisicoes.buscarId(reqId);
  if (!r) return;
  
  var qtdRecebida = document.getElementById('input-qtd-recebida').value;
  var obsRecebimento = document.getElementById('input-obs-recebimento').value.trim();
  
  if (!qtdRecebida || parseFloat(qtdRecebida) <= 0) {
    Utils.toast('Informe uma quantidade válida.', 'warning');
    return;
  }
  
  r.status = 'RECEBIDO';
  r.quantidadeRecebida = parseFloat(qtdRecebida);
  r.obsRecebimento = obsRecebimento || '';
  r.recebidoEm = new Date().toISOString();
  var sessao = Auth.getSessao();
  r.recebidoPorNome = sessao  sessao.nome : 'Sistema';
  DB.Requisicoes.salvar(r);
  
  Utils.toast('Recebimento confirmado!', 'success');
  verDetalhe(reqId);
}

// Função helper para formatar label de classificação
function obterLabelClassificacao(cod) {
  var map = {
    '31203003': '31203003 - MANUTENÇÃO ELÉTRICA',
    '31203002': '31203002 - MANUTENÇÃO MECÂNICA',
    '31203001': '31203001 - MANUTENÇÃO CIVIL',
    '31203005': '31203005 - MANUTENÇÃO DE EMPILHADEIRA',
    'SERV_TERCEIROS': 'SERVIÇO DE TERCEIROS',
    'SERV_TERCEIROS_MECANICA': 'SERVIÇO DE TERCEIROS - MANUTENÇÃO MECÂNICA',
    'SERV_TERCEIROS_ELETRICA': 'SERVIÇO DE TERCEIROS - MANUTENÇÃO ELÉTRICA',
    'SERV_TERCEIROS_CIVIL': 'SERVIÇO DE TERCEIROS - MANUTENÇÃO CIVIL',
    'SERV_TERCEIROS_EMPILHADEIRA': 'SERVIÇO DE TERCEIROS - MANUTENÇÃO EMPILHADEIRA',
    'SERRALHERIA': 'SERRALHERIA',
    '31206007': '31206007 - MATERIAL DE SEGURANÇA',
    '31206009': '31206009 - UNIFORMES',
    '31207011': '31207011 - MATERIAL DE EXPEDIENTE'
  };
  return map[cod] || cod || '—';
}

// Função helper para label de prioridade
function labelPrioridade(p) {
  var map = {
    'NORMAL': 'Normal',
    'BAIXA': 'Baixa',
    'MEDIA': 'Média',
    'ALTA': 'Alta',
    'URGENTE': 'Urgente'
  };
  return map[p] || p || 'Normal';
}
