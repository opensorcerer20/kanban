document.addEventListener("DOMContentLoaded", () => {
  const links = document.querySelectorAll(".toolbar a");
  const current = location.pathname || "/";
  links.forEach((link) => {
    const hrefPath = new URL(link.getAttribute("href"), location.origin)
      .pathname;
    const isHome =
      hrefPath === "/" && (current === "/" || current === "/index.html");
    const isExact = hrefPath === current;
    if (isHome || isExact) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
});
