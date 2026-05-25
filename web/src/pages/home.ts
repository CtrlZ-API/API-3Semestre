import { getDadosPorEstadosPeriodo } from "../api/client";
import type { Regiao, ResumoEstado, TipoIndicador } from "../types";


function renderHome(): string {
  return `
    <header class="home-header">
      <h1>Crédito Brasil</h1>
      <p>Painel de indicadores de crédito por estado</p>
    </header>

    <div class="home-filtros">
      <label for="tipo-select"><strong>Indicador:</strong>
        <select id="tipo-select">
          <option value="saldo">Saldo</option>
          <option value="inadimplencia">Inadimplência</option>
          <option value="variacao">Crescimento da carteira</option>
        </select>
      </label>
      <label for="regiao-select"><strong>Região:</strong>
        <select id="regiao-select">
          <option value="">Todas</option>
          <option value="Norte">Norte</option>
          <option value="Nordeste">Nordeste</option>
          <option value="Centro-Oeste">Centro-Oeste</option>
          <option value="Sudeste">Sudeste</option>
          <option value="Sul">Sul</option>
        </select>
      </label>
      <div class="filtro-datas">
        <label for="data-inicio"><strong>De:</strong>
          <input type="date" id="data-inicio" />
        </label>
        <label for="data-fim"><strong>Até:</strong>
          <input type="date" id="data-fim" />
        </label>
        <button type="button" id="btn-limpar">Limpar</button>
      </div>
    </div>

    <section id="cards" class="home-cards">
      <p class="loading">Carregando cards...</p>
    </section>

    <section class="home-ranking-section">
      <h2>Ranking dos estados</h2>
      <div id="ranking">
        <p class="loading">Carregando ranking...</p>
      </div>
    </section>
  `;
}

let rankingExpandido = false;

function renderCards(dados: ResumoEstado[], tipo: TipoIndicador): void {
  const mediaNacional = dados.reduce((acc, d) => acc + d.total, 0) / dados.length;

  const valorPrincipal = tipo === "saldo"
    ? dados.reduce((acc, d) => acc + d.total, 0)
    : mediaNacional;

  const labelPrincipal = tipo === "saldo"
    ? "Total"
    : tipo === "variacao"
      ? "Crescimento médio mensal"
      : "Inadimplência Média";

  const container = document.getElementById("cards")!;

  if (tipo === "saldo") {
    const maiorSaldo = [...dados].sort((a, b) => b.total - a.total)[0];
    container.innerHTML = `
      ${card(labelPrincipal,     formatarValor(valorPrincipal, tipo),                               "#f8dd73")}
      ${card("Média por estado", formatarValor(mediaNacional, tipo),                              "#f89997")}
      ${card("Maior estado", `${maiorSaldo.estado} — ${formatarValor(maiorSaldo.total, tipo)}`, "#6ae098")}
    `;
  } else {
    const dadosOrdenados = [...dados].sort((a, b) => b.total - a.total);
    const maiorEstado    = dadosOrdenados[0];
    const menorEstado    = dadosOrdenados[dadosOrdenados.length - 1];
    const labelMaior = tipo === "variacao" ? "Maior crescimento" : "Maior estado";
    const labelMenor = tipo === "variacao" ? "Menor crescimento" : "Menor estado";

    container.innerHTML = `
      ${card(labelPrincipal, formatarValor(valorPrincipal, tipo),                                 "#f8dd73")}
      ${card(labelMaior, `${maiorEstado.estado} — ${formatarValor(maiorEstado.total, tipo)}`, "#f89997")}
      ${card(labelMenor, `${menorEstado.estado} — ${formatarValor(menorEstado.total, tipo)}`, "#6ae098")
}
    `;
  }
}

function renderRanking(dados: ResumoEstado[], tipo: TipoIndicador): void {
  const container = document.getElementById("ranking")!;

  const dadosOrdenados = [...dados].sort((a, b) => b.total - a.total);
  const limite = rankingExpandido ? dadosOrdenados.length : 10;
  
  const valorMaximo = Math.max(...dadosOrdenados.map(d => Math.abs(d.total)));

  container.innerHTML = `
    <div class="ranking-lista">
      ${dadosOrdenados
        .slice(0, limite)
        .map(
          (d, i) => {
            const valor = d.total;
            const percentual = (Math.abs(valor) / valorMaximo) * 100;
            const corBarra = valor >= 0 ? "#9ae1b6" : "#c26d67";

            return `
              <div class="ranking-item">
                <span class="ranking-item-label">
                  <strong>${i + 1}.</strong>
                  ${d.estado}
                  <span class="regiao"> (${d.regiao})</span>
                </span>
                <div class="ranking-item-barra-wrap">
                  <div class="ranking-item-barra" style="width: ${percentual}%; background: ${corBarra};"></div>
                </div>
                <span class="ranking-item-valor">${formatarValor(valor, tipo)}</span>
              </div>
            `;
          }
        )
        .join("")}
    </div>

    ${
      dadosOrdenados.length > 10
        ? `
        <div class="ranking-toggle-wrap">
          <button type="button" id="btn-toggle-ranking">
            ${rankingExpandido ? "Ver menos" : "Ver mais"}
          </button>
        </div>
      `
        : ""
    }
  `;

  const btn = document.getElementById("btn-toggle-ranking");
  if (btn) {
    btn.addEventListener("click", () => {
      rankingExpandido = !rankingExpandido;
      renderRanking(dados, tipo);
    });
  }
}

function card(titulo: string, valor: string, accentColor: string): string {
  return `
    <div class="home-card" style="--accent: ${accentColor};">
      <p class="home-card-titulo">${titulo}</p>
      <p class="home-card-valor">${valor}</p>
    </div>
  `;
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



async function carregarDados(tipo: TipoIndicador, dataInicio?: string, dataFim?: string, regiao?: Regiao): Promise<void> {
  const cards   = document.getElementById("cards")!;
  const ranking = document.getElementById("ranking")!;
  
  cards.innerHTML   = `<p class="loading">Carregando...</p>`;
  ranking.innerHTML = `<p class="loading">Carregando...</p>`;
  
  rankingExpandido = false;

  try {
    const dadosEstados = await getDadosPorEstadosPeriodo(tipo, dataInicio, dataFim, regiao);

    if (dadosEstados.length === 0) {
      cards.innerHTML = `<p class="error" style="color: #666;">Nenhum dado encontrado para o período selecionado.</p>`;
      ranking.innerHTML = `<p class="error" style="color: #666;">Nenhum dado encontrado para o período selecionado.</p>`;
    } else {
      renderCards(dadosEstados, tipo);
      renderRanking(dadosEstados, tipo);
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    cards.innerHTML = `<p class="error">${msg}</p>`;
  }
}

function lerFiltros(): { tipo: TipoIndicador; dataInicio?: string; dataFim?: string; regiao?: Regiao; } {
  const tipo      = (document.getElementById("tipo-select") as HTMLSelectElement).value as TipoIndicador;
  const dataInicio = (document.getElementById("data-inicio") as HTMLInputElement).value || undefined;
  const dataFim    = (document.getElementById("data-fim")    as HTMLInputElement).value || undefined;
  const regiao = (document.getElementById("regiao-select") as HTMLSelectElement).value as Regiao || undefined;
  return { tipo, dataInicio, dataFim, regiao };
}

export async function renderizarHome(container: HTMLElement): Promise<void> {
  container.innerHTML = renderHome();

  await carregarDados("saldo");


  const select   = document.getElementById("tipo-select") as HTMLSelectElement;
  const btnLimpar  = document.getElementById("btn-limpar")  as HTMLButtonElement;
  const inputInicio = document.getElementById("data-inicio") as HTMLInputElement;
  const inputFim    = document.getElementById("data-fim")    as HTMLInputElement;
  const selectRegiao = document.getElementById("regiao-select") as HTMLSelectElement;

  select.addEventListener("change", () => {
    const { tipo, dataInicio, dataFim, regiao } = lerFiltros();
    carregarDados(tipo, dataInicio, dataFim, regiao);
  });

  selectRegiao.addEventListener("change", () => {
  const { tipo, dataInicio, dataFim, regiao } = lerFiltros();
  carregarDados(tipo, dataInicio, dataFim, regiao);
  });

  inputInicio.addEventListener("change", () => {
    const { tipo, dataInicio, dataFim, regiao } = lerFiltros();
    carregarDados(tipo, dataInicio, dataFim, regiao);
  });

  inputFim.addEventListener("change", () => {
    const { tipo, dataInicio, dataFim, regiao } = lerFiltros();
    carregarDados(tipo, dataInicio, dataFim, regiao);
  });

  btnLimpar.addEventListener("click", () => {
    inputInicio.value = "";
    inputFim.value    = "";
    selectRegiao.value = "";
    carregarDados(select.value as TipoIndicador);
  });
}
