import { getDadosPorEstadosPeriodo } from "../api/client";
import type { Regiao, ResumoEstado, TipoIndicador } from "../types";


function renderHome(): string {
  return `
    <header style="margin-bottom: 2rem;">
      <h1 style="font-size: 1.8rem;">Crédito Brasil</h1>
      <p style="color: #666; margin-top: 0.25rem;">Painel de indicadores de crédito por estado</p>
    </header>

    <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
      <div>
        <label for="tipo-select"><strong>Indicador:</strong></label>
        <select id="tipo-select" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem;">
          <option value="saldo">Saldo</option>
          <option value="inadimplencia">Inadimplência</option>
          <option value="variacao">Crescimento da carteira</option>
        </select>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <label for="regiao-select"><strong>Região:</strong></label>
        <select id="regiao-select" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem;">
          <option value="">Todas</option>
          <option value="Norte">Norte</option>
          <option value="Nordeste">Nordeste</option>
          <option value="Centro-Oeste">Centro-Oeste</option>
          <option value="Sudeste">Sudeste</option>
          <option value="Sul">Sul</option>
        </select>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <label for="data-inicio"><strong>De:</strong></label>
        <input type="date" id="data-inicio" style="padding: 0.25rem 0.5rem;" />
        <label for="data-fim"><strong>Até:</strong></label>
        <input type="date" id="data-fim" style="padding: 0.25rem 0.5rem;" />
        <button id="btn-limpar" style="
          padding: 0.25rem 0.75rem;
          background: transparent;
          color: #666;
          border: 1px solid #ccc;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">Limpar</button>
      </div>
    </div>

    <section id="cards" style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    ">
      <p class="loading">Carregando cards...</p>
    </section>

    <section style="background: #fff; border-radius: 8px; padding: 1.5rem;">
      <h2 style="font-size: 1.1rem; margin-bottom: 1rem;">Ranking dos estados</h2>
      <div id="ranking">
        <p class="loading">Carregando ranking...</p>
      </div>
    </section>
  `;
}

let rankingExpandido = false;

function renderCards(dados: ResumoEstado[], tipo: TipoIndicador): void {
  const mediaNacional = dados.reduce((acc, d) => acc + d.media, 0) / dados.length;

  const valorPrincipal = tipo === "saldo"
    ? dados.reduce((acc, d) => acc + d.total, 0)
    : mediaNacional;

  const labelPrincipal = tipo === "saldo"
    ? "Total nacional"
    : tipo === "variacao"
      ? "Crescimento médio mensal"
      : "Média nacional";

  const container = document.getElementById("cards")!;

  if (tipo === "saldo") {
    const maiorSaldo = [...dados].sort((a, b) => b.media - a.media)[0];
    container.innerHTML = `
      ${card(labelPrincipal,     formatarValor(valorPrincipal, tipo),                               "#f8dd73")}
      ${card("Média por estado", formatarValor(mediaNacional, tipo),                              "#f89997")}
      ${card("Maior estado",     `${maiorSaldo.estado} — ${formatarValor(maiorSaldo.media, tipo)}`, "#6ae098")}
    `;
  } else {
    const dadosOrdenados = [...dados].sort((a, b) => b.media - a.media);
    const maiorEstado    = dadosOrdenados[0];
    const menorEstado    = dadosOrdenados[dadosOrdenados.length - 1];
    const labelMaior = tipo === "variacao" ? "Maior crescimento" : "Maior estado";
    const labelMenor = tipo === "variacao" ? "Menor crescimento" : "Menor estado";

    container.innerHTML = `
      ${card(labelPrincipal, formatarValor(valorPrincipal, tipo),                                 "#f8dd73")}
      ${card(labelMaior,     `${maiorEstado.estado} — ${formatarValor(maiorEstado.media, tipo)}`, "#f89997")}
      ${card(labelMenor,     `${menorEstado.estado} — ${formatarValor(menorEstado.media, tipo)}`, "#6ae098")}
    `;
  }
}

function renderRanking(dados: ResumoEstado[], tipo: TipoIndicador): void {
  const container = document.getElementById("ranking")!;

  const dadosOrdenados = [...dados].sort((a, b) => b.media - a.media);
  const limite = rankingExpandido ? dadosOrdenados.length : 10;
  
  const valorMaximo = Math.max(...dadosOrdenados.map(d => Math.abs(d.media)));

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      ${dadosOrdenados
        .slice(0, limite)
        .map(
          (d, i) => {
            const valor = d.media;
            const percentual = (Math.abs(valor) / valorMaximo) * 100;
            const corBarra = valor >= 0 ? "#9ae1b6" : "#c26d67";
            
            return `
              <div style="display: flex; align-items: center; gap: 1rem;">
                <span style="min-width: 180px;">
                  <strong style="color: #888; margin-right: 0.5rem;">${i + 1}.</strong>
                  ${d.estado}
                  <span style="color: #aaa; font-size: 0.85rem;"> (${d.regiao})</span>
                </span>
                <div style="flex: 1; background: #e0e0e0; border-radius: 4px; height: 28px; overflow: hidden;">
                  <div style="
                    width: ${percentual}%;
                    background: ${corBarra};
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding-right: 8px;
                    color: white;
                    font-size: 0.75rem;
                    font-weight: bold;
                  "></div>
                </div>
                <span style="min-width: 100px; text-align: right; font-weight: bold;">${formatarValor(valor, tipo)}</span>
              </div>
            `;
          }
        )
        .join("")}
    </div>

    ${
      dadosOrdenados.length > 10
        ? `
        <div style="text-align: center; margin-top: 1.5rem;">
          <button id="btn-toggle-ranking" style="
            padding: 0.4rem 0.8rem;
            background: transparent;
            border: 1px solid #ccc;
            border-radius: 6px;
            cursor: pointer;
          ">
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

function card(titulo: string, valor: string, bg: string): string {
  return `
    <div style="
      background: ${bg};
      border-radius: 8px;
      padding: 1.25rem;
      border: 1px solid #e0e0e0;
    ">
      <p style="font-size: 0.8rem; margin-bottom: 0.4rem;">${titulo}</p>
      <p style="font-size: 1.1rem; font-weight: bold;">${valor}</p>
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
    const dados = await getDadosPorEstadosPeriodo(tipo, dataInicio, dataFim, regiao);
    renderCards(dados, tipo);
    renderRanking(dados, tipo);
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
