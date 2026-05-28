import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const REGIOES = [
  { valor: "", nome: "Todas as regiões" },
  { valor: "Norte", nome: "Norte" },
  { valor: "Nordeste", nome: "Nordeste" },
  { valor: "Centro-Oeste", nome: "Centro-Oeste" },
  { valor: "Sudeste", nome: "Sudeste" },
  { valor: "Sul", nome: "Sul" }
];

const TODOS_ESTADOS = [
  { uf: "AC", nome: "Acre", regiao: "Norte" }, { uf: "AL", nome: "Alagoas", regiao: "Nordeste" }, { uf: "AP", nome: "Amapá", regiao: "Norte" }, { uf: "AM", nome: "Amazonas", regiao: "Norte" }, { uf: "BA", nome: "Bahia", regiao: "Nordeste" },{ uf: "CE", nome: "Ceará", regiao: "Nordeste" }, { uf: "DF", nome: "Distrito Federal", regiao: "Centro-Oeste" },
  { uf: "ES", nome: "Espírito Santo", regiao: "Sudeste" },{ uf: "GO", nome: "Goiás", regiao: "Centro-Oeste" },{ uf: "MA", nome: "Maranhão", regiao: "Nordeste" },{ uf: "MT", nome: "Mato Grosso", regiao: "Centro-Oeste" },{ uf: "MS", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste" },{ uf: "MG", nome: "Minas Gerais", regiao: "Sudeste" },
  { uf: "PA", nome: "Pará", regiao: "Norte" },{ uf: "PB", nome: "Paraíba", regiao: "Nordeste" },{ uf: "PR", nome: "Paraná", regiao: "Sul" }, { uf: "PE", nome: "Pernambuco", regiao: "Nordeste" }, { uf: "PI", nome: "Piauí", regiao: "Nordeste" }, { uf: "RJ", nome: "Rio de Janeiro", regiao: "Sudeste" },{ uf: "RN", nome: "Rio Grande do Norte", regiao: "Nordeste" },
  { uf: "RS", nome: "Rio Grande do Sul", regiao: "Sul" },{ uf: "RO", nome: "Rondônia", regiao: "Norte" },{ uf: "RR", nome: "Roraima", regiao: "Norte" },{ uf: "SC", nome: "Santa Catarina", regiao: "Sul" },{ uf: "SP", nome: "São Paulo", regiao: "Sudeste" },{ uf: "SE", nome: "Sergipe", regiao: "Nordeste" },{ uf: "TO", nome: "Tocantins", regiao: "Norte" }
];

let formatoSelecionado: "pdf" | "excel" = "pdf";

function renderRelatorio(): string {
  const regioesOptions = REGIOES.map(r => 
    `<option value="${r.valor}" ${r.valor === "" ? "selected" : ""}>${r.nome}</option>`
  ).join("");

  const mesesOptions = `
    <option value="">Selecione</option>
    <option value="1">Janeiro</option>
    <option value="2">Fevereiro</option>
    <option value="3">Março</option>
    <option value="4">Abril</option>
    <option value="5">Maio</option>
    <option value="6">Junho</option>
    <option value="7">Julho</option>
    <option value="8">Agosto</option>
    <option value="9">Setembro</option>
    <option value="10">Outubro</option>
    <option value="11">Novembro</option>
    <option value="12">Dezembro</option>
  `;

  const anoAtual = new Date().getFullYear();
  const anoMinimo = 2004;

  return `
    <div class="relatorio-container">
      <div class="relatorio-header">
        <h1>Exportar Relatório</h1>
        <p>Gere relatórios em PDF ou Excel com os indicadores de crédito por estado</p>
      </div>

      <div class="relatorio-card">
        <form id="relatorio-form">
          <fieldset class="formato-group">
            <legend>Selecione o formato</legend>
            <div class="formato-buttons" role="group" aria-label="Formato do relatório">
              <button type="button" class="formato-btn ${formatoSelecionado === "pdf" ? "ativo" : ""}" data-formato="pdf" aria-pressed="${formatoSelecionado === "pdf"}">
                PDF
              </button>
              <button type="button" class="formato-btn ${formatoSelecionado === "excel" ? "ativo" : ""}" data-formato="excel" aria-pressed="${formatoSelecionado === "excel"}">
                Excel
              </button>
            </div>
          </fieldset>

          <div class="relatorio-row">
            <div class="relatorio-field">
              <label for="ano-inicio">Ano Início</label>
              <input type="number" id="ano-inicio" min="${anoMinimo}" max="${anoAtual}" value="${anoAtual - 1}" step="1" class="relatorio-input" inputmode="numeric" />
            </div>
            <div class="relatorio-field">
              <label for="ano-fim">Ano Fim</label>
              <input type="number" id="ano-fim" min="${anoMinimo}" max="${anoAtual}" value="${anoAtual}" step="1" class="relatorio-input" inputmode="numeric" />
            </div>
          </div>

          <div class="relatorio-row">
            <div class="relatorio-field">
              <label for="mes-inicio">Mês Início</label>
              <select id="mes-inicio" aria-label="Mês inicial">
                ${mesesOptions}
              </select>
            </div>
            <div class="relatorio-field">
              <label for="mes-fim">Mês Fim</label>
              <select id="mes-fim" aria-label="Mês final">
                ${mesesOptions}
              </select>
            </div>
          </div>

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

          <button type="submit" id="btn-exportar" class="btn-exportar" aria-describedby="feedback">
            Exportar relatório
          </button>
        </form>

        <div id="feedback" class="relatorio-feedback" role="status" aria-live="polite"></div>
      </div>
    </div>
  `;
}

function atualizarEstados(regiao: string): void {
  const estadoSelect = document.getElementById("estado") as HTMLSelectElement;
  if (!estadoSelect) return;

  let estadosFiltrados = TODOS_ESTADOS;
  
  if (regiao) {
    estadosFiltrados = TODOS_ESTADOS.filter(e => e.regiao === regiao);
  }

  // Mostrar apenas a sigla (UF)
  estadoSelect.innerHTML = `<option value="">Todos os estados${regiao ? " da região" : ""}</option>` + 
    estadosFiltrados.map(e => `<option value="${e.uf}">${e.uf}</option>`).join("");
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

  // Inicializar estados com base na região padrão (Todas)
  atualizarEstados("");

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

  const regiaoSelect = document.getElementById("regiao") as HTMLSelectElement;
  regiaoSelect?.addEventListener("change", (e) => {
    const regiao = (e.target as HTMLSelectElement).value;
    atualizarEstados(regiao);
  });

  const form = document.getElementById("relatorio-form");
  const btn = document.getElementById("btn-exportar") as HTMLButtonElement;

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const regiao = (document.getElementById("regiao") as HTMLSelectElement)?.value;
    const estado = (document.getElementById("estado") as HTMLSelectElement)?.value;
    const mesInicio = (document.getElementById("mes-inicio") as HTMLSelectElement)?.value;
    const mesFim = (document.getElementById("mes-fim") as HTMLSelectElement)?.value;
    const anoInicio = (document.getElementById("ano-inicio") as HTMLInputElement)?.value;
    const anoFim = (document.getElementById("ano-fim") as HTMLInputElement)?.value;

    if (!mesInicio || !mesFim || !anoInicio || !anoFim) {
      mostrarFeedback("Selecione todos os campos de período", "erro");
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

    if (!btn) return;
    
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    mostrarFeedback("Gerando relatório...", "loading");

    try {
      const params = new URLSearchParams();
      params.append("formato", formatoSelecionado);
      params.append("mes_inicio", mesInicio);
      params.append("mes_fim", mesFim);
      params.append("ano_inicio", anoInicio);
      params.append("ano_fim", anoFim);
      
      if (regiao) params.append("regiao", regiao);
      if (estado && estado !== "") params.append("estado", estado);

      const response = await fetch(`/api/relatorio?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Erro ${response.status}`);
      }

      const dados = await response.json();

      if (formatoSelecionado === "excel") {
        gerarExcel(dados);
      } 
      else {
        gerarPDF(dados);
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
function gerarExcel(dados: any): void {
  const dadosExcel = (dados.por_estado || []).map((item: any) => ({
    UF: item.uf,
    Estado: item.estado,
    Região: item.regiao,
    Saldo: item.saldo,
    Inadimplência: item.inadimplencia,
    Variação: item.variacao,
    Score: item.score_oportunidade
}));

  const worksheet = XLSX.utils.json_to_sheet(dadosExcel); // Ajusta as colunas automaticamente na ordem, começando UF até Score
    worksheet["!cols"] = [
    { wch: 6 },   
    { wch: 20 },
    { wch: 18 }, 
    { wch: 15 },  
    { wch: 18 },  
    { wch: 15 },  
    { wch: 12 }   
];
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
  workbook,
  worksheet,
  "Relatório"
  );

  XLSX.writeFile(
  workbook,
  "relatorio_credito.xlsx"
  );
  }

function gerarPDF(dados: any): void {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Relatório de Crédito", 14, 20);

  const linhas = (dados.por_estado || []).map((item: any) => [
  item.uf,
  item.estado,
  item.regiao,
  item.saldo,
  item.inadimplencia,
  item.variacao,
  item.score_oportunidade
  ]);

  autoTable(doc, {
  startY: 30,
  head: [[
  "UF",
  "Estado",
  "Região",
  "Saldo",
  "Inadimplência",
  "Variação",
  "Score"
  ]],
  body: linhas
  });

  doc.save("relatorio_credito.pdf");
  }
