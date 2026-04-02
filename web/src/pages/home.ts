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


function renderRanking(dados: ResumoEstado[], tipo: TipoIndicador): void {
  const container = document.getElementById("ranking")!;

  const dadosOrdenados = [...dados].sort((a, b) => b.media - a.media);

  const limite = rankingExpandido ? dadosOrdenados.length : 10;

  container.innerHTML = `
    <ol style="list-style: none; padding: 0;">
      ${dadosOrdenados
        .slice(0, limite)
        .map(
          (d, i) => `
          <li style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.6rem 0;
            border-bottom: 1px solid #eee;
          ">
            <span>
              <strong style="color: #888; margin-right: 0.5rem;">${i + 1}.</strong>
              ${d.estado}
              <span style="color: #aaa; font-size: 0.85rem;"> (${d.regiao})</span>
            </span>
            <span style="font-weight: bold;">${formatarValor(d.media, tipo)}</span>
          </li>
        `
        )
        .join("")}
    </ol>

    ${
      dadosOrdenados.length > 10
        ? `
        <div style="text-align: center; margin-top: 1rem;">
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
  const ranking = document.getElementById("ranking")!;
  ranking.innerHTML = `<p class="loading">Carregando...</p>`;
  rankingExpandido = false;

  try {
    const dados = await getDadosPorEstadosPeriodo(tipo, dataInicio, dataFim, regiao);
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

  // Ao trocar o indicador, mantém o período atual
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

  // Ao clicar em Limpar, reseta datas e recarrega sem filtro
  btnLimpar.addEventListener("click", () => {
    inputInicio.value = "";
    inputFim.value    = "";
    selectRegiao.value = "";
    carregarDados(select.value as TipoIndicador);
  });
}