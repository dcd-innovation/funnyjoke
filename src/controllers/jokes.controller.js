// src/controllers/jokes.controller.js

// Named-handler version (uses the service layer)
import {
  getAllJokes,
  getRandomJoke as svcRandom,
  getJokeById as svcById,
  getJokesByType as svcByType,
} from '../services/jokes.service.js';

function toInt(v, def = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

/* ------------------------------------------------------------------ */
/* Named exports — what your routes import today                      */
/* ------------------------------------------------------------------ */

export async function listJokes(req, res) {
  const { type, limit } = req.query;
  let data = [];

  if (type) {
    data = await svcByType(String(type).toLowerCase());
  } else {
    data = await getAllJokes();
  }

  const lim = toInt(limit, 50);
  if (lim > 0) data = data.slice(0, lim);

  res.json(data);
}

export async function getRandomJoke(req, res) {
  const joke = await svcRandom();
  if (!joke) return res.status(404).json({ message: 'No jokes available' });
  res.json(joke);
}

export async function getJokeById(req, res) {
  const id = toInt(req.params.id, -1);
  const joke = await svcById(id);
  if (!joke) return res.status(404).json({ error: `Joke with id: ${id} not found.` });
  res.json(joke);
}

export async function getJokesByType(req, res) {
  const type = String(req.params.reqJokeType || '').toLowerCase();
  if (!type) return res.status(400).json({ error: 'Type is required' });

  const list = await svcByType(type);
  if (!list.length) return res.status(404).json({ message: 'No jokes available' });
  res.json(list);
}

/* ------------------------------------------------------------------ */
/* Optional DI-style factory — if you want to inject a repo later     */
/* (repo must implement: all, findById, findByType, random)           */
/* ------------------------------------------------------------------ */

export function createJokesController({ jokesRepo }) {
  if (!jokesRepo) throw new Error('[jokes.controller] jokesRepo is required');

  const getRandom = async (req, res, next) => {
    try {
      const joke = await jokesRepo.random();
      if (!joke) return res.status(404).json({ error: 'No jokes available' });
      res.json(joke);
    } catch (e) { next(e); }
  };

  const getById = async (req, res, next) => {
    try {
      const id = toInt(req.params.id, -1);
      const joke = await jokesRepo.findById(id);
      if (!joke) return res.status(404).json({ error: `Joke with id ${id} not found` });
      res.json(joke);
    } catch (e) { next(e); }
  };

  const getByType = async (req, res, next) => {
    try {
      const type = String(req.params.reqJokeType || '').trim();
      if (!type) return res.status(400).json({ error: 'Type is required' });

      // NOTE: repo method is findByType (not byType)
      const list = await jokesRepo.findByType(type);
      if (!list.length) return res.status(404).json({ message: 'No jokes available' });
      res.json(list);
    } catch (e) { next(e); }
  };

  const list = async (req, res, next) => {
    try {
      const { type } = req.query;
      const limit = toInt(req.query.limit, 50);

      let data = [];
      if (type) {
        data = await jokesRepo.findByType(String(type));
      } else {
        data = await jokesRepo.all();
      }
      if (limit > 0) data = data.slice(0, limit);
      res.json(data);
    } catch (e) { next(e); }
  };

  return { getRandom, getById, getByType, list };
}
