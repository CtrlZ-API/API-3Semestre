import * as d3 from "d3";
import type { RegistroHistorico } from "../types";

export interface ChartOptions {
  containerId: string;
  width?: number;
  height?: number;
}

// Localização PT-BR para D3
const ptBr = d3.timeFormatLocale({
  dateTime: "%A, %e de %B de %Y. %X",
  date: "%d/%m/%Y",
  time: "%H:%M:%S",
  periods: ["AM", "PM"],
  days: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  shortDays: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  months: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
  shortMonths: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
});

const formatFullDate = ptBr.format("%B de %Y");

const multiFormat = (date: Date | d3.NumberValue) => {
  const d = date as Date;
  return (d3.timeYear(d) < d ? ptBr.format("%b %y") : ptBr.format("%Y"))(d);
};

type Margens = { top: number; right: number; bottom: number; left: number };

/**
 * HistoricoChart - Componente de visualização de série histórica multi-indicador.
 */
export class HistoricoChart {
  private container: HTMLElement;
  private rootSvg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private svg: d3.Selection<SVGGElement, unknown, null, undefined>;
  private margin: Margens = { top: 60, right: 60, bottom: 40, left: 70 };
  private width = 0;
  private height = 0;
  private resizeObserver: ResizeObserver;
  private resizeRaf: number | null = null;

  private visibility = {
    saldo: true,
    inadimplencia: true,
    variacao: true
  };

  private data: RegistroHistorico[] = [];

  constructor(options: ChartOptions) {
    const el = document.getElementById(options.containerId);
    if (!el) throw new Error(`Container #${options.containerId} não encontrado.`);
    this.container = el;

    this.rootSvg = d3.select(this.container)
      .append("svg")
      .attr("width", "100%")
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block")
      .style("overflow", "visible")
      .style("touch-action", "pan-y pinch-zoom");

    this.svg = this.rootSvg.append("g");

    this.updateDimensions();

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeRaf !== null) cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = null;
        if (this.updateDimensions()) {
          this.update();
        }
      });
    });
    this.resizeObserver.observe(this.container);
  }

  private getMargins(containerWidth: number): Margens {
    if (containerWidth < 400) {
      return { top: 88, right: 28, bottom: 32, left: 44 };
    }
    if (containerWidth < 768) {
      return { top: 72, right: 36, bottom: 36, left: 52 };
    }
    return { top: 60, right: 60, bottom: 40, left: 70 };
  }

  private getContainerHeight(): number {
    const rect = this.container.getBoundingClientRect();
    const fromRect = rect.height;
    if (fromRect > 100) return fromRect;
    const minCss = parseFloat(getComputedStyle(this.container).minHeight) || 0;
    return minCss > 100 ? minCss : 400;
  }

  private updateDimensions(): boolean {
    const rect = this.container.getBoundingClientRect();
    const containerWidth = Math.max(1, rect.width || this.container.clientWidth);
    this.margin = this.getMargins(containerWidth);

    const newWidth = containerWidth - this.margin.left - this.margin.right;
    const containerHeight = this.getContainerHeight();
    const newHeight = containerHeight - this.margin.top - this.margin.bottom;

    if (newWidth <= 0 || newHeight <= 0) return false;

    if (Math.abs(this.width - newWidth) < 2 && Math.abs(this.height - newHeight) < 2) {
      return false;
    }

    this.width = newWidth;
    this.height = newHeight;

    const totalW = this.width + this.margin.left + this.margin.right;
    const totalH = this.height + this.margin.top + this.margin.bottom;

    this.rootSvg
      .attr("width", "100%")
      .attr("height", totalH)
      .attr("viewBox", `0 0 ${totalW} ${totalH}`);

    this.svg.attr("transform", `translate(${this.margin.left},${this.margin.top})`);
    return true;
  }

  public render(data: RegistroHistorico[]) {
    this.data = data;
    if (this.width <= 0) this.updateDimensions();
    this.update();
  }

  private update() {
    this.svg.selectAll("*").remove();

    if (this.width <= 0 || this.height <= 0) return;

    if (!this.data || this.data.length === 0) {
      this.svg.append("text")
        .attr("x", this.width / 2)
        .attr("y", this.height / 2)
        .attr("text-anchor", "middle")
        .style("fill", "#666")
        .style("font-size", this.width < 400 ? "12px" : "14px")
        .style("font-weight", "500")
        .text("Nenhum dado histórico encontrado para os filtros selecionados.");

      this.svg.append("text")
        .attr("x", this.width / 2)
        .attr("y", this.height / 2 + 22)
        .attr("text-anchor", "middle")
        .style("fill", "#999")
        .style("font-size", "12px")
        .text("Tente ajustar o período ou a região no painel superior.");
      return;
    }

    const parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
    const formattedData = this.data.map(d => ({
      ...d,
      date: parseDate(d.data) || new Date()
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    const topPaneHeight = this.height * 0.65;
    const bottomPaneTop = this.height * 0.75;

    const xExtent = d3.extent(formattedData, d => d.date) as [Date, Date];

    if (formattedData.length === 1) {
      xExtent[0] = new Date(xExtent[0].getTime() - 15 * 24 * 60 * 60 * 1000);
      xExtent[1] = new Date(xExtent[1].getTime() + 15 * 24 * 60 * 60 * 1000);
    }

    const x = d3.scaleTime()
      .domain(xExtent)
      .range([0, this.width]);

    const maxSaldo = d3.max(formattedData, d => d.saldo) || 0;
    const minSaldo = d3.min(formattedData, d => d.saldo) || 0;
    const ySaldo = d3.scaleLinear()
      .domain([minSaldo * 0.98, maxSaldo * 1.02])
      .range([topPaneHeight, 0]);

    const maxInad = d3.max(formattedData, d => d.inadimplencia) || 0;
    const yInad = d3.scaleLinear()
      .domain([0, Math.max(5, maxInad * 1.2)])
      .range([topPaneHeight, 0]);

    const varExtent = d3.extent(formattedData, d => d.variacao) as [number, number];
    const maxAbsVar = Math.max(Math.abs(varExtent[0]), Math.abs(varExtent[1]), 1);
    const yVar = d3.scaleLinear()
      .domain([-maxAbsVar, maxAbsVar])
      .range([this.height, bottomPaneTop]);

    const tickStep = this.width < 360 ? 80 : this.width < 520 ? 100 : 120;
    const axisFontSize = this.width < 400 ? "10px" : "11px";

    this.svg.append("g")
      .attr("transform", `translate(0,${this.height})`)
      .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(this.width / tickStep))).tickFormat(multiFormat as any))
      .attr("color", "#666")
      .selectAll("text")
      .style("font-size", axisFontSize);

    this.svg.append("g")
      .call(d3.axisLeft(ySaldo).ticks(this.width < 400 ? 4 : 5).tickFormat(d => d3.format("$.2s")(d as number).replace("G", "B").replace("M", "M")))
      .attr("color", "#2B3EE6")
      .selectAll("text")
      .style("font-size", axisFontSize);

    if (this.width >= 320) {
      this.svg.append("g")
        .attr("transform", `translate(${this.width}, 0)`)
        .call(d3.axisRight(yInad).ticks(this.width < 400 ? 4 : 5).tickFormat(d => `${d}%`))
        .attr("color", "#FF4D4D")
        .selectAll("text")
        .style("font-size", axisFontSize);
    }

    this.svg.append("g")
      .call(d3.axisLeft(yVar).ticks(3).tickFormat(d => d3.format("$.1s")(d as number).replace("G", "B").replace("M", "M")))
      .attr("color", "#00C48C")
      .selectAll("text")
      .style("font-size", axisFontSize);

    this.svg.append("line")
      .attr("x1", 0).attr("x2", this.width)
      .attr("y1", bottomPaneTop - 10).attr("y2", bottomPaneTop - 10)
      .attr("stroke", "#eee");

    this.svg.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.05)
      .call(d3.axisLeft(ySaldo).tickSize(-this.width).tickFormat(() => ""));

    const clipId = `clip-chart-${this.container.id}`;
    this.svg.append("defs").append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", this.width)
      .attr("height", this.height);

    const chartArea = this.svg.append("g").attr("clip-path", `url(#${clipId})`);

    if (this.visibility.variacao) {
      chartArea.append("line")
        .attr("x1", 0).attr("x2", this.width)
        .attr("y1", yVar(0)).attr("y2", yVar(0))
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "2,2")
        .attr("opacity", 0.5);

      const barWidth = Math.max(2, (this.width / Math.max(1, formattedData.length)) * 0.7);

      chartArea.selectAll(".bar-var")
        .data(formattedData)
        .enter()
        .append("rect")
        .attr("class", "bar-var")
        .attr("x", d => x(d.date) - barWidth / 2)
        .attr("y", d => d.variacao >= 0 ? yVar(d.variacao) : yVar(0))
        .attr("width", barWidth)
        .attr("height", d => Math.abs(yVar(d.variacao) - yVar(0)))
        .attr("fill", d => d.variacao >= 0 ? "#00C48C" : "#FF4D4D")
        .attr("opacity", 0.8)
        .attr("rx", 1);
    }

    const drawLine = (key: string, scale: d3.ScaleLinear<number, number>, color: string, width: number) => {
      if (!this.visibility[key as keyof typeof this.visibility]) return;
      const line = d3.line<any>()
        .x((d: any) => x(d.date))
        .y((d: any) => scale(d[key]))
        .curve(d3.curveMonotoneX);

      chartArea.append("path")
        .datum(formattedData)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", width)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);
    };

    drawLine("saldo", ySaldo, "#2B3EE6", 2.5);
    drawLine("inadimplencia", yInad, "#FF4D4D", 2);

    this.addLegend();
    this.addTooltip(x, ySaldo, yInad, yVar, formattedData);
  }

  private addLegend() {
    const compact = this.width < 420;
    const legend = this.svg.append("g")
      .attr("transform", `translate(0, ${compact ? -78 : -45})`);

    const items = [
      { key: "saldo", label: "Saldo Total", color: "#2B3EE6" },
      { key: "inadimplencia", label: "Inadimplência", color: "#FF4D4D" },
      { key: "variacao", label: "Variação Mensal", color: "#00C48C" }
    ] as const;

    let offsetX = 0;
    let offsetY = 0;
    const rowWidth = compact ? this.width : this.width + 200;

    items.forEach(item => {
      const active = this.visibility[item.key as keyof typeof this.visibility];
      const labelWidth = compact ? this.width / 3 - 8 : item.label.length * 7.5 + 35;

      if (compact && offsetX + labelWidth > rowWidth) {
        offsetX = 0;
        offsetY += 22;
      }

      const g = legend.append("g")
        .attr("transform", `translate(${offsetX}, ${offsetY})`)
        .style("cursor", "pointer")
        .attr("role", "button")
        .attr("tabindex", 0)
        .attr("aria-pressed", String(active))
        .on("click", () => {
          this.visibility[item.key as keyof typeof this.visibility] = !active;
          this.update();
        })
        .on("keydown", (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.visibility[item.key as keyof typeof this.visibility] = !active;
            this.update();
          }
        });

      g.append("circle").attr("r", compact ? 4 : 5).attr("fill", active ? item.color : "#ccc");

      g.append("text")
        .attr("x", compact ? 10 : 12)
        .attr("y", 5)
        .text(compact ? item.label.split(" ")[0] : item.label)
        .style("font-size", compact ? "10px" : "12px")
        .style("font-weight", active ? "600" : "400")
        .style("fill", active ? "#333" : "#999");

      offsetX += labelWidth;
    });
  }

  private addTooltip(
    x: d3.ScaleTime<number, number>,
    ySaldo: d3.ScaleLinear<number, number>,
    yInad: d3.ScaleLinear<number, number>,
    yVar: d3.ScaleLinear<number, number>,
    data: { date: Date; saldo: number; inadimplencia: number; variacao: number }[]
  ) {
    const bisectDate = d3.bisector((d: { date: Date }) => d.date).left;
    const hoverGroup = this.svg.append("g").style("display", "none");

    const verticalLine = hoverGroup.append("line")
      .attr("y1", -20)
      .attr("y2", this.height)
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4");

    const createHoriz = (color: string) => hoverGroup.append("line")
      .attr("stroke", color)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.3);

    const horizSaldo = createHoriz("#2B3EE6");
    const horizInad = createHoriz("#FF4D4D");
    const horizVar = createHoriz("#00C48C");

    const createDot = (color: string) => hoverGroup.append("circle")
      .attr("r", 4.5).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2);

    const dotSaldo = createDot("#2B3EE6");
    const dotInad = createDot("#FF4D4D");
    const dotVar = createDot("#00C48C");

    const createLabel = (color: string) => hoverGroup.append("text")
      .attr("fill", color)
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .style("paint-order", "stroke")
      .style("stroke", "#fff")
      .style("stroke-width", "3px");

    const labelSaldo = createLabel("#2B3EE6");
    const labelInad = createLabel("#FF4D4D");
    const labelVar = createLabel("#00C48C");

    const labelDate = hoverGroup.append("text")
      .attr("fill", "#666")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("text-anchor", "middle")
      .attr("y", -10);

    const atualizarHover = (event: PointerEvent) => {
      const [xPos] = d3.pointer(event, this.svg.node());
      const x0 = x.invert(xPos);
      const i = bisectDate(data, x0, 1);
      const d0 = data[i - 1];
      const d1 = data[i];
      if (!d0 && !d1) return;
      const d = (!d0) ? d1 : (!d1) ? d0 : (x0.getTime() - d0.date.getTime() > d1.date.getTime() - x0.getTime()) ? d1 : d0;

      hoverGroup.style("display", null);
      const cx = x(d.date);
      verticalLine.attr("x1", cx).attr("x2", cx);

      labelDate.attr("x", cx).text(formatFullDate(d.date));

      const formatCompact = (v: number) => d3.format("$.2s")(v).replace("G", "B").replace("M", "M");

      const positions: { y: number; key: string }[] = [];
      if (this.visibility.saldo) positions.push({ y: ySaldo(d.saldo), key: "saldo" });
      if (this.visibility.inadimplencia) positions.push({ y: yInad(d.inadimplencia), key: "inad" });

      positions.sort((a, b) => a.y - b.y);

      const labelOffsets: Record<string, number> = {};
      for (let idx = 0; idx < positions.length; idx++) {
        let dy = -10;
        if (idx > 0 && Math.abs(positions[idx].y - positions[idx - 1].y) < 15) {
          dy = 15;
        }
        labelOffsets[positions[idx].key] = dy;
      }

      if (this.visibility.saldo) {
        const cy = ySaldo(d.saldo);
        dotSaldo.style("display", null).attr("cx", cx).attr("cy", cy);
        horizSaldo.style("display", null).attr("x1", 0).attr("x2", cx).attr("y1", cy).attr("y2", cy);
        labelSaldo.style("display", null).attr("x", cx).attr("y", cy + (labelOffsets.saldo || -10)).text(formatCompact(d.saldo));
      } else {
        dotSaldo.style("display", "none");
        horizSaldo.style("display", "none");
        labelSaldo.style("display", "none");
      }

      if (this.visibility.inadimplencia) {
        const cy = yInad(d.inadimplencia);
        dotInad.style("display", null).attr("cx", cx).attr("cy", cy);
        horizInad.style("display", null).attr("x1", cx).attr("x2", this.width).attr("y1", cy).attr("y2", cy);
        labelInad.style("display", null).attr("x", cx).attr("y", cy + (labelOffsets.inad || -10)).text(`${d.inadimplencia.toFixed(1)}%`);
      } else {
        dotInad.style("display", "none");
        horizInad.style("display", "none");
        labelInad.style("display", "none");
      }

      if (this.visibility.variacao) {
        const cy = yVar(d.variacao);
        dotVar.style("display", null).attr("cx", cx).attr("cy", cy).attr("fill", d.variacao >= 0 ? "#00C48C" : "#FF4D4D");
        horizVar.style("display", null).attr("x1", 0).attr("x2", cx).attr("y1", cy).attr("y2", cy).attr("stroke", d.variacao >= 0 ? "#00C48C" : "#FF4D4D");
        const varDy = d.variacao >= 0 ? -10 : 15;
        labelVar.style("display", null).attr("x", cx).attr("y", cy + varDy).attr("fill", d.variacao >= 0 ? "#00C48C" : "#FF4D4D").text((d.variacao >= 0 ? "+" : "") + formatCompact(d.variacao));
      } else {
        dotVar.style("display", "none");
        horizVar.style("display", "none");
        labelVar.style("display", "none");
      }
    };

    const ocultarHover = () => {
      hoverGroup.style("display", "none");
    };

    this.svg.append("rect")
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("fill", "transparent")
      .style("touch-action", "none")
      .on("pointermove", (event) => {
        if (event.pointerType === "mouse" || event.pressure > 0) {
          atualizarHover(event);
        }
      })
      .on("pointerdown", (event) => {
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
        atualizarHover(event);
      })
      .on("pointerup", (event) => {
        (event.currentTarget as Element).releasePointerCapture(event.pointerId);
        if (event.pointerType !== "mouse") {
          ocultarHover();
        }
      })
      .on("pointerleave", ocultarHover)
      .on("pointercancel", ocultarHover);
  }

  public destroy() {
    if (this.resizeRaf !== null) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }
    this.resizeObserver.disconnect();
    d3.select(this.container).selectAll("svg").remove();
  }
}
