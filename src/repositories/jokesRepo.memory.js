// src/repositories/jokesRepo.memory.js
import { JOKES_SEED } from '../data/jokes.js';

export function createJokesRepo({ seed = JOKES_SEED } = {}) {
  // shallow-clone so callers can’t mutate your seed
  const _data = seed.map(j => ({ ...j }));

  const all = async () => _data;

  const findById = async (id) =>
    _data.find(j => j.id === Number(id)) || null;

  const findByType = async (type) => {
    if (!type) return [];
    const t = String(type).toLowerCase();
    return _data.filter(j => (j.jokeType || '').toLowerCase() === t);
  };

  const random = async () =>
    _data[Math.floor(Math.random() * _data.length)] || null;

  // optional: simple text search
  const search = async (q) => {
    if (!q) return [];
    const term = String(q).toLowerCase();
    return _data.filter(j =>
      (j.jokeText || '').toLowerCase().includes(term) ||
      (j.jokeType || '').toLowerCase().includes(term)
    );
  };

  return { all, findById, findByType, random, search };
}
