// public/scripts/features/primaryNav.js
export function initPrimaryNav() {
  const primaryBtn = document.querySelector("[data-menu-toggle]");
  const primaryNav = document.querySelector(".nav--primary");
  if (!primaryBtn || !primaryNav || primaryBtn.dataset.initialized) return;

  primaryBtn.dataset.initialized = "true";

  // Ensure a11y wiring
  if (!primaryNav.id) primaryNav.id = "navPrimary";
  if (!primaryBtn.getAttribute("aria-controls")) {
    primaryBtn.setAttribute("aria-controls", primaryNav.id);
  }
  primaryBtn.setAttribute("aria-expanded", "false");

  const open = () => {
    primaryNav.classList.add("is-open");
    primaryBtn.classList.add("active");
    primaryBtn.setAttribute("aria-expanded", "true");
    document.dispatchEvent(new CustomEvent("fj:popover-open", { detail: "primary" }));
  };

  const close = () => {
    primaryNav.classList.remove("is-open");
    primaryBtn.classList.remove("active");
    primaryBtn.setAttribute("aria-expanded", "false");
  };

  const toggle = (e) => {
    e.stopPropagation();
    (primaryNav.classList.contains("is-open") ? close : open)();
  };

  // Events
  primaryBtn.addEventListener("click", toggle);

  document.addEventListener("click", (e) => {
    if (!primaryNav.contains(e.target) && !primaryBtn.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // If another popover opens, close this one
  document.addEventListener("fj:popover-open", (e) => {
    if (e.detail !== "primary") close();
  });

  // Optional: normalize on resize (close when switching layouts)
  window.addEventListener("resize", () => close());
}
