const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYVp0UBoKy9eiPNdUePPsUZr-i2aIm9qL4NYgBwVvb8ictv3Umkdy5K4dOd73KlAFg/exec";

const SUPABASE_URL = "https://fyaikiqpayijjnewsscn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5YWlraXFwYXlpampuZXdzc2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NjAwNTQsImV4cCI6MjA5NTAzNjA1NH0.Tf_sofoEGosU7aLJM9ilZnNQg68sGF84qHwWBE4W9OQ";

const CONTADOR_BASE = 350;

async function postComRetry(url, options, tentativas = 2) {
  for (let i = 0; i < tentativas; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      // resposta 'opaque' (ex: cross-origin sem CORS) nao pode ser inspecionada — trata como sucesso
      if (res.type === 'opaque' || res.ok) return true;
    } catch (e) {
      // erro de rede/timeout — tenta de novo
    } finally {
      clearTimeout(timeoutId);
    }
    if (i < tentativas - 1) await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

function salvarLeadSupabase(dados) {
  return postComRetry(`${SUPABASE_URL}/rest/v1/diagnosticos`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(dados)
  });
}

let tipoAtual = 'iphone';
let problemasSelecionados = new Set();
let respostas = {};
let fotoArquivo = null;

function onFotoSelecionada(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Selecione um arquivo de imagem.');
    event.target.value = '';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert('A imagem deve ter até 8MB.');
    event.target.value = '';
    return;
  }
  fotoArquivo = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('fotoPreviewImg').src = e.target.result;
    document.getElementById('fotoPreviewWrap').style.display = 'block';
    document.getElementById('fotoUploadArea').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function removerFoto() {
  fotoArquivo = null;
  document.getElementById('fotoInput').value = '';
  document.getElementById('fotoPreviewWrap').style.display = 'none';
  document.getElementById('fotoUploadArea').style.display = 'flex';
}

async function uploadFotoSupabase(file) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/diagnosticos-fotos/${path}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file,
      signal: controller.signal
    });
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/diagnosticos-fotos/${path}`;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

const PROBLEMAS_IPHONE = [
  'Troca de bateria','Tela Premium','Tela Original','Não liga','Sem sinal de rede',
  'Sem Wi-Fi','iPhone molhado','Face ID não funciona','Touch ID não funciona','Não carrega',
  'Problema na câmera','Alto-falante sem som'
];

const PROBLEMAS_ANDROID = [
  'Troca de bateria','Troca de tela','Não liga','Sem sinal de rede',
  'Sem Wi-Fi','Celular molhado','Não carrega','Problema na câmera','Alto-falante sem som'
];

const PROBLEMAS_COM_TEMPO = ['Não liga','sinal','Wi-Fi','Face ID','Touch ID','molhado','carrega','câmera','Alto-falante'];

function animarContador() {
  const el = document.getElementById('contador');
  let n = CONTADOR_BASE - 20;
  const iv = setInterval(() => {
    n += 2;
    el.textContent = n;
    if (n >= CONTADOR_BASE) { el.textContent = CONTADOR_BASE; clearInterval(iv); }
  }, 40);

  // Busca contagem real do Supabase
  fetch(`${SUPABASE_URL}/rest/v1/diagnosticos?select=id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact',
      'Range': '0-0'
    }
  }).then(r => {
    const total = parseInt(r.headers.get('content-range')?.split('/')[1] || '0');
    const exibir = CONTADOR_BASE + total;
    el.textContent = exibir;
  }).catch(() => {});
}
animarContador();

function setTipo(tipo) {
  tipoAtual = tipo;
  problemasSelecionados.clear();
  respostas = {};
  document.getElementById('btn-iphone').classList.toggle('active', tipo === 'iphone');
  document.getElementById('btn-android').classList.toggle('active', tipo === 'android');
  document.getElementById('iphoneCampos').style.display = tipo === 'iphone' ? 'block' : 'none';
  document.getElementById('androidCampos').style.display = tipo === 'android' ? 'block' : 'none';
  renderProblemas(tipo === 'iphone' ? PROBLEMAS_IPHONE : PROBLEMAS_ANDROID);
  renderPerguntas();
  document.getElementById('resultado').style.display = 'none';
  document.getElementById('resultado').innerHTML = '';
  document.getElementById('tempo').value = '';
  document.getElementById('outroProblema').value = '';
  verificarTempo();
}

function renderProblemas(lista) {
  document.getElementById('problemasGrid').innerHTML = lista.map(p => `
    <div class="problem-chip" onclick="toggleProblema(this,'${p}')">
      <div class="chip-check"></div>${p}
    </div>
  `).join('');
}

function toggleProblema(el, p) {
  if (problemasSelecionados.has(p)) {
    problemasSelecionados.delete(p);
    el.classList.remove('selected');
    Object.keys(respostas).forEach(k => { if (k.startsWith(p + '||')) delete respostas[k]; });
  } else {
    problemasSelecionados.add(p);
    el.classList.add('selected');
  }
  verificarTempo();
  renderPerguntas();
}

function verificarTempo() {
  const campo = document.getElementById('campoTempo');
  const mostrar = [...problemasSelecionados].some(p => PROBLEMAS_COM_TEMPO.some(k => p.includes(k)));
  campo.classList.toggle('visible', mostrar);
}

function perguntasDoProblema(p, tipo) {
  // iPhone
  if (tipo === 'iphone') {
    if (p === 'Tela Premium') return [
      { q:'O toque ainda responde?', opts:['Sim','Não','Em partes'] },
      { q:'Como está a imagem?', opts:['Só o vidro trincou','Manchas ou listras','Tela preta'] }
    ];
    if (p === 'Tela Original') return [
      { q:'O toque ainda responde?', opts:['Sim','Não','Em partes'] },
      { q:'Como está a imagem?', opts:['Só o vidro trincou','Manchas ou listras','Tela preta'] }
    ];
    if (p.includes('Não liga')) return [
      { q:'A tela chega a dar algum sinal?', opts:['Aparece a maçã','Pisca e apaga','Nada, apagada'] },
      { q:'Esquenta ao conectar o carregador?', opts:['Sim','Não'] }
    ];
    if (p.includes('carrega')) return [
      { q:'Carrega em algum cabo?', opts:['Nenhum','Só alguns cabos','Só forçando o cabo'] },
      { q:'Aparece o raio mas a % não sobe?', opts:['Sim','Não'] }
    ];
    if (p.includes('molhado')) return [
      { q:'Há quanto tempo molhou?', opts:['Hoje','Alguns dias','Mais de uma semana'] },
      { q:'Ainda dá sinal de vida?', opts:['Liga normal','Liga com falhas','Não liga'] }
    ];
    if (p.includes('Face ID')) return [
      { q:'Teve troca de tela, queda ou molhou antes?', opts:['Sim','Não'] }
    ];
    if (p.includes('Touch ID')) return [
      { q:'O botão home funciona fisicamente?', opts:['Sim','Não'] },
      { q:'Quando parou de funcionar?', opts:['Do nada','Após queda','Após troca de tela'] }
    ];
    if (p.includes('bateria')) return [
      { q:'Saúde da bateria?', opts:['Acima de 80%','70–79%','Abaixo de 70%','Não sei'] },
      { q:'Desliga sozinho mesmo com carga?', opts:['Sim','Não'] }
    ];
    if (p.includes('sinal') || p.includes('Wi-Fi')) return [
      { q:'Começou depois de quê?', opts:['Atualização','Queda ou molhou','Do nada'] }
    ];
    if (p.includes('câmera')) return [
      { q:'Qual câmera e o que acontece?', opts:['Traseira embaçada','Frontal','App fecha / tela preta'] }
    ];
  }

  // Android
  if (tipo === 'android') {
    if (p.includes('Troca de tela')) return [
      { q:'O toque ainda responde?', opts:['Sim','Não','Em partes'] },
      { q:'Como está a imagem?', opts:['Só o vidro trincou','Manchas ou listras','Tela preta'] }
    ];
    if (p.includes('bateria')) return [
      { q:'Desliga sozinho mesmo com carga?', opts:['Sim','Não'] },
      { q:'Há quanto tempo está assim?', opts:['Alguns dias','Semanas','Mais de 1 mês'] }
    ];
    if (p.includes('Não liga')) return [
      { q:'A tela chega a dar sinal?', opts:['Acende e apaga','Vibra mas apaga','Nada'] },
      { q:'Esquenta ao carregar?', opts:['Sim','Não'] }
    ];
    if (p.includes('carrega')) return [
      { q:'Carrega em algum cabo?', opts:['Nenhum','Só alguns cabos','Só forçando'] },
      { q:'Aparece ícone de carga na tela?', opts:['Sim','Não'] }
    ];
    if (p.includes('molhado')) return [
      { q:'Há quanto tempo molhou?', opts:['Hoje','Alguns dias','Mais de uma semana'] },
      { q:'Ainda dá sinal de vida?', opts:['Liga normal','Liga com falhas','Não liga'] }
    ];
    if (p.includes('sinal') || p.includes('Wi-Fi')) return [
      { q:'Começou depois de quê?', opts:['Atualização','Queda ou molhou','Do nada'] }
    ];
    if (p.includes('câmera')) return [
      { q:'Qual câmera com problema?', opts:['Traseira embaçada','Frontal','App fecha / tela preta'] }
    ];
  }

  return [];
}

function renderPerguntas() {
  const cont = document.getElementById('perguntasContainer');
  let html = '';
  [...problemasSelecionados].forEach(prob => {
    const qs = perguntasDoProblema(prob, tipoAtual);
    if (!qs.length) return;
    html += `<div class="pergunta-bloco"><div class="pergunta-origem">${prob}</div>`;
    qs.forEach((item, qi) => {
      html += `<div class="pergunta-label">${item.q}</div><div class="pergunta-opts">`;
      item.opts.forEach(opt => {
        const active = respostas[prob + '||' + qi] === opt ? ' active' : '';
        html += `<div class="pergunta-opt${active}" onclick="selecionarResposta(this,'${prob}',${qi},'${opt}')">${opt}</div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
  });
  cont.innerHTML = html;
}

function selecionarResposta(el, prob, qi, opt) {
  respostas[prob + '||' + qi] = opt;
  el.parentElement.querySelectorAll('.pergunta-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
}

function respostasDoProblema(p) {
  const out = [];
  perguntasDoProblema(p, tipoAtual).forEach((item, qi) => {
    const ans = respostas[p + '||' + qi];
    if (ans) out.push(item.q + ' ' + ans);
  });
  return out;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

document.getElementById('telefone').addEventListener('input', function(e) {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 6) {
    v = v.length === 11
      ? `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`
      : `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
  } else if (v.length > 2) {
    v = `(${v.slice(0,2)}) ${v.slice(2)}`;
  } else if (v.length > 0) {
    v = `(${v}`;
  }
  e.target.value = v;
});

// Preços por modelo — tela: Premium | tela_original: Original
const PRECOS_IPHONE = {
  'iPhone SE (1ª geração)': { tela: 'R$ 250',   tela_original: 'R$ 450',   bateria: 'R$ 200' },
  'iPhone SE (2ª geração)': { tela: 'R$ 300',   tela_original: 'R$ 500',   bateria: 'R$ 200' },
  'iPhone SE (3ª geração)': { tela: 'R$ 300',   tela_original: 'R$ 500',   bateria: 'R$ 200' },
  'iPhone X':               { tela: 'R$ 400',   tela_original: 'R$ 700',   bateria: 'R$ 250' },
  'iPhone XR':              { tela: 'R$ 400',   tela_original: 'R$ 700',   bateria: 'R$ 250' },
  'iPhone XS':              { tela: 'R$ 400',   tela_original: 'R$ 750',   bateria: 'R$ 250' },
  'iPhone XS Max':          { tela: 'R$ 400',   tela_original: 'R$ 750',   bateria: 'R$ 250' },
  'iPhone 11':              { tela: 'R$ 450',   tela_original: 'R$ 800',   bateria: 'R$ 250' },
  'iPhone 11 Pro':          { tela: 'R$ 500',   tela_original: 'R$ 900',   bateria: 'R$ 300' },
  'iPhone 11 Pro Max':      { tela: 'R$ 500',   tela_original: 'R$ 900',   bateria: 'R$ 300' },
  'iPhone 12 mini':         { tela: 'R$ 550',   tela_original: 'R$ 950',   bateria: 'R$ 350' },
  'iPhone 12':              { tela: 'R$ 550',   tela_original: 'R$ 950',   bateria: 'R$ 350' },
  'iPhone 12 Pro':          { tela: 'R$ 550',   tela_original: 'R$ 1.000', bateria: 'R$ 350' },
  'iPhone 12 Pro Max':      { tela: 'R$ 600',   tela_original: 'R$ 1.050', bateria: 'R$ 350' },
  'iPhone 13 mini':         { tela: 'R$ 850',   tela_original: 'R$ 1.400', bateria: 'R$ 400' },
  'iPhone 13':              { tela: 'R$ 850',   tela_original: 'R$ 1.400', bateria: 'R$ 400' },
  'iPhone 13 Pro':          { tela: 'R$ 1.200', tela_original: 'R$ 2.000', bateria: 'R$ 450' },
  'iPhone 13 Pro Max':      { tela: 'R$ 1.200', tela_original: 'R$ 2.000', bateria: 'R$ 450' },
  'iPhone 14':              { tela: 'R$ 850',   tela_original: 'R$ 1.500', bateria: 'R$ 400' },
  'iPhone 14 Plus':         { tela: 'R$ 850',   tela_original: 'R$ 1.500', bateria: 'R$ 400' },
  'iPhone 14 Pro':          { tela: 'R$ 1.250', tela_original: 'R$ 2.100', bateria: 'R$ 450' },
  'iPhone 14 Pro Max':      { tela: 'R$ 1.250', tela_original: 'R$ 2.100', bateria: 'R$ 450' },
  'iPhone 15':              { tela: 'R$ 950',   tela_original: 'R$ 1.700', bateria: 'R$ 450' },
  'iPhone 15 Plus':         { tela: 'R$ 950',   tela_original: 'R$ 1.700', bateria: 'R$ 450' },
  'iPhone 15 Pro':          { tela: 'R$ 1.550', tela_original: 'R$ 2.500', bateria: 'R$ 450' },
  'iPhone 15 Pro Max':      { tela: 'R$ 1.550', tela_original: 'R$ 2.500', bateria: 'R$ 450' },
  'iPhone 16':              { tela: 'R$ 1.200', tela_original: 'R$ 2.000', bateria: 'R$ 450' },
  'iPhone 16 Plus':         { tela: 'R$ 1.200', tela_original: 'R$ 2.000', bateria: 'R$ 450' },
  'iPhone 16 Pro':          { tela: 'R$ 1.850', tela_original: 'R$ 2.800', bateria: 'R$ 450' },
  'iPhone 16 Pro Max':      { tela: 'R$ 1.850', tela_original: 'R$ 2.800', bateria: 'R$ 450' }
};

function aplicarPrecoModelo(info, p, tipo, modelo) {
  if (!info || tipo !== 'iphone' || !modelo) return info;
  const precos = PRECOS_IPHONE[modelo];
  if (!precos) return info;
  if (p === 'Tela Original' && precos.tela_original) return { ...info, v: precos.tela_original };
  if (p === 'Tela Premium'  && precos.tela)          return { ...info, v: precos.tela };
  if (p.includes('bateria') && precos.bateria)        return { ...info, v: precos.bateria };
  return info;
}

function getDiag(p, tipo) {
  if (tipo === 'android') {
    if (p.includes('bateria'))       return { d:'A bateria do aparelho pode estar desgastada, causando descarga rápida ou desligamentos inesperados. A substituição resolve o problema e melhora o desempenho.', v:'R$ 150 a R$ 300', pr:'Até 1 hora' };
    if (p.includes('Troca de tela')) return { d:'A tela está danificada ou trincada, podendo comprometer o uso do aparelho. A substituição é necessária para restaurar o funcionamento e a estética.', v:'R$ 250 a R$ 750', pr:'De 1 a 3 horas' };
    if (p.includes('Não liga'))      return { d:'O aparelho não está ligando. Pode estar relacionado à bateria, falha de carregamento ou curto-circuito na placa-mãe. É necessária análise para identificar a causa.', v:'R$ 150 a R$ 600', pr:'1 a 3 dias' };
    if (p.includes('carrega'))       return { d:'Falha no carregamento, podendo ser no conector de carga ou no circuito interno da placa-mãe. Realizamos testes para identificar e resolver o problema.', v:'R$ 90 a R$ 350', pr:'Até 1 dia' };
    if (p.includes('sinal'))         return { d:'O aparelho não está reconhecendo sinal de rede. Pode estar relacionado a configurações do sistema ou falhas na placa-mãe. É necessária análise para identificar a causa.', v:'R$ 150 a R$ 500', pr:'1 a 2 dias' };
    if (p.includes('Wi-Fi'))         return { d:'Problemas no Wi-Fi. Pode ser configuração do sistema, antenas com falhas ou defeito na placa-mãe. É necessária análise mais aprofundada.', v:'R$ 150 a R$ 350', pr:'1 a 2 dias' };
    if (p.includes('molhado'))       return { d:'O aparelho teve contato com líquido. É essencial limpeza interna imediata para evitar danos maiores. Neste caso, o tempo é determinante para a recuperação.', v:'R$ 150 a R$ 400', pr:'1 a 3 dias' };
    if (p.includes('câmera'))        return { d:'A câmera apresenta falhas, está embaçada ou inoperante. Pode precisar de substituição para voltar ao funcionamento normal.', v:'R$ 150 a R$ 350', pr:'Até 1 dia' };
    if (p.includes('Alto'))          return { d:'O aparelho está com falhas no áudio. Pode ser necessária limpeza ou troca do alto-falante.', v:'R$ 50 a R$ 200', pr:'Até 1 dia' };
  } else {
    if (p.includes('bateria'))    return { d:'A bateria do seu iPhone apresenta desgaste natural ou falha, causando descarregamento rápido ou desligamentos inesperados. A substituição resolve o problema e melhora o desempenho.', v:'R$ 250 a R$ 550', pr:'60 a 120 minutos' };
    if (p === 'Tela Premium')     return { d:'A tela do seu iPhone está danificada, trincada ou com falhas no toque. A substituição por tela Premium restaura o funcionamento e a estética do aparelho com excelente qualidade de imagem.', v:'R$ 250 a R$ 1.850', pr:'60 a 120 minutos' };
    if (p === 'Tela Original')    return { d:'A tela do seu iPhone está danificada, trincada ou com falhas no toque. A substituição por tela Original Apple garante fidelidade total às especificações de fábrica.', v:'R$ 450 a R$ 2.800', pr:'60 a 120 minutos' };
    if (p.includes('Não liga'))   return { d:'Seu iPhone não está ligando. Isso pode estar relacionado à bateria, ao sistema de carregamento ou a curto-circuito na placa-mãe. Realizamos testes para identificar a causa exata.', v:'R$ 300 a R$ 900', pr:'1 a 3 dias' };
    if (p.includes('sinal'))      return { d:'O aparelho não está reconhecendo sinal de rede. Pode estar relacionado a configurações, componentes internos ou defeito na placa-mãe. É necessária análise mais aprofundada.', v:'R$ 250 a R$ 600', pr:'1 a 2 dias' };
    if (p.includes('Wi-Fi'))      return { d:'Problemas no Wi-Fi. Pode ser configuração do sistema, antenas com falhas ou defeito na placa-mãe. É necessária análise mais aprofundada.', v:'R$ 150 a R$ 350', pr:'1 a 2 dias' };
    if (p.includes('molhado'))    return { d:'O aparelho teve contato com líquido, o que pode causar falhas progressivas ou imediatas. É essencial realizar limpeza interna e análise completa para evitar danos maiores.', v:'R$ 150 a R$ 600', pr:'1 a 3 dias' };
    if (p.includes('Face ID'))    return { d:'O Face ID não está funcionando corretamente. Pode estar relacionado a sensores ou componentes internos. Realizamos análise completa para identificar e corrigir o problema.', v:'R$ 300 a R$ 800', pr:'1 a 2 dias' };
    if (p.includes('Touch ID'))   return { d:'O Touch ID (leitor de impressão digital) não está respondendo. Pode estar relacionado ao botão home, cabo conector ou software. Realizamos diagnóstico completo para identificar a causa.', v:'R$ 150 a R$ 450', pr:'1 dia' };
    if (p.includes('carrega'))    return { d:'O iPhone apresenta falha ao carregar ou conexão instável. Pode estar relacionado ao conector de carga ou a defeito na placa-mãe. É necessária análise mais aprofundada.', v:'R$ 250 a R$ 500', pr:'1 dia' };
    if (p.includes('câmera'))     return { d:'A câmera apresenta falhas, como imagem embaçada ou sem funcionamento. Pode ser necessário substituir o componente.', v:'R$ 250 a R$ 700', pr:'1 dia' };
    if (p.includes('Alto'))       return { d:'O som do aparelho está baixo, falhando ou sem funcionar. Pode ser necessária limpeza ou substituição do alto-falante.', v:'R$ 150 a R$ 350', pr:'1 dia' };
  }
  return null;
}

function isHorarioComercial() {
  const h = new Date().getHours(), d = new Date().getDay();
  return d >= 1 && d <= 6 && h >= 9 && h < 18;
}

const REENVIO_MIN_MS = 30000;

function gerarDiagnostico() {
  if (document.getElementById('assuntoContato').value.trim()) return;

  const erroEl = document.getElementById('erro');
  const erroTextoEl = document.getElementById('erroTexto');

  const ultimoEnvio = Number(localStorage.getItem('alpha_ultimo_envio') || 0);
  if (Date.now() - ultimoEnvio < REENVIO_MIN_MS) {
    erroTextoEl.textContent = 'Aguarde alguns segundos antes de enviar outro diagnóstico.';
    erroEl.classList.add('visible');
    return;
  }

  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();

  if (!nome || telefone.replace(/\D/g,'').length < 10) {
    erroTextoEl.textContent = 'Preencha nome e WhatsApp para continuar';
    erroEl.classList.add('visible');
    if (!nome) document.getElementById('nome').classList.add('error');
    if (telefone.replace(/\D/g,'').length < 10) document.getElementById('telefone').classList.add('error');
    return;
  }

  const outro = document.getElementById('outroProblema').value.trim();
  if (problemasSelecionados.size === 0 && !outro) {
    const grid = document.getElementById('problemasGrid');
    grid.style.outline = '1.5px solid var(--red)';
    grid.style.borderRadius = '8px';
    setTimeout(() => { grid.style.outline = ''; }, 2000);
    return;
  }

  erroEl.classList.remove('visible');
  document.getElementById('nome').classList.remove('error');
  document.getElementById('telefone').classList.remove('error');

  const modeloAndroidVal = document.getElementById('modeloAndroid').value.trim();
  const modelo = tipoAtual === 'iphone'
    ? document.getElementById('modelo').value
    : (document.getElementById('marca').value + (modeloAndroidVal ? ' ' + modeloAndroidVal : ''));
  const tempo = document.getElementById('tempo').value;
  const problemasArr = [...problemasSelecionados];
  const primeiroNome = nome.split(' ')[0];

  localStorage.setItem('alpha_ultimo_envio', String(Date.now()));

  const btn = document.getElementById('btnSubmit');
  btn.classList.add('loading');
  btn.disabled = true;

  setTimeout(async () => {
    btn.classList.remove('loading');
    btn.disabled = false;

    document.getElementById('formSection').style.display = 'none';
    document.getElementById('confirmOverlay').classList.add('visible');

    const fotoUrl = fotoArquivo ? await uploadFotoSupabase(fotoArquivo) : null;

    const diagnosticos = problemasArr
      .map(p => ({ p, info: aplicarPrecoModelo(getDiag(p, tipoAtual), p, tipoAtual, modelo), det: respostasDoProblema(p) }))
      .filter(x => x.info);

    const linhasResumo = diagnosticos.map(({ p, det }) => p + (det.length ? ' — ' + det.join('; ') : ''));
    if (outro) linhasResumo.push('Outro defeito relatado: ' + outro);
    const resumoTexto = linhasResumo.join(' | ');

    const problemasLista = [...problemasArr];
    if (outro) problemasLista.push('Outro defeito');
    const problemasField = problemasLista.join(', ');

    const [, supabaseOk] = await Promise.all([
      postComRetry(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ nome, telefone, modelo, problema: problemasField, diagnostico: resumoTexto, foto: fotoUrl || '' })
      }),
      salvarLeadSupabase({
        nome, telefone, tipo: tipoAtual, modelo,
        problemas: problemasField, diagnostico: resumoTexto, foto_url: fotoUrl
      })
    ]);
    const sendOk = supabaseOk;

    setTimeout(() => {
      document.getElementById('confirmOverlay').classList.remove('visible');
      document.getElementById('confirmOverlay').style.display = 'none';

      let msgItens = diagnosticos.map(({ p, info, det }, i) => {
        let bloco = `*${i+1}. ${p}*\n${info.d}\nValor: ${info.v} | Prazo: ${info.pr}`;
        if (det.length) bloco += `\nDetalhes: ${det.join('; ')}`;
        return bloco;
      }).join('\n\n');
      if (outro) msgItens += (msgItens ? '\n\n' : '') + `*Outro defeito:*\n${outro}`;

      const mensagem = `Olá! Fiz um diagnóstico no Alpha System:\n\nNome: ${nome}\nWhatsApp: ${telefone}\nAparelho: ${modelo}${tempo ? '\nHá quanto tempo: ' + tempo : ''}\n\n${msgItens}${fotoUrl ? '\n\nFoto do defeito: ' + fotoUrl : ''}`;
      const link = `https://wa.me/5555991269300?text=${encodeURIComponent(mensagem)}`;

      const horario = isHorarioComercial()
        ? 'Estamos em horário de atendimento — resposta em até 30 minutos.'
        : 'Fora do horário comercial. Atendemos seg–sáb, das 9h às 18h.';

      let itensHTML = diagnosticos.map(({ p, info, det }) => `
            <div class="problema-bloco">
              <div class="result-label">${p}</div>
              <div class="result-value">${info.d}</div>
              ${det.length ? `<div class="result-value" style="font-size:12px;color:var(--text-muted)">${det.join(' · ')}</div>` : ''}
              <div class="result-row">
                <div class="result-chip">
                  <div class="result-label">Valor estimado</div>
                  <div class="result-value">${info.v}</div>
                </div>
                <div class="result-chip">
                  <div class="result-label">Prazo</div>
                  <div class="result-value">${info.pr}</div>
                </div>
              </div>
            </div>
          `).join('');
      if (outro) itensHTML += `
            <div class="problema-bloco">
              <div class="result-label">Outro defeito relatado</div>
              <div class="result-value">${esc(outro)}</div>
              <div class="result-value" style="font-size:12px;color:var(--text-muted)">Vamos analisar e te passar o orçamento certo no WhatsApp.</div>
            </div>`;
      if (fotoUrl) itensHTML += `
            <div class="problema-bloco">
              <div class="result-label">Foto enviada</div>
              <img src="${fotoUrl}" alt="Foto do defeito" style="max-width:100%;border-radius:var(--radius-sm);border:1px solid var(--border);margin-top:4px;display:block;">
            </div>`;
      if (!itensHTML) itensHTML = '<div class="result-value">Entre em contato para mais detalhes.</div>';

      const resultado = document.getElementById('resultado');
      resultado.style.display = 'block';
      resultado.innerHTML = `
        <div class="send-status ${sendOk !== false ? 'ok' : 'fail'} visible">
          <svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 6.5l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L7 8.94l3.47-3.47a.75.75 0 011.06 1.06z"/></svg>
          ${sendOk !== false ? 'Dados registrados com sucesso' : 'Diagnóstico gerado — dados serão enviados ao abrir o WhatsApp'}
        </div>
        <div class="result-greeting">Olá, <span>${esc(primeiroNome)}</span>! Aqui está seu diagnóstico:</div>
        ${itensHTML}
        <div class="horario-badge">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5 5v5.25l4.5 2.67-.75 1.23L11 13V7h1.5z"/></svg>
          ${horario}
        </div>
        <div class="local-badge">
          <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          Esquina dos Correios — Itaqui/RS · Seg–Sáb, 9h às 18h
        </div>
        <a class="btn-whatsapp" href="${link}" target="_blank">
          <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Falar no WhatsApp
        </a>
        <button class="btn-reset" onclick="resetar()">Fazer novo diagnóstico</button>
      `;

      resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1800);
  }, 900);
}

function resetar() {
  problemasSelecionados.clear();
  respostas = {};
  document.getElementById('resultado').style.display = 'none';
  document.getElementById('resultado').innerHTML = '';
  document.getElementById('confirmOverlay').style.display = '';
  document.getElementById('confirmOverlay').classList.remove('visible');
  document.getElementById('formSection').style.display = '';
  document.getElementById('nome').value = '';
  document.getElementById('telefone').value = '';
  document.getElementById('tempo').value = '';
  document.getElementById('outroProblema').value = '';
  document.getElementById('modeloAndroid').value = '';
  document.getElementById('erro').classList.remove('visible');
  removerFoto();
  renderProblemas(tipoAtual === 'iphone' ? PROBLEMAS_IPHONE : PROBLEMAS_ANDROID);
  renderPerguntas();
  verificarTempo();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('nome').addEventListener('input', function() {
  this.classList.remove('error');
  document.getElementById('erro').classList.remove('visible');
});
document.getElementById('telefone').addEventListener('input', function() {
  this.classList.remove('error');
  document.getElementById('erro').classList.remove('visible');
});

renderProblemas(PROBLEMAS_IPHONE);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
