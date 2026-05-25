import { renderizarHome } from "./pages/home";
import { renderizarAnalises } from "./pages/analise";
import { renderizarLogin } from "./pages/login";
import { renderizarCadastro } from "./pages/cadastro";
import { renderizarRelatorio } from "./pages/relatorios";

type HandlerFn = (container: HTMLElement, params: Record<string, string>) => Promise<void>;

interface Rota {
  pattern: RegExp;
  handler: HandlerFn;
  paramNames: string[];
}

const ROTAS_AUTH = ["/login", "/cadastro"];

function isAutenticado(): boolean {
  return !!localStorage.getItem("auth_token");
}

function aplicarLayoutPagina(caminho: string, exibeTelaLogin: boolean): void {
  const app = document.getElementById("app");
  if (!app) return;

  const layoutAuth = ROTAS_AUTH.includes(caminho) || exibeTelaLogin;
  document.body.classList.toggle("pagina-auth", layoutAuth);
  app.classList.toggle("pagina-full", layoutAuth);
}

function atualizarNavAtiva(caminho: string): void {
  const path = caminho === "/" ? "/" : caminho;
  document.querySelectorAll<HTMLAnchorElement>(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href")?.replace(/^#/, "") || "/";
    link.classList.toggle("active", href === path);
  });
}

const rotas: Rota[] = [
  {
    pattern: /^\/login$/,
    paramNames: [],
    handler: async (container) => {
      await renderizarLogin(container);
    },
  },
  {
    pattern: /^\/cadastro$/,
    paramNames: [],
    handler: async (container) => {
      await renderizarCadastro(container);
    },
  },
  {
    pattern: /^\/?(#.*)?$/,
    paramNames: [],
    handler: async (container) => {
      if (!isAutenticado()) {
        await renderizarLogin(container);
      } else {
        await renderizarHome(container);
      }
    },
  },
  {
    pattern: /^\/analises$/,
    paramNames: [],
    handler: async (container) => {
      if (!isAutenticado()) {
        await renderizarLogin(container);
      } else {
        await renderizarAnalises(container);
      }
    },
  },
  {
    pattern: /^\/relatorios$/,
    paramNames: [],
    handler: async (container) => {
      if (!isAutenticado()) {
        await renderizarLogin(container);
      } else {
        await renderizarRelatorio(container);
      }
    },
  },
  {
    pattern: /^\/estado\/([A-Z]{2})$/,
    paramNames: ["uf"],
    handler: async (container, params) => {
      if (!isAutenticado()) {
        await renderizarLogin(container);
        return;
      }
      container.innerHTML = `
        <a href="#/" class="link-voltar">← Voltar</a>
        <h1>Estado: ${params["uf"]}</h1>
        <p class="texto-secundario">Gráfico de série histórica — tarefa 3.3</p>
      `;
    },
  },
];

async function rotear(): Promise<void> {
  const app = document.getElementById("app")!;
  const caminho = window.location.hash.replace(/^#/, "") || "/";

  atualizarNavAtiva(caminho);

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
        aplicarLayoutPagina(caminho, app.querySelector(".login-container") !== null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro inesperado";
        app.innerHTML = `<div class="error"><strong>Erro:</strong> ${msg}</div>`;
        aplicarLayoutPagina(caminho, false);
      }

      return;
    }
  }

  aplicarLayoutPagina(caminho, false);
  app.innerHTML = `
    <div class="pagina-erro">
      <h1>404</h1>
      <p>Página não encontrada: <code>${caminho}</code></p>
      <a href="#/" class="btn-secundario">Voltar ao início</a>
    </div>
  `;
}

export function inicializarRouter(): void {
  window.addEventListener("hashchange", rotear);
  rotear();
}
