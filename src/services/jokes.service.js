// services/jokes.service.js
// Pure utilities around jokes + transforming them into "posts" for the feed.

import jokesData from '../data/jokes.js';

/**
 * Return all jokes (in-memory for now).
 */
export function getAllJokes() {
  return jokesData;
}

/**
 * Return a single joke by numeric id, or null if not found.
 */
export function getJokeById(id) {
  const num = Number(id);
  if (!Number.isFinite(num)) return null;
  return jokesData.find(j => j.id === num) ?? null;
}

/**
 * Return jokes that match a type (case-insensitive).
 */
export function getJokesByType(type) {
  if (!type) return [];
  const t = String(type).toLowerCase();
  return jokesData.filter(j => (j.jokeType || '').toLowerCase() === t);
}

/**
 * Return one random joke (or null if empty).
 */
export function getRandomJoke() {
  if (!jokesData.length) return null;
  const i = Math.floor(Math.random() * jokesData.length);
  return jokesData[i];
}

/**
 * Fisher–Yates shuffle (non-mutating).
 */
export function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build "post" view-models for the feed from jokes.
 * Matches the shape your templates expect.
 */
export function buildPosts(source = jokesData, count = 12) {
  const rows = source.slice(0, count);
  return rows.map((j, i) => ({
    id: j.id,
    channelName: ['WTF', 'Humor', 'Science & Tech', 'Random'][i % 4],
    channelIcon: '🟢',
    isoTime: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
    timeAgo: `${i + 1}h`,
    title: j.jokeText.length > 80 ? j.jokeText.slice(0, 80) + '…' : j.jokeText,
    imageUrl: null,             // hook up images later if available
    videoUrl: null,
    tags: [(j.jokeType || 'random').toLowerCase()],
    up: String(Math.floor(200 + Math.random() * 1500)),
    comments: Math.floor(Math.random() * 500),
  }));
}

/**
 * Convenience: build posts from all jokes, then shuffle.
 */
export function buildShuffledPosts(count = 12) {
  return shuffleArray(buildPosts(jokesData, count));
}
