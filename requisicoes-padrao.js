/* ====================================================================
  requisicoes-padrao.js - Funções de controle do formulário 
  padronizado conforme PDF original da empresa
  ==================================================================== */

// Manipulação de Responsável (quando "Outro" é selecionado)
function onResponsavelChange(select) {
  var grupoOutro = document.getElementById('grupo-responsavel-outro');
  var inputOutro = document.getElementById('req-responsavel-outro');
  if (select.value === 'OUTRO') {
    grupoOutro.style.display = '';
    inputOutro.required = true;
  } else {
    grupoOutro.style.display = 'none';
    inputOutro.required = false;
    inputOutro.value = '';
  }
}

// Manipulação de Centro de Custo / Ordem de Investimento (3 opções)
function onTipoCCOIChange(radio) {
  var grupoCC_K  = document.getElementById('grupo-cc');
  var grupoCC_I  = document.getElementById('grupo-cc-i');
  var grupoOI    = document.getElementById('grupo-oi');
  var inputCC_K  = document.getElementById('req-centro-custo-k');
  var inputCC_I  = document.getElementById('req-centro-custo-i');
  var inputOI    = document.getElementById('req-numero-oi');

  // Limpar campos
  inputCC_K.required = false;
  inputCC_I.required = false;
  inputOI.required = false;
  grupoCC_K.style.display = 'none';
  grupoCC_I.style.display = 'none';
  grupoOI.style.display = 'none';

  // Mostrar e tornar obrigatório apenas o selecionado
  if (radio.value === 'CC') {
    grupoCC_K.style.display = '';
    inputCC_K.required = true;
  } else if (radio.value === 'OI') {
    grupoCC_I.style.display = '';
    inputCC_I.required = true;
  } else if (radio.value === 'OI2') {
    grupoOI.style.display = '';
    inputOI.required = true;
  }
}

// Abrir Nova Requisição (resetar formulário)
function abrirNovaRequisicaoAtualizado() {
  var form = document.getElementById('form-req');
  if (form) form.reset();
  var reqId = document.getElementById('req-id');
  if (reqId) reqId.value = '';
  var titulo = document.getElementById('modal-req-titulo');
  if (titulo) titulo.textContent = 'Nova Requisição de Compra';
  var orcInfo = document.getElementById('orcamento-info');
  if (orcInfo) orcInfo.style.display = 'none';
  var tbodyItens = document.getElementById('itens-compra-tbody');
  if (tbodyItens) tbodyItens.innerHTML = '';

  if (typeof limparOrcamentos === 'function') {
    limparOrcamentos();
  }

  getCfgReq();
  renderPrioridadeBotoes();
  renderFluxos();
  renderMoedas();
  preencherDatalists();
  atualizarCotacaoMoeda();

  var grpColeta = document.getElementById('grupo-tipo-coleta');
  if (grpColeta) grpColeta.hidden = true;
  var elColeta = document.getElementById('req-tipo-coleta');
  if (elColeta) elColeta.value = '';

  var grpReg = document.getElementById('grupo-regularizacao-sap');
  if (grpReg) grpReg.hidden = true;
  var elReg = document.getElementById('req-numero-regularizacao-sap');
  if (elReg) elReg.value = '';

  var sessao = Auth.getSessao();
  var solicitanteNome = document.getElementById('req-solicitante-nome');
  if (solicitanteNome) solicitanteNome.value = sessao  sessao.nome : '—';

  var tipoCC = document.getElementById('req-tipo-cc');
  if (tipoCC) {
    tipoCC.checked = true;
    onTipoCCOIChange(tipoCC);
  }

  var grpRespOutro = document.getElementById('grupo-responsavel-outro');
  if (grpRespOutro) grpRespOutro.style.display = 'none';
  var respOutro = document.getElementById('req-responsavel-outro');
  if (respOutro) respOutro.required = false;

  var itemDesc = document.getElementById('novo-item-descricao');
  if (itemDesc && !itemDesc.dataset.hook) {
    itemDesc.addEventListener('change', onItemDescricaoChange);
    itemDesc.dataset.hook = '1';
  }

  var valorEl = document.getElementById('req-valor');
  if (valorEl && !valorEl.dataset.hook) {
    valorEl.addEventListener('blur', function() { formatarInputValor(valorEl); });
    valorEl.dataset.hook = '1';
  }

  var unitEl = document.getElementById('novo-item-unitario');
  if (unitEl && !unitEl.dataset.hook) {
    unitEl.addEventListener('blur', function() {
      var n = parseDinheiro(unitEl.value);
      unitEl.value = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
    unitEl.dataset.hook = '1';
  }

  pecasCache = DB.Pecas.ativas();
  Utils.abrirModal('modal-req');
}

// Expor alias global para compatibilidade e garantir que o botão funcione
window.abrirNovaRequisicaoAtualizado = abrirNovaRequisicaoAtualizado;
window.abrirNovaRequisicao = abrirNovaRequisicaoAtualizado;

// Substitua a função abrirNovaRequisicao pela nova versão
// Comente ou remova a antiga e use esta no botão
