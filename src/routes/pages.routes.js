// src/routes/pages.routes.js
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ensureAuthed } from '../config/passport.js';
import { createPagesController } from '../controllers/pages.controller.js';
import { JOKES_SEED } from '../data/jokes.js';

/* deps for controller (pure helpers + in-mem repo) */
function buildPosts(jokes, count = 12) {
  return jokes.slice(0, count).map((j, i) => ({
    id: j.id,
    channelName: ['WTF','Humor','Science & Tech','Random'][i % 4],
    channelIcon: '🟢',
    isoTime: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
    timeAgo: `${i + 1}h`,
    title: j.jokeText.length > 80 ? j.jokeText.slice(0, 80) + '…' : j.jokeText,
    imageUrl: null, videoUrl: null,
    tags: [(j.jokeType || 'random').toLowerCase()],
    up: String(Math.floor(200 + Math.random() * 1500)),
    comments: Math.floor(Math.random() * 500),
  }));
}
function shuffleArray(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

const jokesRepo = {
  async all(){ return JOKES_SEED; },
  async findById(id){ return JOKES_SEED.find(j => j.id === Number(id)) || null; },
  async findByType(t){ const type=String(t||'').toLowerCase(); return JOKES_SEED.filter(j => (j.jokeType||'').toLowerCase()===type); },
  async random(){ return JOKES_SEED[Math.floor(Math.random()*JOKES_SEED.length)] || null; }
};

const pages = createPagesController({ jokesRepo, buildPosts, shuffleArray });
const router = Router();

/* ------------------------------- Public pages ------------------------------ */
router.get('/',        asyncHandler(pages.home));
router.get('/about',   asyncHandler(pages.about));
router.get('/contact', asyncHandler(pages.contact));
router.get('/search',  asyncHandler(pages.search));

router.get('/privacy', (req, res) => {
  res.locals.pageTitle = 'Privacy Policy';
  res.locals.pageDescription = 'FunnyJoke Privacy Policy';
  res.status(200).render('pages/privacy');
});

router.get('/data-deletion', (req, res) => {
  res.locals.pageTitle = 'Data Deletion';
  res.locals.pageDescription = 'How to request deletion of your data on FunnyJoke.';
  // Important for FB crawler: return 200 OK with visible instructions.
  res.status(200).render('pages/data-deletion');
});


router.get('/facebook/deletion-status/:code', (req, res) => {
  res.render('pages/deletion-status', {
    title: 'Deletion Request Received',
    pageDescription: 'Confirmation for your Facebook data deletion request.',
    code: req.params.code
  });
});

/* ------------------------------ Auth-gated pages --------------------------- */
router.get('/profile', ensureAuthed, asyncHandler(pages.profile));
router.get('/post/new', ensureAuthed, (req, res) => {
  res.render('pages/post-new', {
    title: 'Create a Post',
    showFooter: false,
    showSidebar: false,
  });
});

/* ------------------- Mixed endpoint: JSON / partial / full page ------------ */
router.get('/shuffle', asyncHandler(pages.shuffle));


/* ------------------------Terms Pages-------------------------------------- */
router.get('/terms', (req, res) => {
  res.render('pages/terms', {
    title: 'Terms of Service',
    pageDescription: 'Terms of Service for FunnyJoke'
  });
});

export default router;
