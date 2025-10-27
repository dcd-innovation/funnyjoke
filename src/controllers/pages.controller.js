// src/controllers/pages.controller.js
// Renders EJS pages. Keep ZERO data storage here—inject everything.

function defaultTabs()  { return ["Hot", "Fresh", "Top", "Trending", "Ask FJ"]; }
function defaultChips() { return ["memes", "anime & manga", "gaming", "news", "cosplay", "random"]; }

/**
 * @param {Object} deps
 * @param {Object} deps.jokesRepo                 - data source (expects all())
 * @param {Function} deps.buildPosts(jokes,count) - maps jokes -> post view models
 * @param {Function} deps.shuffleArray(arr)       - Fisher–Yates (pure)
 */
export function createPagesController({ jokesRepo, buildPosts, shuffleArray }) {
  if (!jokesRepo || !buildPosts || !shuffleArray) {
    throw new Error("[pages.controller] missing deps: jokesRepo/buildPosts/shuffleArray");
  }

  // HOME: full page render
  const home = async (req, res, next) => {
    try {
      const jokes = await jokesRepo.all();
      const posts = buildPosts(jokes, 12);

      res.render("pages/home", {
        title: "FunnyJoke – Home",
        pageDescription: "Funny jokes and clever riddles to brighten your day!",
        pageCss: "pages/home",     // public/css/pages/home.css
        pageScript: "home",        // public/scripts/pages/home.js
        tabs:  defaultTabs(),
        chips: defaultChips(),
        posts,
        showFooter: false,
        // showSidebar: true (default from res.locals)
      });
    } catch (e) { next(e); }
  };

  /**
   * SHUFFLE:
   * - ?format=json          -> { posts:[...] }
   * - ?partial=posts        -> renders partials/post-list.ejs
   * - otherwise             -> full page (no-JS fallback)
   */
  const shuffle = async (req, res, next) => {
    try {
      const jokes = await jokesRepo.all();
      const posts = shuffleArray(buildPosts(jokes, 12));

      if (req.accepts("json") || req.query.format === "json") {
        return res.json({ posts });
      }

      if (req.query.partial === "posts") {
        return res.render("partials/post-list", { posts }, (err, html) => {
          if (err) return next(err);
          res.send(html);
        });
      }

      // full page fallback
      res.render("pages/home", {
        title: "FunnyJoke – Home (Shuffled)",
        pageDescription: "Fresh shuffled jokes!",
        pageCss: "pages/home",
        pageScript: "home",
        tabs:  defaultTabs(),
        chips: defaultChips(),
        posts,
        showFooter: false
      });
    } catch (e) { next(e); }
  };

  // STATIC PAGES
  const about   = (req, res) => res.render("pages/about",   { title: "About Us"   });
  const contact = (req, res) => res.render("pages/contact", { title: "Contact Us" });
  const profile = (req, res) => res.render("pages/profile", { title: "Profile"    });

  // AUTH PAGES (hide sidebar)
  const login = (req, res) => {
    const err = req.session?.error || null;
    if (req.session) req.session.error = null;
    res.render("auth/login",   { title: "Login",   showSidebar: false, error: err });
  };
  const register = (req, res) => res.render("auth/register", { title: "Register", showSidebar: false });

  // SEARCH PAGE (server-render shell; hook real results later)
  const search = (req, res) => {
    const q = (req.query.q || "").trim();
    res.render("pages/search", {
      title: "Search",
      q,
      results: [], // TODO: wire actual search results
    });
  };

  return {
    home,
    shuffle,
    about,
    contact,
    profile,
    login,
    register,
    search,
  };
}
