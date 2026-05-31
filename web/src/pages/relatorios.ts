import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "../assets/logo.png";

const REGIOES = [
  { valor: "", nome: "Todas as regiões" },
  { valor: "Norte", nome: "Norte" },
  { valor: "Nordeste", nome: "Nordeste" },
  { valor: "Centro-Oeste", nome: "Centro-Oeste" },
  { valor: "Sudeste", nome: "Sudeste" },
  { valor: "Sul", nome: "Sul" },
];

const TODOS_ESTADOS = [
  { uf: "AC", nome: "Acre", regiao: "Norte" },
  { uf: "AL", nome: "Alagoas", regiao: "Nordeste" },
  { uf: "AP", nome: "Amapá", regiao: "Norte" },
  { uf: "AM", nome: "Amazonas", regiao: "Norte" },
  { uf: "BA", nome: "Bahia", regiao: "Nordeste" },
  { uf: "CE", nome: "Ceará", regiao: "Nordeste" },
  { uf: "DF", nome: "Distrito Federal", regiao: "Centro-Oeste" },
  { uf: "ES", nome: "Espírito Santo", regiao: "Sudeste" },
  { uf: "GO", nome: "Goiás", regiao: "Centro-Oeste" },
  { uf: "MA", nome: "Maranhão", regiao: "Nordeste" },
  { uf: "MT", nome: "Mato Grosso", regiao: "Centro-Oeste" },
  { uf: "MS", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste" },
  { uf: "MG", nome: "Minas Gerais", regiao: "Sudeste" },
  { uf: "PA", nome: "Pará", regiao: "Norte" },
  { uf: "PB", nome: "Paraíba", regiao: "Nordeste" },
  { uf: "PR", nome: "Paraná", regiao: "Sul" },
  { uf: "PE", nome: "Pernambuco", regiao: "Nordeste" },
  { uf: "PI", nome: "Piauí", regiao: "Nordeste" },
  { uf: "RJ", nome: "Rio de Janeiro", regiao: "Sudeste" },
  { uf: "RN", nome: "Rio Grande do Norte", regiao: "Nordeste" },
  { uf: "RS", nome: "Rio Grande do Sul", regiao: "Sul" },
  { uf: "RO", nome: "Rondônia", regiao: "Norte" },
  { uf: "RR", nome: "Roraima", regiao: "Norte" },
  { uf: "SC", nome: "Santa Catarina", regiao: "Sul" },
  { uf: "SP", nome: "São Paulo", regiao: "Sudeste" },
  { uf: "SE", nome: "Sergipe", regiao: "Nordeste" },
  { uf: "TO", nome: "Tocantins", regiao: "Norte" },
];

const MESES_NOMES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const INDICADORES_CONFIG = [
  { chave: "saldo",         label: "Saldo de Crédito",      unidade: "R$ milhões", descricao: "Volume total de crédito concedido" },
  { chave: "inadimplencia", label: "Inadimplência",          unidade: "%",          descricao: "Taxa de inadimplência no período" },
  { chave: "variacao",      label: "Variação do Saldo",      unidade: "R$ milhões", descricao: "Variação no saldo de crédito" },
  { chave: "score",         label: "Score de Oportunidade",  unidade: "0–100",      descricao: "Score calculado de oportunidade de crédito" },
];

let formatoSelecionado: "pdf" | "excel" = "pdf";

// ─── Render HTML ──────────────────────────────────────────────────────────────

function renderRelatorio(): string {
  const regioesOptions = REGIOES.map(
    (r) => `<option value="${r.valor}" ${r.valor === "" ? "selected" : ""}>${r.nome}</option>`
  ).join("");

  const mesesOptions = MESES_NOMES.slice(1)
    .map((nome, i) => `<option value="${i + 1}">${nome}</option>`)
    .join("");

  const anoAtual = new Date().getFullYear();
  const anoMinimo = 2004;

  const indicadoresCheckboxes = INDICADORES_CONFIG.map(
    (ind) => `
    <label class="indicador-check">
      <input type="checkbox" name="indicador" value="${ind.chave}" checked />
      <span class="indicador-label">
        <strong>${ind.label}</strong>
        <small>${ind.unidade} — ${ind.descricao}</small>
      </span>
    </label>`
  ).join("");

  return `
    <div class="relatorio-container">
      <div class="relatorio-header">
        <h1>Exportar Relatório</h1>
        <p>Gere relatórios em PDF ou Excel com os indicadores de crédito por estado</p>
      </div>

      <div class="relatorio-card">
        <form id="relatorio-form">

          <!-- Formato -->
          <fieldset class="formato-group">
            <legend>Formato</legend>
            <div class="formato-buttons" role="group" aria-label="Formato do relatório">
              <button type="button" class="formato-btn ${formatoSelecionado === "pdf" ? "ativo" : ""}" data-formato="pdf" aria-pressed="${formatoSelecionado === "pdf"}">
                PDF
              </button>
              <button type="button" class="formato-btn ${formatoSelecionado === "excel" ? "ativo" : ""}" data-formato="excel" aria-pressed="${formatoSelecionado === "excel"}">
                Excel
              </button>
            </div>
          </fieldset>

          <!-- Período -->
          <fieldset class="relatorio-fieldset">
            <legend>Período</legend>
            <div class="relatorio-row">
              <div class="relatorio-field">
                <label for="mes-inicio">Mês Início</label>
                <select id="mes-inicio" aria-label="Mês inicial">
                  <option value="">Selecione</option>
                  ${mesesOptions}
                </select>
              </div>
              <div class="relatorio-field">
                <label for="ano-inicio">Ano Início</label>
                <input type="number" id="ano-inicio" min="${anoMinimo}" max="${anoAtual}" value="${anoAtual - 1}" step="1" class="relatorio-input" inputmode="numeric" />
              </div>
              <div class="relatorio-field">
                <label for="mes-fim">Mês Fim</label>
                <select id="mes-fim" aria-label="Mês final">
                  <option value="">Selecione</option>
                  ${mesesOptions}
                </select>
              </div>
              <div class="relatorio-field">
                <label for="ano-fim">Ano Fim</label>
                <input type="number" id="ano-fim" min="${anoMinimo}" max="${anoAtual}" value="${anoAtual}" step="1" class="relatorio-input" inputmode="numeric" />
              </div>
            </div>
          </fieldset>

          <!-- Filtro geográfico -->
          <fieldset class="relatorio-fieldset">
            <legend>Filtro Geográfico</legend>
            <div class="relatorio-row">
              <div class="relatorio-field">
                <label for="regiao">Região</label>
                <select id="regiao" aria-label="Filtrar por região">
                  ${regioesOptions}
                </select>
              </div>
              <div class="relatorio-field">
                <label for="estado">Estado</label>
                <select id="estado" aria-label="Filtrar por estado">
                  <option value="">Todos os estados</option>
                </select>
              </div>
            </div>
          </fieldset>

          <!-- Seleção de indicadores -->
          <fieldset class="relatorio-fieldset">
            <legend>Indicadores a incluir</legend>
            <div class="indicadores-grid">
              ${indicadoresCheckboxes}
            </div>
            <div class="indicadores-actions">
              <button type="button" id="btn-marcar-todos" class="btn-link">Marcar todos</button>
              <button type="button" id="btn-desmarcar-todos" class="btn-link">Desmarcar todos</button>
            </div>
          </fieldset>

          <button type="submit" id="btn-exportar" class="btn-exportar" aria-describedby="feedback">
            Exportar relatório
          </button>
        </form>

        <div id="feedback" class="relatorio-feedback" role="status" aria-live="polite"></div>
      </div>
    </div>
  `;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function atualizarEstados(regiao: string): void {
  const estadoSelect = document.getElementById("estado") as HTMLSelectElement;
  if (!estadoSelect) return;
  const filtrados = regiao ? TODOS_ESTADOS.filter((e) => e.regiao === regiao) : TODOS_ESTADOS;
  estadoSelect.innerHTML =
    `<option value="">Todos os estados${regiao ? " da região" : ""}</option>` +
    filtrados.map((e) => `<option value="${e.uf}">${e.uf} – ${e.nome}</option>`).join("");
}

function mostrarFeedback(mensagem: string, tipo: "sucesso" | "erro" | "loading"): void {
  const feedback = document.getElementById("feedback");
  if (!feedback) return;
  feedback.className = `relatorio-feedback ${tipo}`;
  feedback.innerHTML = mensagem;
  if (tipo !== "loading") {
    setTimeout(() => {
      feedback.className = "relatorio-feedback";
      feedback.innerHTML = "";
    }, 5000);
  }
}

function indicadoresSelecionados(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="indicador"]:checked')
  ).map((el) => el.value);
}

function formatarSaldo(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
}

function formatarPct(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatarScore(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(data: string): string {
  if (!data) return "—";
  const [ano, mes] = data.split("-");
  return `${mes}/${ano}`;
}

function labelPeriodo(filtros: any): string {
  const mi = filtros.mes_inicio ? MESES_NOMES[filtros.mes_inicio] : "";
  const mf = filtros.mes_fim ? MESES_NOMES[filtros.mes_fim] : "";
  const ai = filtros.ano_inicio ?? "";
  const af = filtros.ano_fim ?? "";
  const inicio = [mi, ai].filter(Boolean).join("/");
  const fim = [mf, af].filter(Boolean).join("/");
  if (inicio && fim) return `${inicio} a ${fim}`;
  if (inicio) return `a partir de ${inicio}`;
  if (fim) return `até ${fim}`;
  return "todo o período";
}

// ─── Exportação Excel ─────────────────────────────────────────────────────────

function gerarExcel(dados: any, indicadores: string[]): void {
  const wb = XLSX.utils.book_new();

  // ── Aba 1: Resumo ──
  const resumo = dados.resumo ?? {};
  const periodo = dados.periodo_dados ?? {};
  const filtros = dados.filtros_aplicados ?? {};

  const resumoData: (string | number)[][] = [
    ["Relatório de Crédito – CtrlZ"],
    [""],
    ["Período:", labelPeriodo(filtros)],
    ["Total de meses:", periodo.total_meses ?? "—"],
    ["Estados abrangidos:", resumo.total_estados ?? "—"],
    ["Registros no período:", resumo.total_registros ?? "—"],
    [""],
    ["Indicador", "Valor"],
  ];

  if (indicadores.includes("saldo")) {
    resumoData.push(["Saldo total (R$ mi)", resumo.saldo_total ?? "—"]);
    resumoData.push(["Saldo médio por estado (R$ mi)", resumo.saldo_medio_por_estado ?? "—"]);
  }
  if (indicadores.includes("inadimplencia")) {
    resumoData.push(["Inadimplência média (%)", resumo.inadimplencia_media ?? "—"]);
    resumoData.push(["Inadimplência mínima (%)", resumo.inadimplencia_min ?? "—"]);
    resumoData.push(["Inadimplência máxima (%)", resumo.inadimplencia_max ?? "—"]);
  }
  if (indicadores.includes("variacao")) {
    resumoData.push(["Variação total (R$ mi)", resumo.variacao_total ?? "—"]);
    resumoData.push(["Variação média (R$ mi)", resumo.variacao_media ?? "—"]);
  }

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 38 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // ── Aba 2: Por Estado ──
  const cabecalhosEstado: string[] = ["UF", "Estado", "Região"];
  if (indicadores.includes("saldo"))         cabecalhosEstado.push("Saldo (R$ mi)");
  if (indicadores.includes("inadimplencia")) cabecalhosEstado.push("Inadimplência (%)");
  if (indicadores.includes("variacao"))      cabecalhosEstado.push("Variação (R$ mi)");
  if (indicadores.includes("score"))         cabecalhosEstado.push("Score (0–100)");

  const linhasEstado = (dados.por_estado ?? []).map((item: any) => {
    const linha: (string | number)[] = [item.uf, item.estado, item.regiao];
    if (indicadores.includes("saldo"))         linha.push(item.saldo ?? "—");
    if (indicadores.includes("inadimplencia")) linha.push(item.inadimplencia ?? "—");
    if (indicadores.includes("variacao"))      linha.push(item.variacao ?? "—");
    if (indicadores.includes("score"))         linha.push(item.score_oportunidade ?? "—");
    return linha;
  });

  const wsEstados = XLSX.utils.aoa_to_sheet([cabecalhosEstado, ...linhasEstado]);
  wsEstados["!cols"] = [
    { wch: 6 }, { wch: 22 }, { wch: 16 },
    ...cabecalhosEstado.slice(3).map(() => ({ wch: 18 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsEstados, "Por Estado");

  // ── Aba 3: Série Temporal ──
  const serieTemporal: (string | number)[][] = dados.serie_temporal ?? [];
  if (serieTemporal.length > 0) {
    const cabecalhosSerie: string[] = ["UF", "Data"];
    if (indicadores.includes("saldo"))         cabecalhosSerie.push("Saldo (R$ mi)");
    if (indicadores.includes("inadimplencia")) cabecalhosSerie.push("Inadimplência (%)");
    if (indicadores.includes("variacao"))      cabecalhosSerie.push("Variação (R$ mi)");

    const linhasSerie = (dados.serie_temporal ?? []).map((item: any) => {
      const linha: (string | number)[] = [item.estado ?? "—", formatarData(item.data)];
      if (indicadores.includes("saldo"))         linha.push(item.saldo_nacional ?? "—");
      if (indicadores.includes("inadimplencia")) linha.push(item.inadimplencia_media ?? "—");
      if (indicadores.includes("variacao"))      linha.push(item.variacao_nacional ?? "—");
      return linha;
    });

    const wsSerie = XLSX.utils.aoa_to_sheet([cabecalhosSerie, ...linhasSerie]);
    wsSerie["!cols"] = [{ wch: 8 }, { wch: 12 }, ...cabecalhosSerie.slice(2).map(() => ({ wch: 24 }))];
    XLSX.utils.book_append_sheet(wb, wsSerie, "Série Temporal");
  }

  XLSX.writeFile(wb, "relatorio_credito.xlsx");
}

// ─── Exportação PDF ───────────────────────────────────────────────────────────

function gerarPDF(dados: any, indicadores: string[]): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const filtros = dados.filtros_aplicados ?? {};
  const resumo  = dados.resumo ?? {};
  const periodo = dados.periodo_dados ?? {};

  const azul       = [30, 80, 160]   as [number, number, number];
  const cinzaClaro = [245, 247, 250] as [number, number, number];
  const branco     = [255, 255, 255] as [number, number, number];

  const pageW = doc.internal.pageSize.getWidth();
  const geradoEm = new Date().toLocaleString("pt-BR");

  // ── Cabeçalho ──
  doc.setFillColor(...azul);
  doc.rect(0, 0, pageW, 22, "F");

  // ── Logo ──
  // Proporção original: 1280×674 px → ratio ≈ 1.899
  const logoH = 16;
  const logoW = logoH * (1456 / 816);
  doc.addImage(logoUrl, "PNG", 4, (22 - logoH) / 2, logoW, logoH);

  doc.setTextColor(...branco);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Crédito – CtrlZ", 4 + logoW + 4, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${geradoEm}`, pageW - 14, 14, { align: "right" });

  doc.setTextColor(0, 0, 0);

  // ── Subtítulo / contexto ──
  let y = 30;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Período:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(labelPeriodo(filtros), 38, y);

  if (filtros.regiao || filtros.estado) {
    doc.setFont("helvetica", "bold");
    doc.text("Filtro:", 100, y);
    doc.setFont("helvetica", "normal");
    doc.text([filtros.estado, filtros.regiao].filter(Boolean).join(" – "), 118, y);
  }

  doc.setFont("helvetica", "bold");
  doc.text("Meses no período:", 180, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(periodo.total_meses ?? "—"), 220, y);

  // ── Bloco de Resumo ──
  y += 10;
  doc.setFillColor(...cinzaClaro);
  doc.roundedRect(14, y, pageW - 28, 26, 2, 2, "F");

  const resumoItens: { label: string; valor: string }[] = [];
  if (indicadores.includes("saldo")) {
    resumoItens.push({ label: "Saldo Total", valor: formatarSaldo(resumo.saldo_total) });
    resumoItens.push({ label: "Saldo Médio/Estado", valor: formatarSaldo(resumo.saldo_medio_por_estado) });
  }
  if (indicadores.includes("inadimplencia")) {
    resumoItens.push({ label: "Inadimpl. Média", valor: formatarPct(resumo.inadimplencia_media) });
    resumoItens.push({ label: "Inadimpl. Mín/Máx", valor: `${formatarPct(resumo.inadimplencia_min)} / ${formatarPct(resumo.inadimplencia_max)}` });
  }
  if (indicadores.includes("variacao")) {
    resumoItens.push({ label: "Variação Total", valor: formatarSaldo(resumo.variacao_total) });
  }

  const colW = (pageW - 28) / Math.max(resumoItens.length, 1);
  resumoItens.forEach((item, i) => {
    const x = 14 + i * colW + colW / 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, x, y + 8, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(item.valor, x, y + 20, { align: "center" });
  });

  // ── Tabela: Por Estado ──
  y += 32;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Dados por Estado", 14, y);
  y += 4;

  const headEstado: string[] = ["UF", "Estado", "Região"];
  if (indicadores.includes("saldo"))         headEstado.push("Saldo (R$ mi)");
  if (indicadores.includes("inadimplencia")) headEstado.push("Inadimpl. (%)");
  if (indicadores.includes("variacao"))      headEstado.push("Variação (R$ mi)");
  if (indicadores.includes("score"))         headEstado.push("Score (0–100)");

  const bodyEstado = (dados.por_estado ?? []).map((item: any) => {
    const row: string[] = [item.uf, item.estado, item.regiao];
    if (indicadores.includes("saldo"))         row.push(formatarSaldo(item.saldo));
    if (indicadores.includes("inadimplencia")) row.push(formatarPct(item.inadimplencia));
    if (indicadores.includes("variacao"))      row.push(formatarSaldo(item.variacao));
    if (indicadores.includes("score"))         row.push(formatarScore(item.score_oportunidade));
    return row;
  });

  autoTable(doc, {
    startY: y,
    head: [headEstado],
    body: bodyEstado,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: azul, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: cinzaClaro },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 38 },
      2: { cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Tabela: Série Temporal (nova página) ──
  const serieTemporal = dados.serie_temporal ?? [];
  if (serieTemporal.length > 0) {
    doc.addPage();

    // Cabeçalho na nova página
    doc.setFillColor(...azul);
    doc.rect(0, 0, pageW, 22, "F");
    const logoH = 16;
    const logoW = logoH * (1456 / 816);
    doc.addImage(logoUrl, "PNG", 4, (22 - logoH) / 2, logoW, logoH);
    doc.setTextColor(...branco);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Crédito – CtrlZ", 4 + logoW + 4, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${geradoEm}`, pageW - 14, 14, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y = 30;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Série Temporal Mensal", 14, y);
    y += 4;

    const headSerie: string[] = ["UF", "Data"];
    if (indicadores.includes("saldo"))         headSerie.push("Saldo (R$ mi)");
    if (indicadores.includes("inadimplencia")) headSerie.push("Inadimpl. (%)");
    if (indicadores.includes("variacao"))      headSerie.push("Variação (R$ mi)");

    const bodySerie = serieTemporal.map((item: any) => {
      const row: string[] = [item.estado ?? "—", formatarData(item.data)];
      if (indicadores.includes("saldo"))         row.push(formatarSaldo(item.saldo_nacional));
      if (indicadores.includes("inadimplencia")) row.push(formatarPct(item.inadimplencia_media));
      if (indicadores.includes("variacao"))      row.push(formatarSaldo(item.variacao_nacional));
      return row;
    });

    autoTable(doc, {
      startY: y,
      head: [headSerie],
      body: bodySerie,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: azul, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: cinzaClaro },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Rodapé em todas as páginas ──
  const totalPaginas = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${totalPaginas}  •  CtrlZ – Análise de Crédito`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  doc.save("relatorio_credito.pdf");
}

// ─── Renderização Principal ───────────────────────────────────────────────────

export async function renderizarRelatorio(container: HTMLElement): Promise<void> {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    container.innerHTML = `
      <div class="acesso-restrito">
        <h2>Acesso restrito</h2>
        <p>Faça <a href="#/login">login</a> para acessar os relatórios.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = renderRelatorio();
  atualizarEstados("");

  // Botões de formato
  const formatoBtns = document.querySelectorAll<HTMLButtonElement>(".formato-btn");
  formatoBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      formatoBtns.forEach((b) => {
        b.classList.remove("ativo");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("ativo");
      btn.setAttribute("aria-pressed", "true");
      formatoSelecionado = btn.dataset.formato as "pdf" | "excel";
    });
  });

  // Filtro região → estados
  const regiaoSelect = document.getElementById("regiao") as HTMLSelectElement;
  regiaoSelect?.addEventListener("change", (e) => {
    atualizarEstados((e.target as HTMLSelectElement).value);
  });

  // Marcar / desmarcar todos os indicadores
  document.getElementById("btn-marcar-todos")?.addEventListener("click", () => {
    document.querySelectorAll<HTMLInputElement>('input[name="indicador"]').forEach((el) => (el.checked = true));
  });
  document.getElementById("btn-desmarcar-todos")?.addEventListener("click", () => {
    document.querySelectorAll<HTMLInputElement>('input[name="indicador"]').forEach((el) => (el.checked = false));
  });

  // Submit
  const form = document.getElementById("relatorio-form");
  const btn  = document.getElementById("btn-exportar") as HTMLButtonElement;

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const regiao    = (document.getElementById("regiao")     as HTMLSelectElement)?.value;
    const estado    = (document.getElementById("estado")     as HTMLSelectElement)?.value;
    const mesInicio = (document.getElementById("mes-inicio") as HTMLSelectElement)?.value;
    const mesFim    = (document.getElementById("mes-fim")    as HTMLSelectElement)?.value;
    const anoInicio = (document.getElementById("ano-inicio") as HTMLInputElement)?.value;
    const anoFim    = (document.getElementById("ano-fim")    as HTMLInputElement)?.value;

    const indSelecionados = indicadoresSelecionados();

    if (!mesInicio || !mesFim) {
      mostrarFeedback("Selecione o mês de início e fim", "erro");
      return;
    }
    if (!anoInicio || !anoFim) {
      mostrarFeedback("Informe o ano de início e fim", "erro");
      return;
    }
    if (parseInt(anoInicio) > parseInt(anoFim)) {
      mostrarFeedback("Ano inicial não pode ser maior que o ano final", "erro");
      return;
    }
    if (parseInt(anoInicio) === parseInt(anoFim) && parseInt(mesInicio) > parseInt(mesFim)) {
      mostrarFeedback("Mês inicial não pode ser maior que mês final no mesmo ano", "erro");
      return;
    }
    if (indSelecionados.length === 0) {
      mostrarFeedback("Selecione ao menos um indicador", "erro");
      return;
    }

    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    mostrarFeedback("Gerando relatório...", "loading");

    try {
      const params = new URLSearchParams();
      params.append("mes_inicio", mesInicio);
      params.append("mes_fim",    mesFim);
      params.append("ano_inicio", anoInicio);
      params.append("ano_fim",    anoFim);
      params.append("indicadores", indSelecionados.join(","));
      if (regiao) params.append("regiao", regiao);
      if (estado) params.append("estado", estado);

      const response = await fetch(`/api/relatorio?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Erro ${response.status}`);
      }

      const dados = await response.json();

      if (formatoSelecionado === "excel") {
        gerarExcel(dados, indSelecionados);
      } else {
        gerarPDF(dados, indSelecionados);
      }

      mostrarFeedback("Relatório gerado com sucesso!", "sucesso");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar relatório";
      mostrarFeedback(msg, "erro");
    } finally {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  });
}