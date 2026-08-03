/* =========================================================================
   Sistema de Boletins CBMMG — módulo BGBM (front-end)
   Estado em memória sincronizado com a API FastAPI. Renderiza o documento
   idêntico ao layout oficial; "Baixar PDF" usa window.print() + @media print.
   ========================================================================= */

const API = "/api";
let META = null;                 // partes, ordem de unidades, assets base64
let ATUAL = null;                // BGBM em edição (objeto completo)
let MAT_CTX = null;              // contexto do editor de matéria { parteId, unidade, index|null }
let salvarTimer = null;

/* --------------------------------------------------- utilitários */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => (s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._to); t._to = setTimeout(() => t.classList.remove("show"), 2200);
}
function abrirModal(id) { $("#" + id).classList.remove("hidden"); }
function fecharModal(id) { $("#" + id).classList.add("hidden"); }

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" }, ...opts,
  });
  if (res.status === 204) return null;
  if (!res.ok) { const e = await res.text(); throw new Error(e || res.status); }
  return res.json();
}

/* --------------------------------------------------- boot */
(async function init() {
  META = await api("/meta");
  if (META.assets.brasao) $("#brand-logo").src = META.assets.brasao;
  montarTopbarLista();
  await carregarLista();
})();

/* =========================================================================
   VIEW: LISTA DE BGBMs
   ========================================================================= */
function montarTopbarLista() {
  $("#topbar-acoes").innerHTML =
    `<button class="btn primary" id="btn-novo">+ Novo BGBM</button>`;
  $("#btn-novo").onclick = () => {
    $("#n-numero").value = ""; $("#n-data").value = ""; $("#n-pagina").value = 1;
    abrirModal("modal-novo");
  };
}

async function carregarLista() {
  mostrarView("lista");
  const itens = await api("/bgbm");
  const box = $("#lista-cards");
  if (!itens.length) {
    box.className = "vazio";
    box.innerHTML = "Nenhum BGBM cadastrado. Clique em <b>+ Novo BGBM</b> para começar.";
    return;
  }
  box.className = "grid-cards";
  box.innerHTML = itens.map(it => `
    <div class="card">
      <h3>BGBM Nº ${esc(it.numero)}</h3>
      <div class="meta">${esc(it.data_publicacao)}</div>
      <div class="meta">Página inicial: ${it.pagina_inicial}</div>
      <div class="acoes">
        <button class="btn small primary" onclick="abrirEditor(${it.id})">Editar</button>
        <button class="btn small danger" onclick="excluirBGBM(${it.id})">Excluir</button>
      </div>
    </div>`).join("");
}

$("#n-criar").onclick = async () => {
  const numero = $("#n-numero").value.trim();
  const data = $("#n-data").value.trim();
  if (!numero || !data) { toast("Informe número e data."); return; }
  const novo = await api("/bgbm", {
    method: "POST",
    body: JSON.stringify({
      numero, data_publicacao: data,
      pagina_inicial: parseInt($("#n-pagina").value) || 1,
    }),
  });
  fecharModal("modal-novo");
  abrirEditor(novo.id);
};

async function excluirBGBM(id) {
  if (!confirm("Excluir este BGBM? Esta ação não pode ser desfeita.")) return;
  await api("/bgbm/" + id, { method: "DELETE" });
  toast("BGBM excluído.");
  carregarLista();
}

/* =========================================================================
   VIEW: EDITOR
   ========================================================================= */
function mostrarView(v) {
  $("#view-lista").classList.toggle("hidden", v !== "lista");
  $("#view-editor").classList.toggle("hidden", v !== "editor");
}

async function abrirEditor(id) {
  ATUAL = await api("/bgbm/" + id);
  mostrarView("editor");
  $("#topbar-titulo").textContent = `Editando BGBM Nº ${ATUAL.numero}`;
  $("#topbar-acoes").innerHTML = `
    <button class="btn" onclick="voltarLista()">← Voltar</button>
    <button class="btn primary" onclick="baixarPDF()">⬇ Baixar BGBM (PDF)</button>`;
  // preencher campos de cabeçalho
  $("#f-numero").value = ATUAL.numero;
  $("#f-data").value = ATUAL.data_publicacao;
  $("#f-pagina").value = ATUAL.pagina_inicial;
  $("#f-bol-pg").value = ATUAL.boletinista_pg || "";
  $("#f-bol-nome").value = ATUAL.boletinista_nome || "";
  ["f-numero", "f-data", "f-pagina", "f-bol-pg", "f-bol-nome"].forEach(fid => {
    $("#" + fid).oninput = onCampoCabecalho;
  });
  renderSeparatas();
  renderArvore();
  renderDocumento();
}

function voltarLista() { ATUAL = null; carregarLista(); montarTopbarLista(); }

/* ------------- salvamento (debounce) ------------- */
function agendarSalvar() {
  clearTimeout(salvarTimer);
  salvarTimer = setTimeout(salvarAtual, 600);
}
async function salvarAtual() {
  if (!ATUAL) return;
  await api("/bgbm/" + ATUAL.id, {
    method: "PUT",
    body: JSON.stringify({
      numero: ATUAL.numero,
      data_publicacao: ATUAL.data_publicacao,
      pagina_inicial: ATUAL.pagina_inicial,
      boletinista_pg: ATUAL.boletinista_pg,
      boletinista_nome: ATUAL.boletinista_nome,
      conteudo: ATUAL.conteudo,
    }),
  });
}

function onCampoCabecalho() {
  ATUAL.numero = $("#f-numero").value;
  ATUAL.data_publicacao = $("#f-data").value;
  ATUAL.pagina_inicial = parseInt($("#f-pagina").value) || 1;
  ATUAL.boletinista_pg = $("#f-bol-pg").value;
  ATUAL.boletinista_nome = $("#f-bol-nome").value;
  $("#topbar-titulo").textContent = `Editando BGBM Nº ${ATUAL.numero}`;
  renderDocumento();
  agendarSalvar();
}

/* =========================================================================
   SEPARATAS
   ========================================================================= */
$("#add-separata").onclick = () => {
  ATUAL.conteudo.separatas.push({ titulo: "", corpo: "" });
  renderSeparatas(); renderDocumento(); agendarSalvar();
};

function renderSeparatas() {
  const box = $("#lista-separatas");
  box.innerHTML = ATUAL.conteudo.separatas.map((s, i) => `
    <div class="campo" style="border:1px solid var(--borda);padding:8px;border-radius:6px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <label>Bloco ${i + 1}</label>
        <button class="mini" onclick="rmSeparata(${i})" title="Remover">✕</button>
      </div>
      <input placeholder="Título (obrigatório)" value="${esc(s.titulo)}"
             oninput="setSeparata(${i},'titulo',this.value)">
      <textarea placeholder="Corpo (opcional)" rows="2" style="margin-top:6px"
             oninput="setSeparata(${i},'corpo',this.value)">${esc(s.corpo)}</textarea>
    </div>`).join("");
}
function setSeparata(i, campo, val) {
  ATUAL.conteudo.separatas[i][campo] = val; renderDocumento(); agendarSalvar();
}
function rmSeparata(i) {
  ATUAL.conteudo.separatas.splice(i, 1);
  renderSeparatas(); renderDocumento(); agendarSalvar();
}

/* =========================================================================
   ÁRVORE: PARTES → UNIDADES → MATÉRIAS
   ========================================================================= */
function renderArvore() {
  const box = $("#arvore");
  box.innerHTML = META.partes.map(p => {
    const parte = ATUAL.conteudo.partes[p.id];
    const unidadesHtml = parte.unidades.map(u => `
      <div class="unidade">
        <div class="cab">
          <span>${esc(u.nome)}</span>
          <span>
            <button class="mini" title="Nova matéria"
              onclick="novaMateria('${p.id}','${esc(u.nome)}')">＋</button>
            <button class="mini" title="Remover unidade"
              onclick="rmUnidade('${p.id}','${esc(u.nome)}')">✕</button>
          </span>
        </div>
        ${u.materias.map((m, mi) => `
          <div class="materia" onclick="editarMateria('${p.id}','${esc(u.nome)}',${mi})">
            <span class="t">${esc(m.titulo || "(sem título)")}</span>
            <button class="mini" title="Remover"
              onclick="event.stopPropagation();rmMateria('${p.id}','${esc(u.nome)}',${mi})">✕</button>
          </div>`).join("")}
      </div>`).join("");
    return `
      <div class="parte">
        <div class="cab">
          <span>${p.titulo} — ${p.subtitulo}</span>
          <button class="mini" title="Adicionar unidade"
            onclick="abrirAddUnidade('${p.id}')">＋ un.</button>
        </div>
        ${unidadesHtml || '<div class="hint" style="margin-left:6px">Sem unidades → “SEM ALTERAÇÃO”.</div>'}
      </div>`;
  }).join("");
}

/* -------- adicionar unidade -------- */
let ADD_UN_PARTE = null;
function abrirAddUnidade(parteId) {
  ADD_UN_PARTE = parteId;
  const usadas = new Set(ATUAL.conteudo.partes[parteId].unidades.map(u => u.nome));
  const opts = META.ordem_unidades.filter(n => !usadas.has(n));
  $("#u-select").innerHTML =
    opts.map(n => `<option>${esc(n)}</option>`).join("") +
    `<option value="__custom__">Outra (digitar)…</option>`;
  abrirModal("modal-unidade");
}
$("#u-add").onclick = () => {
  let nome = $("#u-select").value;
  if (nome === "__custom__") {
    nome = (prompt("Nome da unidade:") || "").trim();
    if (!nome) return;
  }
  const parte = ATUAL.conteudo.partes[ADD_UN_PARTE];
  if (parte.unidades.some(u => u.nome === nome)) { toast("Unidade já existe nesta parte."); return; }
  parte.unidades.push({ nome, materias: [] });
  ordenarUnidadesLocal(parte);
  fecharModal("modal-unidade");
  renderArvore(); renderDocumento(); agendarSalvar();
};

/* ordena as unidades de uma parte pela ordem institucional (índice em META) */
function ordenarUnidadesLocal(parte) {
  const idx = n => {
    const i = META.ordem_unidades.indexOf(n);
    return i === -1 ? META.ordem_unidades.length + 1 : i;
  };
  parte.unidades.sort((a, b) => {
    const ia = idx(a.nome), ib = idx(b.nome);
    if (ia !== ib) return ia - ib;
    return a.nome.localeCompare(b.nome);
  });
}

function rmUnidade(parteId, nome) {
  if (!confirm(`Remover a unidade "${nome}" e suas matérias?`)) return;
  const parte = ATUAL.conteudo.partes[parteId];
  parte.unidades = parte.unidades.filter(u => u.nome !== nome);
  renderArvore(); renderDocumento(); agendarSalvar();
}

/* =========================================================================
   MATÉRIAS — editor rich-text
   ========================================================================= */
function unidadeRef(parteId, nome) {
  return ATUAL.conteudo.partes[parteId].unidades.find(u => u.nome === nome);
}

function novaMateria(parteId, nome) {
  MAT_CTX = { parteId, nome, index: null };
  preencherEditorMateria({
    titulo: "", subtitulo: "", corpo: "", local_data: "",
    assinatura: { nome: "", pg: "", funcao: "" },
  });
  $("#mm-titulo").textContent = "Nova matéria — " + nome;
  abrirModal("modal-materia");
}

function editarMateria(parteId, nome, index) {
  MAT_CTX = { parteId, nome, index };
  const m = unidadeRef(parteId, nome).materias[index];
  preencherEditorMateria(m);
  $("#mm-titulo").textContent = "Editar matéria — " + nome;
  abrirModal("modal-materia");
}

function preencherEditorMateria(m) {
  $("#mm-t").value = m.titulo || "";
  $("#mm-s").value = m.subtitulo || "";
  $("#mm-corpo").innerHTML = m.corpo || "";
  $("#mm-ld").value = m.local_data || "";
  $("#mm-a-nome").value = m.assinatura?.nome || "";
  $("#mm-a-pg").value = m.assinatura?.pg || "";
  $("#mm-a-funcao").value = m.assinatura?.funcao || "";
  $("#mm-tbl-toolbar").classList.add("hidden");
}

/* toolbar do editor rich-text */
$("#mm-toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  e.preventDefault();
  const cmd = btn.dataset.cmd;
  const rich = $("#mm-corpo"); rich.focus();
  if (cmd === "uppercase") {
    const sel = window.getSelection();
    if (sel && sel.toString()) {
      document.execCommand("insertText", false, sel.toString().toUpperCase());
    }
  } else if (cmd === "inserttable") {
    inserirTabela();
  } else {
    document.execCommand(cmd, false, null);
  }
});

/* ------------------------------------------------------------------
   EDIÇÃO DE TABELA (inserir/excluir linhas e colunas, cabeçalho)
   ------------------------------------------------------------------ */
const richEl = () => $("#mm-corpo");

/* célula (td/th) que contém o cursor atualmente */
function celulaAtual() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.anchorNode;
  while (n && n !== richEl()) {
    if (n.nodeType === 1 && (n.tagName === "TD" || n.tagName === "TH")) return n;
    n = n.parentNode;
  }
  return null;
}
function tabelaDa(cel) { return cel ? cel.closest("table") : null; }
function indiceColuna(cel) {
  const tr = cel.parentNode;
  return [...tr.children].indexOf(cel);
}

/* mostra/oculta a barra de tabela conforme o cursor */
function atualizarBarraTabela() {
  const bar = $("#mm-tbl-toolbar");
  richEl().querySelectorAll(".sel-cell").forEach(c => c.classList.remove("sel-cell"));
  const cel = celulaAtual();
  if (cel) { cel.classList.add("sel-cell"); bar.classList.remove("hidden"); }
  else bar.classList.add("hidden");
}

/* cria uma célula nova do mesmo tipo (td/th) de referência */
function novaCelula(tag) {
  const c = document.createElement(tag);
  c.innerHTML = "&nbsp;";
  return c;
}

function opTabela(op) {
  const cel = celulaAtual();
  if (!cel) return;
  const tabela = tabelaDa(cel);
  const tr = cel.parentNode;
  const colIdx = indiceColuna(cel);
  const todasLinhas = () => [...tabela.querySelectorAll("tr")];

  switch (op) {
    case "row-above":
    case "row-below": {
      const nova = document.createElement("tr");
      [...tr.children].forEach(c => nova.appendChild(novaCelula(c.tagName.toLowerCase() === "th" ? "td" : "td")));
      tr.parentNode.insertBefore(nova, op === "row-above" ? tr : tr.nextSibling);
      break;
    }
    case "row-del": {
      if (todasLinhas().length > 1) tr.remove();
      break;
    }
    case "col-left":
    case "col-right": {
      todasLinhas().forEach(linha => {
        const ref = linha.children[colIdx];
        const tag = ref ? ref.tagName.toLowerCase() : "td";
        const nova = novaCelula(tag);
        if (op === "col-left") linha.insertBefore(nova, ref || null);
        else linha.insertBefore(nova, ref ? ref.nextSibling : null);
      });
      break;
    }
    case "col-del": {
      const nCols = tr.children.length;
      if (nCols > 1) todasLinhas().forEach(linha => {
        if (linha.children[colIdx]) linha.children[colIdx].remove();
      });
      break;
    }
    case "head-toggle": {
      // alterna td <-> th mantendo conteúdo (cabeçalho cinza)
      const novoTag = cel.tagName === "TH" ? "td" : "th";
      const novo = document.createElement(novoTag);
      novo.innerHTML = cel.innerHTML;
      cel.replaceWith(novo);
      break;
    }
    case "tbl-del": {
      if (confirm("Excluir a tabela inteira?")) tabela.remove();
      break;
    }
  }
  richEl().focus();
  atualizarBarraTabela();
}

$("#mm-tbl-toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  e.preventDefault();
  opTabela(btn.dataset.tbl);
});

/* atualiza a barra ao clicar/mover cursor dentro do editor */
["keyup", "mouseup", "focus"].forEach(ev =>
  richEl().addEventListener(ev, atualizarBarraTabela));

/* ------------------------------------------------------------------
   COLAGEM DE TABELA DO SEI (e de outras fontes) já formatada
   O SEI cola HTML com estilos inline, larguras fixas, fontes e cores
   próprias. Aqui limpamos tudo e reconstruímos a tabela no padrão do
   BGBM (bordas pretas, cabeçalho cinza, largura 100%).
   ------------------------------------------------------------------ */
richEl().addEventListener("paste", (e) => {
  const html = e.clipboardData?.getData("text/html");
  if (!html || !/<table/i.test(html)) return;   // sem tabela: deixa o padrão
  e.preventDefault();
  const limpo = sanitizarHTMLColado(html);
  document.execCommand("insertHTML", false, limpo);
  setTimeout(atualizarBarraTabela, 0);
});

function sanitizarHTMLColado(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // processa cada tabela colada
  doc.querySelectorAll("table").forEach(tabelaOriginal => {
    const nova = reconstruirTabela(tabelaOriginal);
    tabelaOriginal.replaceWith(nova);
  });
  // remove atributos de estilo residuais de parágrafos/spans
  doc.body.querySelectorAll("[style]").forEach(el => el.removeAttribute("style"));
  doc.body.querySelectorAll("[class]").forEach(el => {
    if (el.tagName !== "TABLE") el.removeAttribute("class");
  });
  // remove tags de layout inúteis do SEI/Word (o:p, meta, etc.)
  doc.body.querySelectorAll("meta,style,o\\:p,font").forEach(el => {
    if (el.tagName === "FONT") el.replaceWith(...el.childNodes);
    else el.remove();
  });
  return doc.body.innerHTML;
}

/* reconstrói uma tabela colada no padrão do BGBM */
function reconstruirTabela(orig) {
  const linhas = [...orig.querySelectorAll("tr")];
  const t = document.createElement("table");
  t.className = "tbl-editavel";
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  linhas.forEach((tr, i) => {
    const novaTr = document.createElement("tr");
    [...tr.children].forEach(cel => {
      // primeira linha vira cabeçalho (th) se as células originais forem th
      // ou se for a linha 0 — heurística comum de tabelas do SEI
      const ehCabecalho = i === 0 &&
        (cel.tagName === "TH" || [...tr.children].every(c => c.textContent.trim()));
      const nova = document.createElement(ehCabecalho ? "th" : "td");
      // preserva colspan/rowspan (mesclagens vindas do SEI)
      if (cel.hasAttribute("colspan")) nova.setAttribute("colspan", cel.getAttribute("colspan"));
      if (cel.hasAttribute("rowspan")) nova.setAttribute("rowspan", cel.getAttribute("rowspan"));
      // preserva só o texto/negrito, descarta estilos inline
      nova.innerHTML = limparConteudoCelula(cel);
      novaTr.appendChild(nova);
    });
    (i === 0 && novaTr.querySelector("th") ? thead : tbody).appendChild(novaTr);
  });

  if (thead.children.length) t.appendChild(thead);
  t.appendChild(tbody);
  return t;
}

/* mantém texto e ênfases básicas (negrito/itálico), remove o resto */
function limparConteudoCelula(cel) {
  const clone = cel.cloneNode(true);
  clone.querySelectorAll("*").forEach(el => {
    el.removeAttribute("style");
    el.removeAttribute("class");
    el.removeAttribute("width");
    el.removeAttribute("align");
    // desembrulha tags que não sejam ênfase simples
    if (!["B", "STRONG", "I", "EM", "U", "BR", "SUP", "SUB"].includes(el.tagName)) {
      el.replaceWith(...el.childNodes);
    }
  });
  const txt = clone.innerHTML.replace(/\s+/g, " ").trim();
  return txt || "&nbsp;";
}

function inserirTabela() {
  const cols = parseInt(prompt("Número de colunas:", "3")) || 3;
  const rows = parseInt(prompt("Número de linhas (incl. cabeçalho):", "3")) || 3;
  let html = '<table class="tbl-editavel"><thead><tr>';
  for (let c = 0; c < cols; c++) html += "<th>Título</th>";
  html += "</tr></thead><tbody>";
  for (let r = 1; r < rows; r++) {
    html += "<tr>";
    for (let c = 0; c < cols; c++) html += "<td>&nbsp;</td>";
    html += "</tr>";
  }
  html += "</tbody></table><p><br></p>";
  document.execCommand("insertHTML", false, html);
}

$("#mm-salvar").onclick = () => {
  const titulo = $("#mm-t").value.trim();
  if (!titulo) { toast("O título da matéria é obrigatório."); return; }
  const materia = {
    titulo,
    subtitulo: $("#mm-s").value.trim(),
    corpo: $("#mm-corpo").innerHTML,
    local_data: $("#mm-ld").value.trim(),
    assinatura: {
      nome: $("#mm-a-nome").value.trim(),
      pg: $("#mm-a-pg").value.trim(),
      funcao: $("#mm-a-funcao").value.trim(),
    },
  };
  const un = unidadeRef(MAT_CTX.parteId, MAT_CTX.nome);
  if (MAT_CTX.index === null) un.materias.push(materia);
  else un.materias[MAT_CTX.index] = materia;
  fecharModal("modal-materia");
  renderArvore(); renderDocumento(); agendarSalvar();
  toast("Matéria salva.");
};

function rmMateria(parteId, nome, index) {
  if (!confirm("Remover esta matéria?")) return;
  unidadeRef(parteId, nome).materias.splice(index, 1);
  renderArvore(); renderDocumento(); agendarSalvar();
}

/* =========================================================================
   RENDERIZAÇÃO DO DOCUMENTO (prévia = o que será impresso no PDF)
   ========================================================================= */
/* cabeçalho institucional único (prévia mostra page-num estático;
   na impressão o CSS ::after injeta o contador de página) */
function cabecalhoImpressaoHTML() {
  const a = META.assets;
  return `
  <div class="cabecalho">
    <div class="c-brasao">${a.brasao ? `<img src="${a.brasao}">` : "CBMMG"}</div>
    <div class="c-titulo"><b>BGBM Nº ${esc(ATUAL.numero)}<br>${esc(ATUAL.data_publicacao)}</b></div>
    <div class="c-pag"><span>Página</span><span class="n page-num"></span></div>
    <div class="c-visto">${a.visto_ajudante ? `<img src="${a.visto_ajudante}">` : ""}VISTO DO AJUDANTE-GERAL</div>
  </div>`;
}

function separatasHTML() {
  const seps = ATUAL.conteudo.separatas.filter(s => s.titulo.trim());
  if (!seps.length) return "";
  const itens = seps.map(s => `
    <div class="separata-item">
      <div class="t">${esc(s.titulo)}</div>
      ${s.corpo.trim() ? `<div class="b">${esc(s.corpo)}</div>` : ""}
    </div>`).join("");
  return `<div class="separata-box">
      <div class="cab">ESTÁ SENDO PUBLICADO EM SEPARATA DESTE BGBM:</div>${itens}
    </div>`;
}

function materiaHTML(m) {
  const a = m.assinatura || {};
  const assinatura = (a.nome || a.pg || a.funcao) ? `
    <div class="m-assinatura">(a) ${esc(a.nome)}${a.pg ? ", " + esc(a.pg) : ""}
      ${a.funcao ? "<br>" + esc(a.funcao) : ""}</div>` : "";
  return `
    <div class="materia-doc">
      <div class="m-titulo">${esc(m.titulo)}</div>
      ${m.subtitulo ? `<div class="m-subtitulo">${esc(m.subtitulo)}</div>` : ""}
      <div class="m-corpo">${m.corpo || ""}</div>
      ${m.local_data ? `<div class="m-localdata">${esc(m.local_data)}</div>` : ""}
      ${assinatura}
    </div>`;
}

function parteHTML(p) {
  const parte = ATUAL.conteudo.partes[p.id];
  const faixa = `<div class="faixa-parte">${p.titulo}<br>${p.subtitulo}</div>`;
  const temMateria = parte.unidades.some(u => u.materias.length);
  if (!temMateria) return faixa + `<div class="sem-alteracao">${META.sem_alteracao}</div>`;
  const corpo = parte.unidades
    .filter(u => u.materias.length)
    .map(u => `<div class="unidade-faixa">- ${esc(u.nome)} -</div>` +
      u.materias.map(materiaHTML).join(""))
    .join("");
  return faixa + corpo;
}

function fechamentoHTML() {
  const a = META.assets;
  const bol = (ATUAL.boletinista_pg || ATUAL.boletinista_nome)
    ? `<div class="boletinista">${esc(ATUAL.boletinista_pg)} ${esc(ATUAL.boletinista_nome)}<br><b>Boletinista</b></div>`
    : "";
  return `
    <div class="fechamento">
      ${a.assinatura_chefe_em ? `<img src="${a.assinatura_chefe_em}">` : ""}
      <div style="margin:6px 0">Confere com o Original,</div>
      ${a.assinatura_ajudante ? `<img src="${a.assinatura_ajudante}">` : ""}
      ${bol}
    </div>`;
}

function renderDocumento() {
  const doc = $("#documento");
  const corpo =
    separatasHTML() +
    META.partes.map(parteHTML).join("") +
    fechamentoHTML();
  // O documento é uma tabela: thead (cabeçalho institucional, repete por
  // página na impressão) + tbody (todo o conteúdo).
  doc.innerHTML = `
    <table id="doc-print-table">
      <thead><tr><td>${cabecalhoImpressaoHTML()}</td></tr></thead>
      <tbody><tr><td>${corpo}</td></tr></tbody>
      <tfoot><tr><td><div style="height:12mm"></div></td></tr></tfoot>
    </table>`;
  atualizarNumeroPagina();
}

/* na prévia (tela) mostramos a página inicial estática;
   na impressão o contador CSS parte de --pag-base = (inicial - 1) */
function atualizarNumeroPagina() {
  const inicial = parseInt(ATUAL.pagina_inicial) || 1;
  $$("#documento .page-num").forEach(el => el.textContent = inicial);
  document.body.style.setProperty("--pag-base", inicial - 1);
}

/* =========================================================================
   EXPORTAR PDF (print-to-PDF do navegador)
   ========================================================================= */
async function baixarPDF() {
  await salvarAtual();               // garante persistência antes de imprimir
  toast("Abrindo diálogo de impressão — escolha “Salvar como PDF”.");
  setTimeout(() => window.print(), 400);
}

/* expõe funções usadas em atributos onclick inline */
Object.assign(window, {
  abrirEditor, excluirBGBM, voltarLista, baixarPDF,
  abrirAddUnidade, rmUnidade, novaMateria, editarMateria, rmMateria,
  setSeparata, rmSeparata, fecharModal,
});
