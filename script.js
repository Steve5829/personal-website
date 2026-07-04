// Scroll reveal
const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observer.unobserve(e.target);
      }
    }
  },
  { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));

// Expandable experience rows
document.querySelectorAll(".row-head").forEach((btn) => {
  btn.addEventListener("click", () => {
    const row = btn.closest(".row");
    const open = row.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
});
