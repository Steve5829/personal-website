"use strict";
(() => {
  const list = document.getElementById("notes-list");
  const search = document.getElementById("note-search");
  const count = document.getElementById("note-count");
  const clear = document.getElementById("clear-search");
  const buttons = [...document.querySelectorAll("[data-category]")];
  const params = new URLSearchParams(location.search);
  const validCategories = buttons.map(button => button.dataset.category);
  let category = validCategories.includes(params.get("category")) ? params.get("category") : "All";
  let selectedNote = params.get("note");
  let notes = [];
  search.value = (params.get("q") || "").slice(0, 200);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const makeLink = (label, href) => {
    const node = make("a", "", label);
    const url = new URL(href, location.href);
    if (["http:", "https:"].includes(url.protocol)) node.href = url.href;
    return node;
  };
  function updateUrl() {
    const url = new URL(location.href);
    const query = search.value.trim();
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    if (category !== "All") url.searchParams.set("category", category); else url.searchParams.delete("category");
    if (selectedNote) url.searchParams.set("note", selectedNote); else url.searchParams.delete("note");
    history.replaceState(null, "", url);
  }
  function card(note) {
    const details = make("details", "note-card"); details.id = note.id;
    const summary = make("summary", "");
    const text = make("div", "");
    text.append(make("span", "note-category", note.category), make("h2", "", note.title), make("p", "note-teaser", note.teaser));
    const plus = make("span", "details-plus", "+"); plus.setAttribute("aria-hidden", "true");
    summary.append(text, plus); details.append(summary);
    const body = make("div", "note-body");
    for (const paragraph of note.body) body.append(make("p", "", paragraph));
    body.append(make("p", "note-relation", note.related));
    const links = make("div", "note-source-row");
    for (const source of note.sources) links.append(makeLink(source.label + " ↗", source.url));
    links.append(makeLink("Link to this note ↗", `notes.html?note=${encodeURIComponent(note.id)}`));
    body.append(links); details.append(body);
    details.open = note.id === selectedNote;
    return details;
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const matching = notes.filter(note => {
      const haystack = [note.title, note.category, note.teaser, ...note.body, note.related].join(" ").toLocaleLowerCase();
      return (category === "All" || note.category === category) && terms.every(term => haystack.includes(term));
    });
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.category === category));
    clear.hidden = !search.value;
    count.textContent = `${matching.length} of ${notes.length} notes${category !== "All" ? " · " + category : ""}`;
    if (!matching.length) {
      const empty = make("div", "empty-state");
      empty.append(make("p", "", "No notes match this combination. Try another term or reset the filters."));
      const reset = make("button", "button button-outline", "Show all notes");
      reset.type = "button"; reset.style.marginTop = "18px";
      reset.addEventListener("click", () => { search.value = ""; category = "All"; selectedNote = null; updateUrl(); render(); search.focus(); });
      empty.append(reset); list.replaceChildren(empty); return;
    }
    list.replaceChildren(...matching.map(card));
  }
  search.addEventListener("input", () => { selectedNote = null; updateUrl(); render(); });
  clear.addEventListener("click", () => { search.value = ""; selectedNote = null; updateUrl(); render(); search.focus(); });
  for (const button of buttons) button.addEventListener("click", () => { category = button.dataset.category; selectedNote = null; updateUrl(); render(); });
  fetch("data/notes.json").then(response => {
    if (!response.ok) throw new Error("Unable to load notes");
    return response.json();
  }).then(data => {
    notes = data.notes;
    if (selectedNote) {
      const selected = notes.find(note => note.id === selectedNote);
      if (selected) { category = "All"; search.value = ""; }
      else selectedNote = null;
    }
    render();
    if (selectedNote) requestAnimationFrame(() => document.getElementById(selectedNote)?.scrollIntoView({block: "start"}));
  }).catch(() => {
    count.textContent = "Notebook unavailable";
    const error = make("p", "error-message", "The notes could not be loaded. Please refresh or ");
    error.append(makeLink("read the full text", "data/notes.json"), document.createTextNode("."));
    list.replaceChildren(error);
  });
})();
