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

const formatMonthYear = ptBr.format("%b %y");
const formatFullDate = ptBr.format("%B de %Y");

const multiFormat = (date: Date | d3.NumberValue) => {
  const d = date as Date;
  return (d3.timeYear(d) < d ? ptBr.format("%b %y") : ptBr.format("%Y"))(d);
};

/**
 * HistoricoChart - Componente de visualização de série histórica multi-indicador.
 */
export class HistoricoChart {
  private container: HTMLElement;
  private svg: d3.Selection<any, any, any, any>;
  private margin = { top: 60, right: 60, bottom: 40, left: 70 };
  private width: number = 0;
  private height: number = 0;
  private resizeObserver: ResizeObserver;
  
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
    
    this.svg = d3.select(this.container)
      .append("svg")
      .attr("width", "100%")
      .style("overflow", "visible")
      .append("g");

    this.resizeObserver = new ResizeObserver(() => {
      if (this.updateDimensions()) {
        this.update();
      }
    });
    this.resizeObserver.observe(this.container);
  }

  private updateDimensions() {
    const rect = this.container.getBoundingClientRect();
    const newWidth = rect.width - this.margin.left - this.margin.right;
    const newHeight = (rect.height > 100 ? rect.height : 400) - this.margin.top - this.margin.bottom;
    
    if (Math.abs(this.width - newWidth) < 2 && Math.abs(this.height - newHeight) < 2) {
      return false;
    }

    this.width = newWidth;
    this.height = newHeight;
    
    d3.select(this.container).select("svg")
      .attr("width", "100%")
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .style("display", "block")
      .attr("viewBox", `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`);
    
    this.svg.attr("transform", `translate(${this.margin.left},${this.margin.top})`);
    return true;
  }

  public render(data: RegistroHistorico[]) {
    this.data = data;
    this.update();
  }

  private update() {
    this.svg.selectAll("*").remove();

    if (!this.data || this.data.length === 0) {
      this.svg.append("text")
        .attr("x", this.width / 2)
        .attr("y", this.height / 2)
        .attr("text-anchor", "middle")
        .style("fill", "#666")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Nenhum dado histórico encontrado para os filtros selecionados.");
      
      this.svg.append("text")
        .attr("x", this.width / 2)
        .attr("y", this.height / 2 + 25)
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

    // Escalas
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

    // Eixos
    this.svg.append("g")
      .attr("transform", `translate(0,${this.height})`)
      .call(d3.axisBottom(x).ticks(Math.max(2, this.width / 120)).tickFormat(multiFormat as any))
      .attr("color", "#666");

    this.svg.append("g")
      .call(d3.axisLeft(ySaldo).ticks(5).tickFormat(d => d3.format("$.2s")(d as number).replace("G", "B").replace("M", "M")))
      .attr("color", "#2B3EE6");

    this.svg.append("g")
      .attr("transform", `translate(${this.width}, 0)`)
      .call(d3.axisRight(yInad).ticks(5).tickFormat(d => d + "%"))
      .attr("color", "#FF4D4D");

    this.svg.append("g")
      .call(d3.axisLeft(yVar).ticks(3).tickFormat(d => d3.format("$.1s")(d as number).replace("G", "B").replace("M", "M")))
      .attr("color", "#00C48C");

    // Divisória
    this.svg.append("line")
      .attr("x1", 0).attr("x2", this.width)
      .attr("y1", bottomPaneTop - 10).attr("y2", bottomPaneTop - 10)
      .attr("stroke", "#eee");

    // Grid
    this.svg.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.05)
      .call(d3.axisLeft(ySaldo).tickSize(-this.width).tickFormat("" as any));

    // Desenho com clip-path para evitar vazamento
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

    const drawLine = (key: string, scale: any, color: string, width: number) => {
      if (!this.visibility[key as keyof typeof this.visibility]) return;
      const line = d3.line<any>()
        .x(d => x(d.date))
        .y(d => scale(d[key]))
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
    const legend = this.svg.append("g")
      .attr("transform", `translate(0, -45)`);

    const items = [
      { key: "saldo", label: "Saldo Total", color: "#2B3EE6" },
      { key: "inadimplencia", label: "Inadimplência", color: "#FF4D4D" },
      { key: "variacao", label: "Variação Mensal", color: "#00C48C" }
    ] as const;

    let offset = 0;
    items.forEach(item => {
      const active = this.visibility[item.key as keyof typeof this.visibility];
      
      const g = legend.append("g")
        .attr("transform", `translate(${offset}, 0)`)
        .style("cursor", "pointer")
        .on("click", () => {
          this.visibility[item.key as keyof typeof this.visibility] = !active;
          this.update();
        })
        .on("mouseover", function() { d3.select(this).style("opacity", 0.7); })
        .on("mouseout", function() { d3.select(this).style("opacity", 1); });

      g.append("circle").attr("r", 5).attr("fill", active ? item.color : "#ccc");

      g.append("text")
        .attr("x", 12)
        .attr("y", 5)
        .text(item.label)
        .style("font-size", "12px")
        .style("font-weight", active ? "600" : "400")
        .style("fill", active ? "#333" : "#999");

      offset += (item.label.length * 7.5) + 35;
    });
  }

  private addTooltip(
    x: d3.ScaleTime<number, number>, 
    ySaldo: d3.ScaleLinear<number, number>,
    yInad: d3.ScaleLinear<number, number>,
    yVar: d3.ScaleLinear<number, number>,
    data: any[]
  ) {
    const bisectDate = d3.bisector((d: any) => d.date).left;
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
    const horizInad  = createHoriz("#FF4D4D");
    const horizVar   = createHoriz("#00C48C");

    const createDot = (color: string) => hoverGroup.append("circle")
      .attr("r", 4.5).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2);

    const dotSaldo = createDot("#2B3EE6");
    const dotInad  = createDot("#FF4D4D");
    const dotVar   = createDot("#00C48C");

    const createLabel = (color: string) => hoverGroup.append("text")
      .attr("fill", color)
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .style("paint-order", "stroke")
      .style("stroke", "#fff")
      .style("stroke-width", "3px");

    const labelSaldo = createLabel("#2B3EE6");
    const labelInad  = createLabel("#FF4D4D");
    const labelVar   = createLabel("#00C48C");

    const labelDate = hoverGroup.append("text")
      .attr("fill", "#666")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("text-anchor", "middle")
      .attr("y", -10);

    this.svg.append("rect")
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("fill", "transparent")
      .on("mousemove", (event) => {
        const xPos = d3.pointer(event)[0];
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

        const positions: {y: number, key: string}[] = [];
        if (this.visibility.saldo) positions.push({y: ySaldo(d.saldo), key: 'saldo'});
        if (this.visibility.inadimplencia) positions.push({y: yInad(d.inadimplencia), key: 'inad'});
        
        positions.sort((a, b) => a.y - b.y);
        
        const labelOffsets: Record<string, number> = {};
        for(let idx = 0; idx < positions.length; idx++) {
          let dy = -10;
          if (idx > 0 && Math.abs(positions[idx].y - positions[idx-1].y) < 15) { dy = 15; }
          labelOffsets[positions[idx].key] = dy;
        }

        if (this.visibility.saldo) {
          const cy = ySaldo(d.saldo);
          dotSaldo.style("display", null).attr("cx", cx).attr("cy", cy);
          horizSaldo.style("display", null).attr("x1", 0).attr("x2", cx).attr("y1", cy).attr("y2", cy);
          labelSaldo.style("display", null).attr("x", cx).attr("y", cy + (labelOffsets['saldo'] || -10)).text(formatCompact(d.saldo));
        } else {
          dotSaldo.style("display", "none"); horizSaldo.style("display", "none"); labelSaldo.style("display", "none");
        }

        if (this.visibility.inadimplencia) {
          const cy = yInad(d.inadimplencia);
          dotInad.style("display", null).attr("cx", cx).attr("cy", cy);
          horizInad.style("display", null).attr("x1", cx).attr("x2", this.width).attr("y1", cy).attr("y2", cy);
          labelInad.style("display", null).attr("x", cx).attr("y", cy + (labelOffsets['inad'] || -10)).text(d.inadimplencia.toFixed(1) + "%");
        } else {
          dotInad.style("display", "none"); horizInad.style("display", "none"); labelInad.style("display", "none");
        }

        if (this.visibility.variacao) {
          const cy = yVar(d.variacao);
          dotVar.style("display", null).attr("cx", cx).attr("cy", cy).attr("fill", d.variacao >= 0 ? "#00C48C" : "#FF4D4D");
          horizVar.style("display", null).attr("x1", 0).attr("x2", cx).attr("y1", cy).attr("y2", cy).attr("stroke", d.variacao >= 0 ? "#00C48C" : "#FF4D4D");
          const varDy = d.variacao >= 0 ? -10 : 15;
          labelVar.style("display", null).attr("x", cx).attr("y", cy + varDy).attr("fill", d.variacao >= 0 ? "#00C48C" : "#FF4D4D").text((d.variacao >= 0 ? "+" : "") + formatCompact(d.variacao));
        } else {
          dotVar.style("display", "none"); horizVar.style("display", "none"); labelVar.style("display", "none");
        }
      })
      .on("mouseout", () => { hoverGroup.style("display", "none"); });
  }

  public destroy() { this.resizeObserver.disconnect(); }
}
