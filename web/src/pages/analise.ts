import { getDadosPorEstadosPeriodo, getHistoricoGeral } from "../api/client";
import { HistoricoChart } from "../components/HistoricoChart";
import { MapaCoroplético } from "../components/MapaCoroplético";
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
  uf: string;
  regiao: string;
  score: number;
  posicao: number;
  componentes: {
    volume: number;
    saude: number;
    tendencia: number;
    estabilidade: number;
    penetracao: number;
  };
  indicadores_brutos: {
    saldo_ultimo_mes: number;
    inadimplencia: number;
    tendencia_12m: number;
    coef_variacao_3a: number;
    saldo_per_capita: number;
  };
}

function getCategoria(score: number): { texto: string; corClass: string } {
  if (score < 40) {
    return { texto: "Risco alto", corClass: "risco-alto" };
  } else if (score < 53) {
    return { texto: "Risco Moderado", corClass: "moderado" };
  } else {
    return { texto: "Alta oportunidade", corClass: "alta-oportunidade" };
  }
}

function formatarScore(score: number): string {
  return Math.round(score).toString();
}

async function getRankingOportunidade(): Promise<RankingOportunidade[]> {
  const response = await fetch("/api/opurtunidade/ranking/v2");
  if (!response.ok) throw new Error(`Erro ao buscar ranking: ${response.status}`);
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
function renderPainelInsight(_estado: string, texto: string, categoria: string, corClass: string): string {
  const icones: Record<string, string> = {
    "alta-oportunidade": "bi-gem",
    "moderado":          "bi-cash-stack",
    "risco-alto":        "bi-exclamation-triangle-fill",
  };

  const icone = icones[corClass] ?? "bi-info-circle-fill";

  return `
    <div class="insight-card ${corClass}">
      <div class="insight-header">
        <i class="bi ${icone}"></i>
        <span>${categoria}</span>
      </div>
      <div class="insight-body">
        ${texto}
      </div>
    </div>
  `;
}
function renderAnalises(): string {
  return `
    <div class="analises-header">
      <h1>Análises de Crédito</h1>
      <p>Score DM, cards comparativos e ranking completo</p>
    </div>

    <div class="analises-filtros" role="search" aria-label="Filtros de análise">
      <label for="regiao-select-analises"><strong>Região:</strong>
        <select id="regiao-select-analises" aria-label="Filtrar por região">
          <option value="">Todas</option>
          <option value="Norte">Norte</option>
          <option value="Nordeste">Nordeste</option>
          <option value="Centro-Oeste">Centro-Oeste</option>
          <option value="Sudeste">Sudeste</option>
          <option value="Sul">Sul</option>
        </select>
      </label>
      <label for="estado-select-analises"><strong>Estado comparativo:</strong>
        <select id="estado-select-analises" aria-label="Selecionar estado para comparativo">
          <option value="">Selecione um estado</option>
        </select>
      </label>
      <div class="filtro-datas">
        <label for="data-inicio-analises"><strong>De:</strong>
          <input type="date" id="data-inicio-analises" aria-label="Data inicial" />
        </label>
        <label for="data-fim-analises"><strong>Até:</strong>
          <input type="date" id="data-fim-analises" aria-label="Data final" />
        </label>
        <button type="button" id="btn-limpar-analises" aria-label="Limpar filtros de data e região">Limpar</button>
      </div>
    </div>

    <div class="analises-top-grid">
      <div class="mapa-coropletico-section mapa-coropletico-section--grid">
        <h2>Distribuição por Score de Oportunidade</h2>
        <p class="mapa-subtitulo">Intensidade de cor representa o score de crédito de cada estado (0 = baixo, 100 = alto).</p>
        <div id="mapa-coropletico-container">
          <p class="loading">Carregando mapa...</p>
        </div>
      </div>
      <div id="painel-insights-container"></div>
    </div>

    <div class="cards-comparativos-section">
      <h2>Comparativo Estado vs Média Nacional</h2>
      <div id="cards-comparativos-container" class="cards-comparativos-container">
        ${renderEmptyState()}
      </div>

      <div id="historico-estado-section" class="historico-estado-section">
        <h2 id="historico-titulo">Evolução Histórica</h2>
        <div id="historico-chart" class="historico-chart-wrap">
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
let mapaCoroplético: MapaCoroplético | null = null;

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
  const insightContainer = document.getElementById("painel-insights-container");
  
  if (!container) return;

  if (!estadoSelecionado) {
    container.innerHTML = renderEmptyState();
    if (insightContainer) {
      insightContainer.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1.5rem; background: #fafafa; border-radius: 8px; border: 1px dashed #d0d0d0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 100%;">
          <i class="bi bi-lightbulb" style="font-size: 2rem; color: #ccc; margin-bottom: 0.5rem;"></i>
          <h3 style="font-size: 1rem; color: #666; margin-bottom: 0.5rem;">Nenhum Estado Selecionado</h3>
          <p style="font-size: 0.8rem; color: #999; margin: 0;">Selecione um estado abaixo ou no filtro superior para exibir seu insight de oportunidade.</p>
        </div>
      `;
    }
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

    // 1. Renderiza os cards
    container.innerHTML = `
      ${renderCardComparativo("Saldo de Crédito", estadoSaldo?.media ?? 0, mediaNacionalSaldo, "saldo", "Maior saldo é melhor ↑")}
      ${renderCardComparativo("Inadimplência", estadoInad?.media ?? 0, mediaNacionalInad, "inadimplencia", "Menor inadimplência é melhor ↓")}
      ${renderCardComparativo("Crescimento da Carteira", estadoVariacao?.media ?? 0, mediaNacionalVariacao, "variacao", "Maior crescimento é melhor ↑")}
    `;

    // 2. Renderiza o Insight (DENTRO do try, após os dados chegarem)
    if (insightContainer) {
      // Usamos o score que vem do cache do ranking ou calculamos uma lógica simples aqui
      const dadosCacheEstado = dadosCompletosCache.find(d => d.estado === estadoSelecionado);
      const scoreReal = dadosCacheEstado?.score ?? 0;
      const { texto, corClass } = getCategoria(scoreReal);

      const saldoVsMedia = ((estadoSaldo?.media ?? 0) / mediaNacionalSaldo - 1) * 100;
      const inadVsMedia  = ((estadoInad?.media  ?? 0) / mediaNacionalInad  - 1) * 100;
      const varVsMedia   = ((estadoVariacao?.media ?? 0) / mediaNacionalVariacao - 1) * 100;

      const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

      const pontosSaldo = saldoVsMedia >= 10
        ? `carteira de crédito <strong>${fmtPct(saldoVsMedia)} acima</strong> da média nacional`
        : saldoVsMedia <= -10
          ? `carteira de crédito <strong>${fmtPct(saldoVsMedia)} abaixo</strong> da média nacional`
          : `carteira de crédito alinhada à média nacional (${fmtPct(saldoVsMedia)})`;

      const pontosInad = inadVsMedia <= -10
        ? `inadimplência <strong>${fmtPct(Math.abs(inadVsMedia))} inferior</strong> à média, indicando portfólio mais saudável`
        : inadVsMedia >= 10
          ? `inadimplência <strong>${fmtPct(inadVsMedia)} superior</strong> à média, sinalizando risco elevado de default`
          : `inadimplência dentro da faixa nacional (${fmtPct(inadVsMedia)})`;

      const pontosVar = varVsMedia >= 5
        ? `crescimento da carteira em aceleração (<strong>${fmtPct(varVsMedia)} acima</strong> da média), sugerindo demanda aquecida`
        : varVsMedia <= -5
          ? `crescimento <strong>${fmtPct(varVsMedia)} abaixo</strong> da média, indicando retração ou mercado saturado`
          : `expansão de carteira em ritmo médio (${fmtPct(varVsMedia)})`;

      const temNegativo = inadVsMedia >= 10 || varVsMedia <= -5 || saldoVsMedia <= -10;

      const conclusao = corClass === "alta-oportunidade"
        ? `O conjunto dos indicadores posiciona <strong>${estadoSelecionado}</strong> como mercado prioritário para expansão de crédito no período analisado.`
        : corClass === "moderado"
          ? temNegativo
            ? `Apesar dos pontos de atenção acima, o score consolidado classifica <strong>${estadoSelecionado}</strong> como <strong>moderado</strong> — outros fatores como tendência histórica, estabilidade e penetração de mercado compensam parcialmente os riscos identificados.`
            : `<strong>${estadoSelecionado}</strong> apresenta perfil equilibrado — recomenda-se análise segmentada por produto antes de ampliar exposição.`
          : `Os indicadores de <strong>${estadoSelecionado}</strong> apontam para risco operacional elevado; expansão de crédito exige critérios mais restritivos.`;

      const textoInsight = `${estadoSelecionado} registra ${pontosSaldo}, com ${pontosInad} e ${pontosVar}. ${conclusao}`;
            insightContainer.innerHTML = renderPainelInsight(estadoSelecionado, textoInsight, texto, corClass);
          } 

  } catch (err) {
    container.innerHTML = `<p class="error">Erro ao carregar dados do estado</p>`;
    console.error(err);
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
  const resultados: DadosCompletosEstado[] = []; // ← linha que faltou
  
  for (const item of rankingData) {
    const { texto, corClass } = getCategoria(item.score);
    resultados.push({
      estado: item.uf,
      regiao: item.regiao,
      saldo: item.indicadores_brutos.saldo_ultimo_mes,
      inadimplencia: item.indicadores_brutos.inadimplencia,
      variacao: item.indicadores_brutos.tendencia_12m,
      score: item.score,
      categoria: texto,
      corCategoria: corClass
    });
  }

  return resultados; // ← e o return também
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
  
  const estadoSelecionado = (document.getElementById("estado-select-analises") as HTMLSelectElement)?.value ?? "";

  container.innerHTML = `
    <div class="tabela-ranking" tabindex="0" aria-label="Ranking de estados por score. Toque em uma linha para comparar.">
      <p class="ranking-info">Score: 30% Saldo + 40% Crescimento + 30% (1 - Inadimplência). Quanto maior, melhor a oportunidade.</p>
      <table>
        <thead>
          <tr>
            <th scope="col"><button type="button" class="th-sort-btn" data-sort="posicao" aria-label="Ordenar por posição">#</button></th>
            <th scope="col"><button type="button" class="th-sort-btn" data-sort="estado" aria-label="Ordenar por estado">Estado</button></th>
            <th scope="col"><button type="button" class="th-sort-btn align-right" data-sort="score" aria-label="Ordenar por score">Score</button></th>
            <th scope="col"><button type="button" class="th-sort-btn" data-sort="categoria" aria-label="Ordenar por categoria">Categoria</button></th>
            <th scope="col"><button type="button" class="th-sort-btn align-right" data-sort="saldo" aria-label="Ordenar por saldo">Saldo</button></th>
            <th scope="col"><button type="button" class="th-sort-btn align-right" data-sort="inadimplencia" aria-label="Ordenar por inadimplência">Inadimplência</button></th>
            <th scope="col"><button type="button" class="th-sort-btn align-right" data-sort="variacao" aria-label="Ordenar por variação">Variação</button></th>
          </tr>
        </thead>
        <tbody>
          ${dadosOrdenados.map((d, i) => {
            const isSelected = estadoSelecionado === d.estado;
            return `
              <tr class="${isSelected ? "selected" : ""}" data-estado="${d.estado}" tabindex="0" role="button" aria-label="Selecionar ${d.estado}, ${d.regiao}">
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

  const regiaoAtual = (document.getElementById("regiao-select-analises") as HTMLSelectElement)?.value || undefined;

  const ordenarPor = (coluna: string): void => {
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
    renderTabelaRanking(dadosCompletosCache, regiaoAtual);
  };

  const selecionarEstado = (estado: string): void => {
    const selectEstado = document.getElementById("estado-select-analises") as HTMLSelectElement;
    if (!selectEstado) return;
    selectEstado.value = estado;
    const { dataInicio, dataFim, regiao } = lerFiltros();
    renderCardsComparativos(estado, dataInicio, dataFim, regiao);
    renderGraficoHistoricoAnalises(regiao, dataInicio, dataFim, estado);
    renderTabelaRanking(dadosCompletosCache, regiao);
  };

  container.querySelectorAll<HTMLButtonElement>(".th-sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => ordenarPor(btn.dataset.sort ?? "score"));
  });

  container.querySelectorAll<HTMLTableRowElement>("tr[data-estado]").forEach((row) => {
    const uf = row.dataset.estado!;
    row.addEventListener("click", () => selecionarEstado(uf));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selecionarEstado(uf);
      }
    });
  });
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

    const dadosRankingMapa = rankingData.map(d => ({
      uf: d.uf,        
      estado: d.uf,
      regiao: d.regiao,
      score: d.score,
      posicao: d.posicao,
    }));

    const dadosCompletosEstado = processarRanking(rankingData);
    
    if (todosEstadosCache.length === 0) {
      todosEstadosCache = dadosCompletosEstado.map(d => ({ estado: d.estado, regiao: d.regiao }));
    }
    
    atualizarEstadosPorRegiao(regiaoFiltro || "");
    renderTabelaRanking(dadosCompletosEstado, regiaoFiltro);
    
    const estadoSelect = document.getElementById("estado-select-analises") as HTMLSelectElement;
    const estado = estadoSelect?.value || "";
    
    // Inicializa o mapa somente na primeira vez; depois reutiliza a instância
    const mapaContainer = document.getElementById("mapa-coropletico-container");
    if (mapaContainer) {
      if (!mapaCoroplético) {
        mapaContainer.innerHTML = "";
        mapaCoroplético = new MapaCoroplético({ containerId: "mapa-coropletico-container" });
      }
      await mapaCoroplético.render(dadosRankingMapa, regiaoFiltro, (uf) => {
        const select = document.getElementById("estado-select-analises") as HTMLSelectElement | null;
        if (!select) return;
        const existe = Array.from(select.options).some(o => o.value === uf);
        if (existe) {
          select.value = uf;
          select.dispatchEvent(new Event("change"));
        }
      });
    }

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
  // Destrói instâncias anteriores antes de reinicializar a página
  if (historicoChart) {
    historicoChart.destroy();
    historicoChart = null;
  }
  if (mapaCoroplético) {
    mapaCoroplético.destroy();
    mapaCoroplético = null;
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

  // Filtros que recarregam tudo (inclusive o mapa)
  selectRegiao.addEventListener("change", atualizarTudo);
  inputInicio.addEventListener("change", atualizarTudo);
  inputFim.addEventListener("change", atualizarTudo);

  selectEstado.addEventListener("change", atualizarCards);

  btnLimpar.addEventListener("click", () => {
    inputInicio.value  = "";
    inputFim.value     = "";
    selectRegiao.value = "";
    selectEstado.value = "";
    atualizarTudo();
  });
}
