import { renderizarHome }      from "./pages/home";
import { renderizarAnalises }  from "./pages/analise";
import { renderizarLogin }     from "./pages/login";
import { renderizarCadastro }  from "./pages/cadastro";
import { renderizarRelatorio } from "./pages/relatorios";
import { isAutenticado, logout, getUsuarioLogado } from "./api/client";

type HandlerFn = (container: HTMLElement, params: Record<string, string>) => Promise<void>;

interface Rota {
  pattern: RegExp;
  handler: HandlerFn;
  paramNames: string[];
  /** Se true, redireciona para /login quando não autenticado */
  protegida?: boolean;
  /** Se true, redireciona para / quando já está autenticado (ex: /login, /cadastro) */
  apenasPublica?: boolean;
}

// Rotas que usam layout de tela cheia (sem navbar)
const ROTAS_AUTH = ["/login", "/cadastro"];

function aplicarLayoutPagina(caminho: string, exibeTelaLogin: boolean): void {
  const app = document.getElementById("app");
  if (!app) return;
  const layoutAuth = ROTAS_AUTH.includes(caminho) || exibeTelaLogin;
  document.body.classList.toggle("pagina-auth", layoutAuth);
  app.classList.toggle("pagina-full", layoutAuth);
}

function atualizarNavAtiva(caminho: string): void {
  document.querySelectorAll<HTMLAnchorElement>(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href")?.replace(/^#/, "") || "/";
    link.classList.toggle("active", href === caminho);
  });
}

function atualizarNavVisibilidade(): void {
  const autenticado = isAutenticado();

  // Esconde/mostra links protegidos na navbar
  const navLinks = document.querySelector<HTMLUListElement>(".nav-links");
  if (navLinks) {
    navLinks.style.visibility = autenticado ? "visible" : "hidden";
  }

  // Injeta nome do usuário e botão de logout
  const navUsuario = document.getElementById("nav-usuario");
  if (!navUsuario) return;

  if (autenticado) {
    const usuario = getUsuarioLogado();
    const nomeExibido = usuario ? `${usuario.nome} <em>(${usuario.perfil})</em>` : "";
    navUsuario.innerHTML = `
      <span class="nav-usuario-nome">${nomeExibido}</span>
      <button id="btn-logout" class="btn-logout" type="button">
        <i class="bi bi-box-arrow-right" aria-hidden="true"></i> Sair
      </button>
    `;
    document.getElementById("btn-logout")?.addEventListener("click", () => {
      logout();
    });
  } else {
    navUsuario.innerHTML = "";
  }
}

const rotas: Rota[] = [
  {
    pattern: /^\/login$/,
    paramNames: [],
    apenasPublica: true,
    handler: async (container) => {
      await renderizarLogin(container);
    },
  },
  {
    pattern: /^\/cadastro$/,
    paramNames: [],
    apenasPublica: true,
    handler: async (container) => {
      await renderizarCadastro(container);
    },
  },
  {
    pattern: /^\/?(\#.*)?$/,
    paramNames: [],
    protegida: true,
    handler: async (container) => {
      await renderizarHome(container);
    },
  },
  {
    pattern: /^\/analises$/,
    paramNames: [],
    protegida: true,
    handler: async (container) => {
      await renderizarAnalises(container);
    },
  },
  {
    pattern: /^\/relatorios$/,
    paramNames: [],
    protegida: true,
    handler: async (container) => {
      await renderizarRelatorio(container);
    },
  },
  {
    pattern: /^\/estado\/([A-Z]{2})$/,
    paramNames: ["uf"],
    protegida: true,
    handler: async (container, params) => {
      container.innerHTML = `
        <a href="#/" class="link-voltar">← Voltar</a>
        <h1>Estado: ${params["uf"]}</h1>
        <p class="texto-secundario">Gráfico de série histórica — tarefa 3.3</p>
      `;
    },
  },
];

async function rotear(): Promise<void> {
  const app     = document.getElementById("app")!;
  const caminho = window.location.hash.replace(/^#/, "") || "/";

  atualizarNavAtiva(caminho);
  atualizarNavVisibilidade();

  for (const rota of rotas) {
    const match = caminho.match(rota.pattern);
    if (!match) continue;

    // Rota protegida: redireciona para /login se não autenticado
    if (rota.protegida && !isAutenticado()) {
      window.location.hash = "/login";
      return;
    }

    // Rota pública exclusiva: redireciona para / se já autenticado
    if (rota.apenasPublica && isAutenticado()) {
      window.location.hash = "/";
      return;
    }

    const params: Record<string, string> = {};
    rota.paramNames.forEach((nome, i) => { params[nome] = match[i + 1] ?? ""; });

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