// src/routes/api/jokes.routes.js
import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  listJokes,
  getRandomJoke,
  getJokeById,
  getJokesByType,
} from '../../controllers/jokes.controller.js';

const router = Router();

// GET /api/jokes
router.get('/', asyncHandler(listJokes));

// GET /api/jokes/random
router.get('/random', asyncHandler(getRandomJoke));

// Put the typed route before the numeric id to avoid conflicts
// GET /api/jokes/type/:reqJokeType
router.get('/type/:reqJokeType', asyncHandler(getJokesByType));

// GET /api/jokes/:id (numeric only)
router.get('/:id(\\d+)', asyncHandler(getJokeById));

export default router;
