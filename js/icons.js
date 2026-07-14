// Automatically marks the current page's link as .active in both the desktop
// .nav-links and the mobile .bottom-nav, so every page shares the exact same
// nav markup and you never have to hand-edit "active" classes per file.
(function () {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a, .bottom-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === current) {
      a.classList.add("active");
    } else {
      a.classList.remove("active");
    }
  });
})();
