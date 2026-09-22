"use strict";
(() => {
  const root = document.getElementById("case-root");
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const link = (label, href, className) => {
    const node = make("a", className, label);
    const url = new URL(href, location.href);
    if (["https:", "http:"].includes(url.protocol)) node.href = url.href;
    return node;
  };
  const names = {godot: "Godot Vibe", pocketpy: "pocketpy", spelltide: "SpellTide", integrations: "Integrations"};
  function render(item, cases) {
    document.title = `${item.title} — Steve Chen`;
    document.querySelector('meta[name="description"]').content = item.summary;
    const hero = make("section", "page-hero");
    hero.append(make("p", "eyebrow", item.subtitle), make("h1", "", item.title), make("p", "", item.summary));
    const tags = make("ul", "tag-list");
    tags.setAttribute("aria-label", "Topics");
    for (const tag of item.tags) tags.append(make("li", "", tag));
    hero.append(tags);
    const layout = make("div", "case-layout");
    const content = make("article", "case-content");
    for (const section of item.sections) {
      const node = make("section", "case-section");
      node.append(make("h2", "", section.title), make("p", "", section.text));
      content.append(node);
    }
    const nav = make("nav", "case-nav");
    nav.setAttribute("aria-label", "Other case studies");
    for (const entry of cases) {
      const node = link(names[entry.id] || entry.title, `case-study.html?id=${encodeURIComponent(entry.id)}`);
      if (entry.id === item.id) node.setAttribute("aria-current", "page");
      nav.append(node);
    }
    content.append(nav);
    const aside = make("aside", "case-sidebar");
    const panel = make("div", "panel");
    for (const [label, value] of [["My role", item.role], ["Timeline", item.period]]) {
      const block = make("div", "");
      block.append(make("p", "sidebar-label", label), make("p", "sidebar-value", value));
      panel.append(block);
    }
    const sourceBlock = make("div", "source-block");
    sourceBlock.append(make("p", "sidebar-label", "Follow the work"));
    const sources = make("ul", "source-links");
    for (const source of item.sources) {
      const entry = make("li", ""); entry.append(link(source.label + " ↗", source.url)); sources.append(entry);
    }
    sourceBlock.append(sources); panel.append(sourceBlock); aside.append(panel);
    layout.append(content, aside); root.replaceChildren(hero, layout);
  }
  fetch("data/cases.json").then(response => {
    if (!response.ok) throw new Error("Unable to load case studies");
    return response.json();
  }).then(({cases}) => {
    const id = new URLSearchParams(location.search).get("id") || "godot";
    const item = cases.find(entry => entry.id === id);
    if (!item) {
      const section = make("section", "page-hero");
      section.append(make("p", "eyebrow", "Case study not found"), make("h1", "", "Choose a project."));
      const nav = make("nav", "case-nav");
      nav.setAttribute("aria-label", "Available case studies");
      for (const entry of cases) nav.append(link(names[entry.id] || entry.title, `case-study.html?id=${encodeURIComponent(entry.id)}`));
      section.append(nav); root.replaceChildren(section); return;
    }
    render(item, cases);
  }).catch(() => {
    const error = make("p", "error-message", "The case study could not be loaded. Please refresh, or ");
    error.append(link("read the project source", "https://github.com/Steve5829"), document.createTextNode("."));
    root.replaceChildren(error);
  });
})();
