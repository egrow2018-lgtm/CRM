"use client";

import { useEffect } from "react";

/**
 * Convierte todas las listas desplegables (<select>) de la aplicación en listas con buscador:
 * al abrirlas se puede escribir y las opciones se van filtrando.
 *
 * El <select> original se queda en la página (oculto) y sigue siendo el que guarda el valor,
 * así que los formularios, los filtros y la validación funcionan igual que antes.
 * Para dejar un select normal, agrégale el atributo data-native.
 */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const setSelectValue = (select: HTMLSelectElement, value: string) => {
  // Usa el setter nativo para que React (si controla el select) detecte el cambio
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

type Entry = { value: string; label: string; group: string | null; disabled: boolean };

function entriesOf(select: HTMLSelectElement): Entry[] {
  return [...select.options].map((o) => ({
    value: o.value,
    label: o.text,
    group: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : null,
    disabled: o.disabled,
  }));
}

function enhance(select: HTMLSelectElement) {
  select.dataset.enhanced = "";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = `${select.className} ss-trigger`;
  trigger.setAttribute("aria-haspopup", "listbox");
  if (select.getAttribute("aria-label")) trigger.setAttribute("aria-label", select.getAttribute("aria-label")!);
  select.after(trigger);

  const sync = () => {
    const opt = select.selectedOptions[0];
    trigger.textContent = opt?.text ?? "";
    trigger.disabled = select.disabled;
    trigger.classList.toggle("ss-placeholder", !opt || opt.value === "");
  };
  sync();
  select.addEventListener("change", sync);
  // React puede cambiar el valor o las opciones sin disparar eventos
  const mo = new MutationObserver(sync);
  mo.observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
  const timer = window.setInterval(sync, 500);

  trigger.addEventListener("click", () => open(select, trigger));
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " " || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      open(select, trigger, e.key.length === 1 && e.key !== " " ? e.key : "");
    }
  });
  // Si el formulario marca el select como inválido, se lleva el foco al botón visible
  select.addEventListener("focus", () => trigger.focus());

  return () => {
    mo.disconnect();
    window.clearInterval(timer);
    trigger.remove();
    delete select.dataset.enhanced;
  };
}

let closeCurrent: (() => void) | null = null;

function open(select: HTMLSelectElement, trigger: HTMLButtonElement, initial = "") {
  closeCurrent?.();
  const entries = entriesOf(select);
  const pop = document.createElement("div");
  pop.className = "ss-pop";
  pop.setAttribute("role", "dialog");
  const input = document.createElement("input");
  input.className = "ss-search";
  input.placeholder = "Escribe para buscar…";
  input.value = initial;
  input.setAttribute("aria-label", "Buscar opción");
  const list = document.createElement("ul");
  list.className = "ss-list";
  list.setAttribute("role", "listbox");
  pop.append(input, list);
  document.body.append(pop);

  const place = () => {
    const r = trigger.getBoundingClientRect();
    const width = Math.max(r.width, 240);
    pop.style.width = `${width}px`;
    pop.style.left = `${Math.min(r.left, window.innerWidth - width - 8)}px`;
    const below = window.innerHeight - r.bottom;
    if (below < 280 && r.top > below) {
      pop.style.top = "";
      pop.style.bottom = `${window.innerHeight - r.top + 4}px`;
    } else {
      pop.style.bottom = "";
      pop.style.top = `${r.bottom + 4}px`;
    }
  };

  let shown: Entry[] = [];
  let active = 0;
  const render = () => {
    const q = norm(input.value.trim());
    shown = entries.filter((e) => !q || norm(`${e.label} ${e.group ?? ""}`).includes(q));
    const current = shown.findIndex((e) => e.value === select.value);
    if (active >= shown.length) active = 0;
    list.replaceChildren();
    let lastGroup: string | null = null;
    shown.slice(0, 300).forEach((e, i) => {
      if (e.group && e.group !== lastGroup) {
        const h = document.createElement("li");
        h.className = "ss-group";
        h.textContent = e.group;
        list.append(h);
      }
      lastGroup = e.group;
      const li = document.createElement("li");
      li.className = "ss-option";
      li.setAttribute("role", "option");
      li.textContent = e.label;
      if (e.disabled) li.setAttribute("aria-disabled", "true");
      if (i === current) li.setAttribute("aria-selected", "true");
      if (i === active) li.classList.add("ss-active");
      li.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        choose(e);
      });
      list.append(li);
    });
    if (shown.length === 0) {
      const li = document.createElement("li");
      li.className = "ss-empty";
      li.textContent = "Sin resultados";
      list.append(li);
    } else if (shown.length > 300) {
      const li = document.createElement("li");
      li.className = "ss-empty";
      li.textContent = `Mostrando 300 de ${shown.length}. Escribe más para filtrar.`;
      list.append(li);
    }
    list.querySelector(".ss-active")?.scrollIntoView({ block: "nearest" });
  };

  const close = (focus = true) => {
    pop.remove();
    document.removeEventListener("mousedown", outside, true);
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", onScroll, true);
    closeCurrent = null;
    if (focus) trigger.focus();
  };
  const choose = (e: Entry) => {
    if (e.disabled) return;
    if (e.value !== select.value) setSelectValue(select, e.value);
    close();
  };
  const outside = (ev: MouseEvent) => {
    if (!pop.contains(ev.target as Node) && ev.target !== trigger) close(false);
  };
  const onScroll = (ev: Event) => {
    if (!pop.contains(ev.target as Node)) place();
  };

  input.addEventListener("input", () => {
    active = 0;
    render();
  });
  input.addEventListener("keydown", (ev) => {
    const max = Math.min(shown.length, 300) - 1;
    if (ev.key === "ArrowDown") active = Math.min(max, active + 1);
    else if (ev.key === "ArrowUp") active = Math.max(0, active - 1);
    else if (ev.key === "Enter") {
      ev.preventDefault();
      if (shown[active]) choose(shown[active]);
      return;
    } else if (ev.key === "Escape" || ev.key === "Tab") {
      ev.preventDefault();
      close();
      return;
    } else return;
    ev.preventDefault();
    render();
  });

  // Empieza resaltando la opción elegida
  active = Math.max(0, entries.findIndex((e) => e.value === select.value));
  if (initial) active = 0;
  render();
  place();
  input.focus();
  document.addEventListener("mousedown", outside, true);
  window.addEventListener("resize", place);
  window.addEventListener("scroll", onScroll, true);
  closeCurrent = () => close(false);
}

export function SearchableSelects() {
  useEffect(() => {
    const cleanups = new Map<HTMLSelectElement, () => void>();
    const scan = () => {
      for (const s of document.querySelectorAll<HTMLSelectElement>("select:not([multiple]):not([data-native]):not([data-enhanced])")) {
        cleanups.set(s, enhance(s));
      }
      // Limpia los selects que React ya quitó de la página
      for (const [s, clean] of cleanups) {
        if (!s.isConnected) {
          clean();
          cleanups.delete(s);
        }
      }
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      closeCurrent?.();
      for (const clean of cleanups.values()) clean();
    };
  }, []);
  return null;
}
