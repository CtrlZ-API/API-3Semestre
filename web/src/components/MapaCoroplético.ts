import * as d3 from "d3";
import type { ItemRanking } from "../types";

// URL pública do GeoJSON de estados brasileiros (IBGE via raw.githubusercontent)
const GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

export interface OpcoesMapaCoroplético {
  containerId: string;
}

/**
 * MapaCoroplético — mapa do Brasil colorido por score de oportunidade (0-100).
 * Mesmo padrão de classe de HistoricoChart: instancie, chame render(), destrua com destroy().
 */
export class MapaCoroplético {
  private container: HTMLElement;
  private svgEl: SVGSVGElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private mapaG: d3.Selection<SVGGElement, unknown, null, undefined>;
  private legendaG: d3.Selection<SVGGElement, unknown, null, undefined>;
  private tooltip: HTMLDivElement;
  private resizeObserver: ResizeObserver;

  // GeoJSON em cache (carregado uma única vez)
  private geoCache: GeoJSON.FeatureCollection | null = null;

  // Dados e região filtrada atuais
  private dadosAtuais: ItemRanking[] = [];
  private regiaoAtiva: string | undefined;

  // Mapeamento UF → região (para o filtro de opacidade)
  private static readonly UF_PARA_REGIAO: Record<string, string> = {
    AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
    AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
    PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
    DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
    ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
    PR: "Sul", RS: "Sul", SC: "Sul",
  };

  // Mapeamento nome do GeoJSON → sigla UF
  private static readonly NOME_GEOJSON_PARA_UF: Record<string, string> = {
    "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
    "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES",
    "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
    "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
    "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
    "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC",
    "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO",
  };

  constructor(opcoes: OpcoesMapaCoroplético) {
    const el = document.getElementById(opcoes.containerId);
    if (!el) throw new Error(`Container #${opcoes.containerId} não encontrado.`);
    this.container = el;

    // SVG principal
    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svgEl.style.width = "100%";
    this.svgEl.style.display = "block";
    this.container.appendChild(this.svgEl);

    this.svg = d3.select(this.svgEl);
    this.mapaG   = this.svg.append("g").attr("class", "mapa-estados");
    this.legendaG = this.svg.append("g").attr("class", "mapa-legenda-g");

    // Tooltip HTML (flutuante)
    this.tooltip = document.createElement("div");
    this.tooltip.className = "mapa-tooltip";
    this.tooltip.style.display = "none";
    this.container.appendChild(this.tooltip);

    // Responsividade
    this.resizeObserver = new ResizeObserver(() => this.desenhar());
    this.resizeObserver.observe(this.container);
  }

  /** Renderiza ou re-renderiza o mapa com novos dados e/ou filtro de região. */
  public async render(dados: ItemRanking[], regiaoFiltro?: string): Promise<void> {
    this.dadosAtuais = dados;
    this.regiaoAtiva = regiaoFiltro || undefined;

    if (!this.geoCache) {
      this.mapaG.selectAll("*").remove();
      this.mapaG.append("text")
        .attr("class", "loading-geo")
        .attr("x", "50%").attr("y", "50%")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", "#888").style("font-size", "13px")
        .text("Carregando geometria dos estados...");

      try {
        const geo = await d3.json<GeoJSON.FeatureCollection>(GEOJSON_URL);
        if (!geo) throw new Error("GeoJSON vazio");
        this.geoCache = geo;
      } catch {
        this.mapaG.selectAll("*").remove();
        this.mapaG.append("text")
          .attr("class", "loading-geo")
          .attr("x", "50%").attr("y", "50%")
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .style("fill", "#c00").style("font-size", "13px")
          .text("Não foi possível carregar o mapa geográfico.");
        return;
      }
    }

    this.desenhar();
  }

  /** Redesenha o mapa (chamado em render() e no resize). */
  private desenhar(): void {
    if (!this.geoCache || this.dadosAtuais.length === 0) return;

    this.mapaG.selectAll("text.loading-geo").remove();

    const largura  = this.container.clientWidth  || 600;
    const alturaGeo = Math.min(300, Math.max(220, largura * 0.45));
    const alturaLegenda = 52;
    const altura   = alturaGeo + alturaLegenda;

    this.svg.attr("viewBox", `0 0 ${largura} ${altura}`)
            .attr("height", altura);

    // Projeção Mercator ajustada ao container
    const projecao = d3.geoMercator().fitSize([largura, alturaGeo], this.geoCache);
    const caminhoGeo = d3.geoPath().projection(projecao);

    // Escala de cores sequencial (0=cinza claro → 100=azul escuro)
    const escalaCor = d3.scaleSequential(d3.interpolateBlues).domain([0, 100]);

    // Índice UF → score para lookup rápido
    const scoresPorUF = new Map<string, ItemRanking>(
      this.dadosAtuais.map(d => [d.uf, d])
    );

    // Desenha estados
    this.mapaG.selectAll<SVGPathElement, GeoJSON.Feature>("path")
      .data(this.geoCache.features, (d: GeoJSON.Feature) =>
        (d.properties?.sigla || d.properties?.name || "") as string
      )
      .join(
        enter => enter.append("path"),
        update => update,
        exit   => exit.remove()
      )
      .attr("d", caminhoGeo as any)
      .attr("fill", (feat) => {
        const uf = this.resolverUF(feat);
        const item = uf ? scoresPorUF.get(uf) : undefined;
        return item ? escalaCor(item.score) : "#e0e0e0";
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.8)
      .attr("opacity", (feat) => {
        if (!this.regiaoAtiva) return 1;
        const uf = this.resolverUF(feat);
        if (!uf) return 0.25;
        const regiaoEstado = MapaCoroplético.UF_PARA_REGIAO[uf];
        return regiaoEstado === this.regiaoAtiva ? 1 : 0.22;
      })
      .style("cursor", "pointer")
      .style("transition", "opacity 0.3s ease, fill 0.3s ease")
      .on("mousemove", (evento, feat) => this.mostrarTooltip(evento, feat, scoresPorUF))
      .on("mouseleave", () => this.esconderTooltip());

    this.desenharLegenda(largura, alturaGeo, escalaCor);
  }

  /** Resolve a sigla UF a partir da feature GeoJSON. */
  private resolverUF(feat: GeoJSON.Feature): string | undefined {
    const props = feat.properties ?? {};
    // Tenta propriedades comuns de datasets públicos brasileiros
    const sigla: string =
      props["sigla"] ||
      props["uf"]    ||
      props["UF"]    ||
      MapaCoroplético.NOME_GEOJSON_PARA_UF[props["name"] || ""] ||
      MapaCoroplético.NOME_GEOJSON_PARA_UF[props["nome"] || ""] ||
      "";
    return sigla || undefined;
  }

  /** Exibe o tooltip com nome, UF e score. */
  private mostrarTooltip(
    evento: MouseEvent,
    feat: GeoJSON.Feature,
    scoresPorUF: Map<string, ItemRanking>
  ): void {
    const uf   = this.resolverUF(feat);
    const item = uf ? scoresPorUF.get(uf) : undefined;
    const nome = feat.properties?.name || feat.properties?.nome || uf || "—";
    const score = item ? item.score.toFixed(1) : "—";
    const icone = item ? (item.score >= 70 ? "↑" : item.score >= 40 ? "~" : "↓") : "";
    const corScore = item ? (item.score >= 70 ? "#22c55e" : item.score >= 40 ? "#f59e0b" : "#ef4444") : "#888";

    this.tooltip.innerHTML = `
      <strong>${nome}</strong> <span style="color:#888;font-size:0.8em">${uf ?? ""}</span><br/>
      Score: <strong style="color:${corScore}">${score} ${icone}</strong>
      ${item?.regiao ? `<br/><span style="font-size:0.8em;color:#888">${item.regiao}</span>` : ""}
    `;
    this.tooltip.style.display = "block";

    // Posiciona relativo ao container
    const rect = this.container.getBoundingClientRect();
    let x = evento.clientX - rect.left + 12;
    let y = evento.clientY - rect.top  - 12;

    // Evita que o tooltip saia pela direita
    if (x + 180 > this.container.clientWidth) x -= 200;

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top  = `${y}px`;
  }

  private esconderTooltip(): void {
    this.tooltip.style.display = "none";
  }

  /** Desenha a barra de legenda de gradiente abaixo do mapa. */
  private desenharLegenda(
    largura: number,
    offsetY: number,
    escalaCor: d3.ScaleSequential<string>
  ): void {
    this.legendaG.selectAll("*").remove();

    const barraLargura = Math.min(240, largura * 0.4);
    const barraAltura  = 12;
    const x0 = (largura - barraLargura) / 2;
    const y0 = offsetY + 16;

    // Gradiente LinearGradient no defs
    const gradId = "mapa-gradiente-legenda";
    let defs = this.svg.select<SVGDefsElement>("defs");
    if (defs.empty()) defs = this.svg.append("defs");
    defs.selectAll(`#${gradId}`).remove();

    const grad = defs.append("linearGradient")
      .attr("id", gradId)
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");

    d3.range(0, 101, 10).forEach(v => {
      grad.append("stop")
        .attr("offset", `${v}%`)
        .attr("stop-color", escalaCor(v));
    });

    // Barra de cor
    this.legendaG.append("rect")
      .attr("x", x0).attr("y", y0)
      .attr("width", barraLargura).attr("height", barraAltura)
      .attr("rx", 4)
      .attr("fill", `url(#${gradId})`);

    // Rótulos
    const estiloTexto = (sel: d3.Selection<SVGTextElement, unknown, null, undefined>) =>
      sel.style("font-size", "11px").style("fill", "#555");

    estiloTexto(
      this.legendaG.append("text")
        .attr("x", x0).attr("y", y0 + barraAltura + 14)
        .attr("text-anchor", "start")
    ).text("Baixo score");

    estiloTexto(
      this.legendaG.append("text")
        .attr("x", x0 + barraLargura / 2).attr("y", y0 + barraAltura + 14)
        .attr("text-anchor", "middle")
    ).text("Score de oportunidade");

    estiloTexto(
      this.legendaG.append("text")
        .attr("x", x0 + barraLargura).attr("y", y0 + barraAltura + 14)
        .attr("text-anchor", "end")
    ).text("Alto score");
  }

  /** Libera recursos — chame ao desmontar a página. */
  public destroy(): void {
    this.resizeObserver.disconnect();
    this.tooltip.remove();
    this.svgEl.remove();
  }
}
