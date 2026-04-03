import { renderizarHome } from "./pages/home";

type HandlerFn = (container: HTMLElement, params: Record<string, string>) => Promise<void>;

interface Rota {
  pattern: RegExp;
  handler: HandlerFn;
  paramNames: string[];
}

const rotas: Rota[] = [
  {
    pattern: /^\/?(#.*)?$/,
    paramNames: [],
    handler: async (container) => {
      await renderizarHome(container);
    },
  },
  {
    pattern: /^\/estado\/([A-Z]{2})$/,
    paramNames: ["uf"],
    handler: async (container, params) => {
      container.innerHTML = `
        <a href="#/" style="display:inline-block; margin-bottom:1rem;">← Voltar</a>
        <h1>Estado: ${params["uf"]}</h1>
        <p style="color:#888;">Gráfico de série histórica — tarefa 3.3</p>
      `;
    },
  },
];

async function rotear(): Promise<void> {
  const app = document.getElementById("app")!;

  const caminho = window.location.hash.replace(/^#/, "") || "/";

  for (const rota of rotas) {
    const match = caminho.match(rota.pattern);

    if (match) {
      const params: Record<string, string> = {};
      rota.paramNames.forEach((nome, i) => {
        params[nome] = match[i + 1] ?? "";
      });

      app.innerHTML = `<p class="loading">Carregando...</p>`;

      try {
        await rota.handler(app, params);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro inesperado";
        app.innerHTML = `<div class="error"><strong>Erro:</strong> ${msg}</div>`;
      }

      return;
    }
  }

  app.innerHTML = `
    <h1>404</h1>
    <p>Página não encontrada: <code>${caminho}</code></p>
    <a href="#/">Voltar ao início</a>
  `;
}

export function inicializarRouter(): void {
  window.addEventListener("hashchange", rotear);

  rotear();
}
