"use strict";
// All core homepage content and disclosure controls work without JavaScript.
const currentPage = location.pathname.split("/").pop() || "index.html";
for (const link of document.querySelectorAll(".nav-links a")) {
  if (link.getAttribute("href") === currentPage) link.setAttribute("aria-current", "page");
}
