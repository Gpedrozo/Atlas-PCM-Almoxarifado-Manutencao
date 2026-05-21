/* ====================================================================
  requisicoes-novo.js - Upload e remocao de orcamentos
  ==================================================================== */

var orcamentosTemporarios = [];
var orcamentoTemporario = null;

function sincronizarOrcamentoLegado() {
  orcamentoTemporario = orcamentosTemporarios[0] || null;
}

function atualizarPreviewOrcamentos() {
  var infoEl = document.getElementById('orcamento-info');
  var listaEl = document.getElementById('orcamento-lista');
  var countEl = document.getElementById('orcamento-count');
  if (!infoEl || !listaEl || !countEl) return;

  if (!orcamentosTemporarios.length) {
    infoEl.style.display = 'none';
    listaEl.innerHTML = '';
    countEl.textContent = '0 arquivos anexados';
    return;
  }

  countEl.textContent = orcamentosTemporarios.length + ' arquivo(s) anexado(s)';
  listaEl.innerHTML = orcamentosTemporarios.map(function(arq, idx) {
    var tamanhoKb = (arq.tamanho / 1024).toFixed(1);
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:4px 0">'
      + '<span style="font-size:12px;color:#2e7d32;font-weight:600">✓ ' + Utils.safe(arq.nomeOriginal) + ' (' + tamanhoKb + ' KB)</span>'
      + '<button type="button" onclick="event.stopPropagation();removerOrcamento(' + idx + ')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:13px;padding:0 4px" title="Remover arquivo">✕</button>'
      + '</div>';
  }).join('');
  infoEl.style.display = '';
}

function lerArquivoEmBase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      resolve({
        base64: e.target.result,
        nomeOriginal: file.name,
        tamanho: file.size,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Selecionar arquivos de orcamento (limite de 10 arquivos)
function handleUploadOrcamento(event) {
  var files = Array.prototype.slice.call((event && event.target && event.target.files) || []);
  if (!files.length) return;

  var limiteArquivos = 10;
  var vagas = limiteArquivos - orcamentosTemporarios.length;
  if (vagas <= 0) {
    Utils.toast('Limite de ' + limiteArquivos + ' arquivos atingido.', 'warning');
    event.target.value = '';
    return;
  }
  if (files.length > vagas) {
    files = files.slice(0, vagas);
    Utils.toast('Apenas ' + vagas + ' arquivo(s) foram adicionados para respeitar o limite de ' + limiteArquivos + '.', 'info');
  }

  var extensoesPermitidas = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'];
  var validos = [];
  var rejeitados = 0;

  files.forEach(function(file) {
    var ext = file.name.split('.').pop().toLowerCase();
    if (file.size > 5 * 1024 * 1024) {
      rejeitados++;
      return;
    }
    if (!extensoesPermitidas.includes(ext)) {
      rejeitados++;
      return;
    }
    validos.push(file);
  });

  if (!validos.length) {
    Utils.toast('Nenhum arquivo válido. Use PDF, JPG, PNG, DOC ou XLS (máx. 5 MB por arquivo).', 'error');
    event.target.value = '';
    return;
  }

  Promise.all(validos.map(lerArquivoEmBase64))
    .then(function(lidos) {
      Array.prototype.push.apply(orcamentosTemporarios, lidos);
      sincronizarOrcamentoLegado();
      atualizarPreviewOrcamentos();
      var msg = lidos.length + ' arquivo(s) anexado(s) com sucesso';
      if (rejeitados > 0) msg += ' (' + rejeitados + ' rejeitado(s))';
      Utils.toast(msg + '.', 'success');
      event.target.value = '';
    })
    .catch(function() {
      Utils.toast('Erro ao ler arquivos anexados.', 'error');
      event.target.value = '';
    });
}

function removerOrcamento(index) {
  if (typeof index !== 'number' || index < 0 || index >= orcamentosTemporarios.length) {
    return;
  }
  orcamentosTemporarios.splice(index, 1);
  sincronizarOrcamentoLegado();
  atualizarPreviewOrcamentos();
  Utils.toast('Arquivo removido.', 'info');
}

function limparOrcamentos() {
  orcamentosTemporarios = [];
  sincronizarOrcamentoLegado();
  var inputEl = document.getElementById('input-upload-orcamento');
  if (inputEl) inputEl.value = '';
  atualizarPreviewOrcamentos();
}
