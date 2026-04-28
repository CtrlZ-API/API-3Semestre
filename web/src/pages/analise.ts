import { getDadosPorEstadosPeriodo, getHistoricoGeral } from "../api/client";
import { HistoricoChart } from "../components/HistoricoChart";
import type { Regiao, TipoIndicador } from "../types";

interface DadosCompletosEstado {
  estado: string;
  regiao: string;
  saldo: number;
  inadimplencia: number;
  variacao: number;
  score: number;
  categoria: string;
  corCategoria: string;
}

interface RankingOportunidade {
  estado: string;
  regiao: string;
  score_oportunidade: number;
  indicadores: {
    saldo_bruto: number;
    inadimplencia_bruto: number;
    variacao_bruta: number;
  };
}

function getCategoria(score: number): { texto: string; corClass: string } {
  if (score <= 40) {
    return { texto: "Risco alto", corClass: "risco-alto" };
  } else if (score <= 69) {
    return { texto: "Moderado", corClass: "moderado" };
  } else {
    return { texto: "Alta oportunidade", corClass: "alta-oportunidade" };
  }
}

function formatarScore(score: number): string {
  return Math.round(score).toString();
}

async function getRankingOportunidade(): Promise<RankingOportunidade[]> {
  const response = await fetch("/api/oportunidade/ranking");
  if (!response.ok) {
    throw new Error(`Erro ao buscar ranking: ${response.status}`);
  }
  return response.json();
}

function renderEmptyState(): string {
  return `
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
      <h3>Nenhum estado selecionado</h3>
      <p>Clique em uma linha da tabela abaixo para ver o comparativo detalhado deste estado com a média nacional.</p>
    </div>
  `;
}


function renderAnalises(): string {
  return `
    <div class="analises-header">
      <h1>Análises de Crédito</h1>
      <p>Score DM, cards comparativos e ranking completo</p>
    </div>

    <div class="analises-filtros">
      <div>
        <label for="regiao-select-analises"><strong>Região:</strong></label>
        <select id="regiao-select-analises">
          <option value="">Todas</option>
          <option value="Norte">Norte</option>
          <option value="Nordeste">Nordeste</option>
          <option value="Centro-Oeste">Centro-Oeste</option>
          <option value="Sudeste">Sudeste</option>
          <option value="Sul">Sul</option>
        </select>
      </div>
      <div>
        <label for="estado-select-analises"><strong>Estado comparativo:</strong></label>
        <select id="estado-select-analises">
          <option value="">Selecione um estado</option>
        </select>
      </div>
      <div>
        <label for="data-inicio-analises"><strong>De:</strong></label>
        <input type="date" id="data-inicio-analises" />
        <label for="data-fim-analises"><strong>Até:</strong></label>
        <input type="date" id="data-fim-analises" />
        <button id="btn-limpar-analises">Limpar</button>
      </div>
    </div>

    <div class="cards-comparativos-section">
      <h2>Comparativo Estado vs Média Nacional</h2>
      <div id="cards-comparativos-container" class="cards-comparativos-container">
        ${renderEmptyState()}
      </div>

      
      <div id="historico-estado-section" style="margin-top: 2rem; background: #fff; border-radius: 8px; padding: 1.5rem;">
        <h2 id="historico-titulo" style="font-size: 1.1rem; margin-bottom: 1.5rem;">Evolução Histórica</h2>
        <div id="historico-chart" style="min-height: 400px; position: relative;">
          <p class="loading">Carregando histórico...</p>
        </div>
      </div>
    </div>

    <div class="ranking-section">
      <h2>Ranking por Score DM</h2>
      <div id="tabela-ranking-analises">
        <p class="loading">Carregando ranking...</p>
      </div>
    </div>
  `;
}

let colunaOrdenada: keyof DadosCompletosEstado = "score";
let ordemAscendente = false;
let dadosCompletosCache: DadosCompletosEstado[] = [];
let todosEstadosCache: { estado: string; regiao: string }[] = [];

function atualizarEstadosPorRegiao(regiao: string): void {
  const selectEstado = document.getElementById("estado-select-analises") as HTMLSelectElement;
  if (!selectEstado) return;
  
  const estadosFiltrados = regiao
    ? todosEstadosCache.filter(e => e.regiao === regiao)
    : todosEstadosCache;
  
  const valorAtual = selectEstado.value;
  selectEstado.innerHTML = '<option value="">Selecione um estado</option>';
  
  estadosFiltrados.forEach(uf => {
    const option = document.createElement("option");
    option.value = uf.estado;
    option.textContent = uf.estado;
    selectEstado.appendChild(option);
  });
  
  if (valorAtual && estadosFiltrados.some(e => e.estado === valorAtual)) {
    selectEstado.value = valorAtual;
  } else {
    selectEstado.value = "";
  }
}

let historicoChart: HistoricoChart | null = null;

async function renderCardsComparativos(
  estadoSelecionado: string,
  dataInicio?: string,
  dataFim?: string,
  regiao?: string
): Promise<void> {
  const container = document.getElementById("cards-comparativos-container");
  if (!container) return;

  if (!estadoSelecionado) {
    container.innerHTML = renderEmptyState();
    return;
  }

  try {
    const [dadosSaldo, dadosInad, dadosVariacao] = await Promise.all([
      getDadosPorEstadosPeriodo("saldo", dataInicio, dataFim, regiao as Regiao),
      getDadosPorEstadosPeriodo("inadimplencia", dataInicio, dataFim, regiao as Regiao),
      getDadosPorEstadosPeriodo("variacao", dataInicio, dataFim, regiao as Regiao)
    ]);

    const estadoSaldo = dadosSaldo.find(d => d.estado === estadoSelecionado);
    const estadoInad = dadosInad.find(d => d.estado === estadoSelecionado);
    const estadoVariacao = dadosVariacao.find(d => d.estado === estadoSelecionado);

    const mediaNacionalSaldo = dadosSaldo.reduce((acc, d) => acc + d.media, 0) / dadosSaldo.length;
    const mediaNacionalInad = dadosInad.reduce((acc, d) => acc + d.media, 0) / dadosInad.length;
    const mediaNacionalVariacao = dadosVariacao.reduce((acc, d) => acc + d.media, 0) / dadosVariacao.length;

    container.innerHTML = `
      ${renderCardComparativo("Saldo de Crédito", estadoSaldo?.media ?? 0, mediaNacionalSaldo, "saldo", "Maior saldo é melhor ↑")}
      ${renderCardComparativo("Inadimplência", estadoInad?.media ?? 0, mediaNacionalInad, "inadimplencia", "Menor inadimplência é melhor ↓")}
      ${renderCardComparativo("Crescimento da Carteira", estadoVariacao?.media ?? 0, mediaNacionalVariacao, "variacao", "Maior crescimento é melhor ↑")}
    `;
  } catch (err) {
    container.innerHTML = `<p class="error">Erro ao carregar dados do estado</p>`;
  }
}

async function renderGraficoHistoricoAnalises(
  regiao?: string,
  dataInicio?: string,
  dataFim?: string,
  estado?: string
): Promise<void> {
  const chartContainer = document.getElementById("historico-chart");
  const titulo = document.getElementById("historico-titulo");
  if (!chartContainer) return;

  try {
    if (titulo) {
      titulo.textContent = estado 
        ? `Evolução Histórica: ${estado}` 
        : regiao 
          ? `Evolução Histórica: Região ${regiao}` 
          : "Evolução Histórica: Nacional";
    }

    const dadosHistorico = await getHistoricoGeral(regiao, dataInicio, dataFim, estado);

    if (!historicoChart) {
      chartContainer.innerHTML = "";
      historicoChart = new HistoricoChart({ containerId: "historico-chart" });
    }
    historicoChart.render(dadosHistorico);
  } catch (err) {
    chartContainer.innerHTML = `<p class="error">Erro ao carregar histórico</p>`;
    if (historicoChart) {
      historicoChart.destroy();
      historicoChart = null;
    }
  }
}


function renderCardComparativo(
  titulo: string,
  valorEstado: number,
  valorMedia: number,
  tipo: TipoIndicador,
  dica: string
): string {
  const diferencaAbs = valorEstado - valorMedia;
  const diferencaPercentual = valorMedia !== 0 ? (diferencaAbs / Math.abs(valorMedia)) * 100 : 0;
  
  let ehMelhor = tipo === "inadimplencia" ? valorEstado < valorMedia : valorEstado > valorMedia;
  const seta = ehMelhor ? "↑" : "↓";
  const corClass = ehMelhor ? "positivo" : "negativo";
  const textoComparacao = ehMelhor ? "melhor" : "pior";
  
  return `
    <div class="card-comparativo ${corClass}">
      <p class="titulo">${titulo}</p>
      <div class="linha">
        <span><strong>Estado:</strong></span>
        <span><strong>${formatarValor(valorEstado, tipo)}</strong></span>
      </div>
      <div class="linha">
        <span><strong>Média BR:</strong></span>
        <span>${formatarValor(valorMedia, tipo)}</span>
      </div>
      <div class="diferenca">
        <span>Diferença:</span>
        <span class="valor">${diferencaPercentual > 0 ? "+" : ""}${diferencaPercentual.toFixed(1)}% ${seta}</span>
        <span>${textoComparacao} que a média</span>
      </div>
      <p class="dica">${dica}</p>
    </div>
  `;
}

function processarRanking(rankingData: RankingOportunidade[]): DadosCompletosEstado[] {
  const resultados: DadosCompletosEstado[] = [];
  
  for (const item of rankingData) {
    const { texto, corClass } = getCategoria(item.score_oportunidade);
    
    resultados.push({
      estado: item.estado,
      regiao: item.regiao,
      saldo: item.indicadores.saldo_bruto,
      inadimplencia: item.indicadores.inadimplencia_bruto,
      variacao: item.indicadores.variacao_bruta,
      score: item.score_oportunidade,
      categoria: texto,
      corCategoria: corClass
    });
  }
  
  return resultados;
}

function renderTabelaRanking(dadosCompletos: DadosCompletosEstado[], regiaoFiltro?: string): void {
  const container = document.getElementById("tabela-ranking-analises");
  if (!container) return;
  
  dadosCompletosCache = dadosCompletos;
  
  let dadosExibicao = dadosCompletos;
  if (regiaoFiltro) {
    dadosExibicao = dadosCompletos.filter(d => d.regiao === regiaoFiltro);
  }
  
  const dadosOrdenados = [...dadosExibicao].sort((a, b) => {
    let valorA: string | number = a[colunaOrdenada];
    let valorB: string | number = b[colunaOrdenada];
    
    if (typeof valorA === "number" && typeof valorB === "number") {
      return ordemAscendente ? valorA - valorB : valorB - valorA;
    }
    return ordemAscendente ? String(valorA).localeCompare(String(valorB)) : String(valorB).localeCompare(String(valorA));
  });
  
  if (dadosOrdenados.length === 0) {
    container.innerHTML = `<p class="loading">Nenhum estado encontrado para esta região</p>`;
    return;
  }
  
  container.innerHTML = `
    <div class="tabela-ranking">
      <p class="ranking-info">Score: 30% Saldo + 40% Crescimento + 30% (1 - Inadimplência). Quanto maior, melhor a oportunidade.</p>
      <table>
        <thead>
          <tr>
            <th onclick="window.ordenarPorAnalises('posicao')">#</th>
            <th onclick="window.ordenarPorAnalises('estado')">Estado</th>
            <th class="align-right" onclick="window.ordenarPorAnalises('score')">Score</th>
            <th onclick="window.ordenarPorAnalises('categoria')">Categoria</th>
            <th class="align-right" onclick="window.ordenarPorAnalises('saldo')">Saldo</th>
            <th class="align-right" onclick="window.ordenarPorAnalises('inadimplencia')">Inadimplência</th>
            <th class="align-right" onclick="window.ordenarPorAnalises('variacao')">Variação</th>
           </tr>
        </thead>
        <tbody>
          ${dadosOrdenados.map((d, i) => {
            const isSelected = (document.getElementById("estado-select-analises") as HTMLSelectElement)?.value === d.estado;
            return `
              <tr class="${isSelected ? 'selected' : ''}" onclick="window.selecionarEstadoParaAnalise('${d.estado}')">
                <td class="posicao">${i + 1}</td>
                <td><span class="estado-nome">${d.estado}</span> <span class="regiao-nome">(${d.regiao})</span></td>
                <td class="score-valor">${formatarScore(d.score)}</td>
                <td><span class="categoria-badge ${d.corCategoria}">${d.categoria}</span></td>
                <td class="align-right">${formatarValor(d.saldo, "saldo")}</td>
                <td class="align-right">${formatarValor(d.inadimplencia, "inadimplencia")}</td>
                <td class="align-right">${formatarValor(d.variacao, "variacao")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>

      </table>
    </div>
  `;
  
  (window as any).ordenarPorAnalises = (coluna: string) => {
    if (coluna === "posicao") {
      colunaOrdenada = "score";
      ordemAscendente = false;
    } else if (coluna === "estado") {
      colunaOrdenada = "estado";
      ordemAscendente = !ordemAscendente;
    } else {
      if (colunaOrdenada === coluna) {
        ordemAscendente = !ordemAscendente;
      } else {
        colunaOrdenada = coluna as keyof DadosCompletosEstado;
        ordemAscendente = false;
      }
    }
    renderTabelaRanking(dadosCompletosCache, (document.getElementById("regiao-select-analises") as HTMLSelectElement)?.value || undefined);
  };

  (window as any).selecionarEstadoParaAnalise = (estado: string) => {
    const selectEstado = document.getElementById("estado-select-analises") as HTMLSelectElement;
    if (selectEstado) {
      selectEstado.value = estado;
      const { dataInicio, dataFim, regiao } = lerFiltros();
      renderCardsComparativos(estado, dataInicio, dataFim, regiao);
      renderGraficoHistoricoAnalises(regiao, dataInicio, dataFim, estado);
      renderTabelaRanking(dadosCompletosCache, regiao); // Re-render table to update selection highlight
    }
  };

}


function formatarValor(valor: number, tipo: TipoIndicador): string {
  if (tipo === "saldo") {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (tipo === "variacao") {
    const sinal = valor >= 0 ? "+" : "";
    return sinal + valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return valor.toFixed(2).replace(".", ",") + "%";
}

async function carregarTudo(dataInicio?: string, dataFim?: string, regiaoFiltro?: string): Promise<void> {
  const container = document.getElementById("tabela-ranking-analises");
  const cardsContainer = document.getElementById("cards-comparativos-container");
  
  if (container) container.innerHTML = `<p class="loading">Carregando ranking</p>`;
  if (cardsContainer) cardsContainer.innerHTML = `<p class="loading">Escolha um estado</p>`;
  
  try {
    const rankingData = await getRankingOportunidade();
    const dadosCompletosEstado = processarRanking(rankingData);
    
    if (todosEstadosCache.length === 0) {
      todosEstadosCache = dadosCompletosEstado.map(d => ({ estado: d.estado, regiao: d.regiao }));
    }
    
    atualizarEstadosPorRegiao(regiaoFiltro || "");
    renderTabelaRanking(dadosCompletosEstado, regiaoFiltro);
    
    const estadoSelect = document.getElementById("estado-select-analises") as HTMLSelectElement;
    const estado = estadoSelect?.value || "";
    
    await Promise.all([
      renderCardsComparativos(estado, dataInicio, dataFim, regiaoFiltro),
      renderGraficoHistoricoAnalises(regiaoFiltro, dataInicio, dataFim, estado)
    ]);

  } catch (err) {
    if (container) {
      container.innerHTML = `<p class="error">Erro ao carregar ranking. Verifique se o backend está rodando.</p>`;
    }
  }
}

function lerFiltros(): { dataInicio?: string; dataFim?: string; regiao?: string } {
  return {
    dataInicio: (document.getElementById("data-inicio-analises") as HTMLInputElement)?.value || undefined,
    dataFim: (document.getElementById("data-fim-analises") as HTMLInputElement)?.value || undefined,
    regiao: (document.getElementById("regiao-select-analises") as HTMLSelectElement)?.value || undefined
  };
}

export async function renderizarAnalises(container: HTMLElement): Promise<void> {
  if (historicoChart) {
    historicoChart.destroy();
    historicoChart = null;
  }
  container.innerHTML = renderAnalises();
  await carregarTudo();


  const btnLimpar = document.getElementById("btn-limpar-analises") as HTMLButtonElement;
  const inputInicio = document.getElementById("data-inicio-analises") as HTMLInputElement;
  const inputFim = document.getElementById("data-fim-analises") as HTMLInputElement;
  const selectRegiao = document.getElementById("regiao-select-analises") as HTMLSelectElement;
  const selectEstado = document.getElementById("estado-select-analises") as HTMLSelectElement;

  const atualizarTudo = async () => {
    const { dataInicio, dataFim, regiao } = lerFiltros();
    await carregarTudo(dataInicio, dataFim, regiao);
  };

  const atualizarCards = async () => {
    const { dataInicio, dataFim, regiao } = lerFiltros();
    const estado = selectEstado.value;
    await Promise.all([
      renderCardsComparativos(estado, dataInicio, dataFim, regiao),
      renderGraficoHistoricoAnalises(regiao, dataInicio, dataFim, estado)
    ]);
  };


  selectRegiao.addEventListener("change", atualizarTudo);
  inputInicio.addEventListener("change", atualizarTudo);
  inputFim.addEventListener("change", atualizarTudo);
  selectEstado.addEventListener("change", atualizarCards);

  btnLimpar.addEventListener("click", () => {
    inputInicio.value = "";
    inputFim.value = "";
    selectRegiao.value = "";
    selectEstado.value = "";
    atualizarTudo();
  });
}