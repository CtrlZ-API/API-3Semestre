/** Menu de navegação responsivo (hambúrguer em telas pequenas). */
export function inicializarNav(): void {
  const nav = document.getElementById("site-nav");
  const toggle = document.getElementById("nav-toggle") as HTMLButtonElement | null;
  const overlay = document.getElementById("nav-overlay") as HTMLButtonElement | null;
  const menu = document.getElementById("nav-menu");

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
    const primeiroLink = menu.querySelector<HTMLAnchorElement>("a");
    primeiroLink?.focus();
  };

  const alternar = (): void => {
    if (nav.classList.contains("nav-open")) {
      fechar();
    } else {
      abrir();
    }
  };

  toggle.addEventListener("click", alternar);
  overlay.addEventListener("click", fechar);

  links.forEach((link) => {
    link.addEventListener("click", fechar);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("nav-open")) {
      fechar();
    }
  });

  window.matchMedia("(min-width: 769px)").addEventListener("change", (e) => {
    if (e.matches) fechar();
  });
}