async function initLinkPage() {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    showMensagem('Link inválido.', true);
    return;
  }

  try {
    const res = await fetch('/api/consertos-token/' + encodeURIComponent(token), { credentials: 'same-origin' });
    const data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      showMensagem(data.error || 'Link inválido ou expirado.', true);
      return;
    }
    if (!data.solicitacao) {
      showMensagem('Solicitação não encontrada.', true);
      return;
    }
    renderLinkPage(data.solicitacao, { id: data.tokenId, solicitacaoId: data.solicitacaoId, rawToken: token });
  } catch (err) {
    console.error(err);
    showMensagem('Link inválido ou expirado.', true);
  }
}

function showMensagem(texto, erro) {
  document.getElementById('link-card').style.display = 'none';
  const area = document.getElementById('link-mensagem');
  if (area) {
    area.textContent = texto;
    area.style.color = erro  'var(--danger)' : 'var(--text)';
    area.style.display = '';
  }
}

function renderLinkPage(solicitacao, tokenObj) {
  document.getElementById('solicitacao-numero').textContent = solicitacao.numeroSolicitacao || '—';
  document.getElementById('material-codigo').textContent = solicitacao.codigo_material_sap || '—';
  document.getElementById('material-descricao').textContent = solicitacao.descricao_material_sap || '—';
  document.getElementById('material-valor').textContent = Utils.fmtMoeda(solicitacao.valor_material || 0);
  document.getElementById('material-quantidade').textContent = solicitacao.quantidade || '—';
  document.getElementById('fornecedor-codigo').textContent = solicitacao.fornecedor_codigo_sap || '—';
  document.getElementById('fornecedor-razao').textContent = solicitacao.fornecedor_razao_social || '—';
  document.getElementById('fornecedor-cnpj').textContent = solicitacao.fornecedor_cnpj || '—';
  document.getElementById('data-prevista-retorno').textContent = solicitacao.data_prevista_retorno || '—';
  document.getElementById('observacoes-manutencao').textContent = solicitacao.observacoes_manutencao || '—';
  if (solicitacao.fornecedor_email) {
    document.getElementById('contabilidade-email').textContent = solicitacao.fornecedor_email;
  }
  document.getElementById('form-link').addEventListener('submit', function(e) { handleUpload(e, solicitacao, tokenObj); });
}

// BUG #10: Upload com retry automático
async function uploadArquivoComRetry(file, base64, solicitacaoId, rawToken, maxTentativas) {
  maxTentativas = maxTentativas || 3;
  let tentativa = 0;
  
  while (tentativa < maxTentativas) {
    tentativa++;
    try {
      const uploadRes = await fetch('/api/consertos-anexos', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nomeOriginal: file.name, solicitacaoId, token: rawToken })
      });
      
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(function() { return {}; });
        
        // Erro 409 = duplicado, não precisa retry
        if (uploadRes.status === 409) {
          throw new Error(err.error || 'Arquivo duplicado');
        }
        
        // Outros erros tentam retry
        if (tentativa < maxTentativas) {
          const delayMs = Math.pow(2, tentativa - 1) * 1000; // 1s, 2s, 4s
          console.warn('⚠️ Falha upload ' + file.name + ' (tentativa ' + tentativa + '/' + maxTentativas + '). Aguardando ' + delayMs + 'ms...');
          Utils.toast('⚠️ Falha no upload de ' + file.name + '. Tentativa ' + tentativa + '/' + maxTentativas + '...', 'warning');
          await new Promise(function(resolve) { setTimeout(resolve, delayMs); });
          continue;
        } else {
          throw new Error('Falha ao enviar ' + file.name + ' após ' + maxTentativas + ' tentativas: ' + (err.error || 'Erro desconhecido'));
        }
      }
      
      // Sucesso!
      console.log('✅ Upload de ' + file.name + ' bem-sucedido (tentativa ' + tentativa + ')');
      return true;
      
    } catch (err) {
      if (tentativa >= maxTentativas) {
        throw err;
      }
      // Continuar para próxima tentativa
    }
  }
}

// BUG #11: Validar email usando regex RFC 5322 simples
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

async function handleUpload(event, solicitacao, tokenObj) {
  event.preventDefault();
  
  // Validar dados
  if (!solicitacao || !solicitacao.id) {
    return Utils.toast('Erro: Solicitação inválida. Recarregue a página.', 'error');
  }
  if (!tokenObj || !tokenObj.rawToken) {
    return Utils.toast('Erro: Token inválido. Recarregue a página.', 'error');
  }
  
  const files = Array.from(document.getElementById('link-arquivos').files || []);
  if (!files.length) return Utils.toast('Selecione pelo menos um arquivo PDF ou XML.', 'warning');

  // BUG #11: Capturar e validar email da contabilidade
  const emailContabilidade = (document.getElementById('email-contabilidade').value || '').trim();
  if (!emailContabilidade) {
    return Utils.toast('Por favor, informe seu email para auditoria.', 'warning');
  }
  if (!validarEmail(emailContabilidade)) {
    return Utils.toast('Email inválido. Use o formato: seu@empresa.com', 'error');
  }

  const allowed = ['application/pdf', 'text/xml', 'application/xml'];
  const observacoesContabilidade = document.getElementById('link-observacoes').value.trim();
  const btn = event.submitter || document.querySelector('#form-link button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const uploadedFiles = [];
    const failedFiles = [];
    
    // BUG #10: Fazer upload com retry automático
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (!allowed.includes(file.type) && !file.name.toLowerCase().endsWith('.xml')) {
          throw new Error('Tipo de arquivo não permitido: ' + file.name);
        }
        
        const base64 = await Utils.lerArquivoBase64(file);
        
        // Upload com retry
        await uploadArquivoComRetry(file, base64, solicitacao.id, tokenObj.rawToken, 3);
        uploadedFiles.push(file.name);
        
        Utils.toast('✅ ' + file.name + ' enviado com sucesso (' + (i + 1) + '/' + files.length + ')', 'success');
        
      } catch (err) {
        console.error('Erro ao enviar ' + file.name + ':', err);
        failedFiles.push({ nome: file.name, erro: err.message });
        Utils.toast('❌ Erro: ' + err.message, 'error');
      }
    }

    // Se algum arquivo falhou, perguntar se quer tentar novamente
    if (failedFiles.length > 0) {
      const msg = failedFiles.length === 1
         failedFiles[0].nome + ' falhou: ' + failedFiles[0].erro
        : failedFiles.length + ' arquivo(s) falharam. Tente novamente.';
      
      return Utils.toast(msg, 'error');
    }

    // Todos os arquivos enviados com sucesso
    const finalizarRes = await fetch('/api/consertos-token-usar', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        token: tokenObj.rawToken, 
        solicitacaoId: solicitacao.id, 
        observacoesContabilidade,
        emailContabilidade: emailContabilidade // BUG #11: Enviar email para servidor
      })
    });
    if (!finalizarRes.ok) {
      const finErr = await finalizarRes.json().catch(function() { return {}; });
      throw new Error(finErr.error || 'Erro ao finalizar o link.');
    }

    showMensagem('✅ ' + uploadedFiles.length + ' arquivo(s) enviado(s) com sucesso. O link foi encerrado.', false);
    document.getElementById('link-card').style.display = 'none';
  } catch (err) {
    console.error(err);
    Utils.toast(err.message || 'Erro ao enviar anexos.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
