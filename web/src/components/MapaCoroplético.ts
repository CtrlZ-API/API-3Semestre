import * as d3 from "d3";
import type { ItemRanking } from "../types";

const GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

export interface OpcoesMapaCoroplético {
  containerId: string;
}

/**
 * MapaCoroplético — mapa do Brasil colorido por score de oportunidade (0-100).
 */
export class MapaCoroplético {
  private container: HTMLElement;
  private svgEl: SVGSVGElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private mapaG: d3.Selection<SVGGElement, unknown, null, undefined>;
  private legendaG: d3.Selection<SVGGElement, unknown, null, undefined>;
  private tooltip: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private resizeRaf: number | null = null;

  private geoCache: GeoJSON.FeatureCollection | null = null;
  private dadosAtuais: ItemRanking[] = [];
  private regiaoAtiva: string | undefined;
  private onEstadoClick?: (uf: string) => void;
  private ufSelecionada: string | null = null;

  private static readonly UF_PARA_REGIAO: Record<string, string> = {
    AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
    AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
    PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
    DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
    ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
    PR: "Sul", RS: "Sul", SC: "Sul",
  };

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

    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svgEl.style.width = "100%";
    this.svgEl.style.height = "auto";
    this.svgEl.style.display = "block";
    this.svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svgEl.setAttribute("role", "img");
    this.svgEl.setAttribute("aria-label", "Mapa do Brasil por score de oportunidade de crédito");
    this.container.appendChild(this.svgEl);

    this.svg = d3.select(this.svgEl);
    this.mapaG = this.svg.append("g").attr("class", "mapa-estados");
    this.legendaG = this.svg.append("g").attr("class", "mapa-legenda-g");

    this.tooltip = document.createElement("div");
    this.tooltip.className = "mapa-tooltip";
    this.tooltip.setAttribute("role", "status");
    this.tooltip.setAttribute("aria-live", "polite");
    this.tooltip.style.display = "none";
    this.container.appendChild(this.tooltip);

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeRaf !== null) cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = null;
        this.desenhar();
      });
    });
    this.resizeObserver.observe(this.container);

    this.container.addEventListener("pointerdown", (e) => {
      if (e.target === this.container || e.target === this.svgEl) {
        this.ufSelecionada = null;
        this.atualizarDestaqueEstados();
        this.esconderTooltip();
      }
    });
  }

  public async render(
    dados: ItemRanking[],
    regiaoFiltro?: string,
    onEstadoClick?: (uf: string) => void
  ): Promise<void> {
    this.dadosAtuais = dados;
    this.regiaoAtiva = regiaoFiltro || undefined;
    this.onEstadoClick = onEstadoClick;

    if (!this.geoCache) {
      this.mapaG.selectAll("*").remove();
      const largura = Math.max(1, this.container.clientWidth);
      this.svg.attr("viewBox", `0 0 ${largura} 200`);
      this.mapaG.append("text")
        .attr("class", "loading-geo")
        .attr("x", largura / 2)
        .attr("y", 100)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", "#888")
        .style("font-size", "13px")
        .text("Carregando geometria dos estados...");

      try {
        const geo = await d3.json<GeoJSON.FeatureCollection>(GEOJSON_URL);
        if (!geo) throw new Error("GeoJSON vazio");
        this.geoCache = geo;
      } catch {
        this.mapaG.selectAll("*").remove();
        this.mapaG.append("text")
          .attr("class", "loading-geo")
          .attr("x", largura / 2)
          .attr("y", 100)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .style("fill", "#c00")
          .style("font-size", "13px")
          .text("Não foi possível carregar o mapa geográfico.");
        return;
      }
    }

    this.desenhar();
  }

  private obterDimensoes(): { largura: number; alturaGeo: number; alturaLegenda: number; altura: number } {
    const rect = this.container.getBoundingClientRect();
    const largura = Math.max(1, rect.width || this.container.clientWidth || 320);
    const aspectRatio = largura < 400 ? 0.72 : largura < 768 ? 0.58 : 0.45;
    const alturaGeo = Math.min(largura < 400 ? 200 : 320, Math.max(160, largura * aspectRatio));
    const alturaLegenda = largura < 400 ? 44 : 52;
    return { largura, alturaGeo, alturaLegenda, altura: alturaGeo + alturaLegenda };
  }

  private desenhar(): void {
    if (!this.geoCache || this.dadosAtuais.length === 0) return;

    this.mapaG.selectAll("text.loading-geo").remove();

    const { largura, alturaGeo, altura } = this.obterDimensoes();

    this.svg
      .attr("viewBox", `0 0 ${largura} ${altura}`)
      .attr("width", "100%")
      .attr("height", altura);

    const padding = largura < 400 ? 4 : 8;
    const projecao = d3.geoMercator().fitExtent(
      [[padding, padding], [largura - padding, alturaGeo - padding]],
      this.geoCache
    );
    const caminhoGeo = d3.geoPath().projection(projecao);

    const escalaCor = d3.scaleSequential(d3.interpolateBlues).domain([0, 100]);
    const scoresPorUF = new Map<string, ItemRanking>(
      this.dadosAtuais.map(d => [d.uf, d])
    );

    const paths = this.mapaG.selectAll<SVGPathElement, GeoJSON.Feature>("path")
      .data(this.geoCache.features, (d: GeoJSON.Feature) =>
        (d.properties?.sigla || d.properties?.name || "") as string
      )
      .join(
        enter => enter.append("path"),
        update => update,
        exit => exit.remove()
      );

    paths
      .attr("d", caminhoGeo as d3.ValueFn<SVGPathElement, GeoJSON.Feature, string | null>)
      .attr("fill", (feat) => {
        const uf = this.resolverUF(feat);
        const item = uf ? scoresPorUF.get(uf) : undefined;
        return item ? escalaCor(item.score) : "#e0e0e0";
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", (feat) => {
        const uf = this.resolverUF(feat);
        return uf && uf === this.ufSelecionada ? 2.2 : 0.8;
      })
      .attr("opacity", (feat) => {
        if (!this.regiaoAtiva) return 1;
        const uf = this.resolverUF(feat);
        if (!uf) return 0.25;
        const regiaoEstado = MapaCoroplético.UF_PARA_REGIAO[uf];
        return regiaoEstado === this.regiaoAtiva ? 1 : 0.22;
      })
      .attr("class", (feat) => {
        const uf = this.resolverUF(feat);
        return uf && uf === this.ufSelecionada ? "estado-selecionado" : "";
      })
      .style("cursor", "pointer")
      .style("touch-action", "manipulation")
      .style("transition", "opacity 0.3s ease, fill 0.3s ease, stroke-width 0.15s ease")
      .on("pointerenter", (evento, feat) => {
        if (evento.pointerType === "mouse") {
          this.mostrarTooltip(evento, feat, scoresPorUF);
        }
      })
      .on("pointermove", (evento, feat) => {
        if (evento.pointerType === "mouse" || evento.pressure > 0) {
          this.mostrarTooltip(evento, feat, scoresPorUF);
        }
      })
      .on("pointerleave", (evento) => {
        if (evento.pointerType === "mouse") {
          this.esconderTooltip();
        }
      })
      .on("pointerdown", (evento, feat) => {
        (evento.currentTarget as SVGPathElement).setPointerCapture(evento.pointerId);
        this.mostrarTooltip(evento, feat, scoresPorUF);
      })
      .on("pointerup", (evento, feat) => {
        (evento.currentTarget as SVGPathElement).releasePointerCapture(evento.pointerId);
        const uf = this.resolverUF(feat);
        if (uf) {
          this.ufSelecionada = uf;
          this.atualizarDestaqueEstados();
          this.onEstadoClick?.(uf);
        }
        if (evento.pointerType !== "mouse") {
          this.mostrarTooltip(evento, feat, scoresPorUF);
        }
      })
      .on("click", (evento, feat) => {
        evento.preventDefault();
        const uf = this.resolverUF(feat);
        if (uf) {
          this.ufSelecionada = uf;
          this.atualizarDestaqueEstados();
          this.onEstadoClick?.(uf);
        }
      });

    this.desenharLegenda(largura, alturaGeo, escalaCor);
  }

  private atualizarDestaqueEstados(): void {
    this.mapaG.selectAll<SVGPathElement, GeoJSON.Feature>("path")
      .attr("stroke-width", (feat) => {
        const uf = this.resolverUF(feat);
        return uf && uf === this.ufSelecionada ? 2.2 : 0.8;
      })
      .attr("class", (feat) => {
        const uf = this.resolverUF(feat);
        return uf && uf === this.ufSelecionada ? "estado-selecionado" : "";
      });
  }

  private resolverUF(feat: GeoJSON.Feature): string | undefined {
    const props = feat.properties ?? {};
    const sigla: string =
      props["sigla"] ||
      props["uf"] ||
      props["UF"] ||
      MapaCoroplético.NOME_GEOJSON_PARA_UF[props["name"] || ""] ||
      MapaCoroplético.NOME_GEOJSON_PARA_UF[props["nome"] || ""] ||
      "";
    return sigla || undefined;
  }

  private mostrarTooltip(
    evento: PointerEvent,
    feat: GeoJSON.Feature,
    scoresPorUF: Map<string, ItemRanking>
  ): void {
    const uf = this.resolverUF(feat);
    const item = uf ? scoresPorUF.get(uf) : undefined;
    const nome = feat.properties?.name || feat.properties?.nome || uf || "—";
    const score = item ? item.score.toFixed(1) : "—";
    const icone = item ? (item.score >= 53 ? "↑" : item.score >= 40 ? "~" : "↓") : "";
    const corScore = item ? (item.score >= 53 ? "#22c55e" : item.score >= 40 ? "#f59e0b" : "#ef4444") : "#888";

    this.tooltip.innerHTML = `
      <strong>${nome}</strong> <span style="color:#888;font-size:0.8em">${uf ?? ""}</span><br/>
      Score: <strong style="color:${corScore}">${score} ${icone}</strong>
      ${item?.regiao ? `<br/><span style="font-size:0.8em;color:#888">${item.regiao}</span>` : ""}
    `;
    this.tooltip.style.display = "block";

    const rect = this.container.getBoundingClientRect();
    const tooltipW = Math.min(200, rect.width * 0.9);
    let x = evento.clientX - rect.left + 12;
    let y = evento.clientY - rect.top - 12;

    if (x + tooltipW > rect.width) x = Math.max(8, x - tooltipW - 24);
    if (y < 8) y = 8;
    if (y + 80 > rect.height) y = Math.max(8, rect.height - 88);

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  private esconderTooltip(): void {
    this.tooltip.style.display = "none";
  }

  private desenharLegenda(
    largura: number,
    offsetY: number,
    escalaCor: d3.ScaleSequential<string>
  ): void {
    this.legendaG.selectAll("*").remove();

    const barraLargura = Math.min(largura < 400 ? largura - 32 : 240, largura * 0.85);
    const barraAltura = largura < 400 ? 10 : 12;
    const x0 = (largura - barraLargura) / 2;
    const y0 = offsetY + (largura < 400 ? 10 : 16);
    const fontSize = largura < 400 ? "9px" : "11px";

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

    this.legendaG.append("rect")
      .attr("x", x0).attr("y", y0)
      .attr("width", barraLargura).attr("height", barraAltura)
      .attr("rx", 4)
      .attr("fill", `url(#${gradId})`);

    const estiloTexto = (sel: d3.Selection<SVGTextElement, unknown, null, undefined>) =>
      sel.style("font-size", fontSize).style("fill", "#555");

    estiloTexto(
      this.legendaG.append("text")
        .attr("x", x0).attr("y", y0 + barraAltura + (largura < 400 ? 12 : 14))
        .attr("text-anchor", "start")
    ).text("Baixo");

    estiloTexto(
      this.legendaG.append("text")
        .attr("x", x0 + barraLargura / 2).attr("y", y0 + barraAltura + (largura < 400 ? 12 : 14))
        .attr("text-anchor", "middle")
    ).text(largura < 400 ? "Score" : "Score de oportunidade");

    estiloTexto(
      this.legendaG.append("text")
        .attr("x", x0 + barraLargura).attr("y", y0 + barraAltura + (largura < 400 ? 12 : 14))
        .attr("text-anchor", "end")
    ).text("Alto");
  }

  public destroy(): void {
    if (this.resizeRaf !== null) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }
    this.resizeObserver.disconnect();
    this.tooltip.remove();
    this.svgEl.remove();
  }
}
