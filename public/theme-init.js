// Applies the theme before first paint. A separate file, not inline in
// index.html: the site's CSP (public/_headers) is script-src 'self', which
// blocks inline scripts in production. Mirrors next-themes (key "theme",
// default dark, system allowed).
(function () {
  var root = document.documentElement;
  try {
    // ohshifts.com and demo.ohshifts.com keep separate storage, so links
    // between them carry the theme as ?theme= (src/lib/demo.ts). Adopt it,
    // then drop it from the address bar before the app reads the URL.
    var url = new URL(location.href);
    var carried = url.searchParams.get("theme");
    if (carried === "light" || carried === "dark" || carried === "system") {
      localStorage.setItem("theme", carried);
      url.searchParams.delete("theme");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    }
    var theme = localStorage.getItem("theme") || "dark";
    var dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
  } catch (e) {
    root.classList.add("dark");
  }
})();
