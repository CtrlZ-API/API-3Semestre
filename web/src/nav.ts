import { isAutenticado } from "./api/client";


export function inicializarNav(): void {
  const nav     = document.getElementById("site-nav");
  const toggle  = document.getElementById("nav-toggle")  as HTMLButtonElement | null;
  const overlay = document.getElementById("nav-overlay") as HTMLButtonElement | null;
  const menu    = document.getElementById("nav-menu");

  if (!nav || !toggle || !overlay || !menu) return;

  const links = menu.querySelectorAll<HTMLAnchorElement>("a");

  const fechar = (): void => {
    nav.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu de navegação");
    overlay.hidden = true;
    document.body.classList.remove("nav-menu-open");
    toggle.focus();
  };

  const abrir = (): void => {
    nav.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Fechar menu de navegação");
    overlay.hidden = false;
    document.body.classList.add("nav-menu-open");
    menu.querySelector<HTMLAnchorElement>("a")?.focus();
  };

  toggle.addEventListener("click", () => {
    nav.classList.contains("nav-open") ? fechar() : abrir();
  });

  overlay.addEventListener("click", fechar);
  links.forEach((link) => link.addEventListener("click", fechar));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("nav-open")) fechar();
  });

  window.matchMedia("(min-width: 769px)").addEventListener("change", (e) => {
    if (e.matches) fechar();
  });

  const syncNavVisibility = (): void => {
    const esPaginaAuth = document.body.classList.contains("pagina-auth");
    nav.style.display = esPaginaAuth ? "none" : "";
  };

  new MutationObserver(syncNavVisibility).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  syncNavVisibility();
}