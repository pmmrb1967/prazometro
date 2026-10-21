import { defineProject } from 'vitest/config';

// Cada teste arranca uma base D1 local (Miniflare): com vários ficheiros em paralelo, o
// arranque pode passar dos 10 s por defeito.
export default defineProject({
  test: { name: 'monitor', hookTimeout: 30_000, testTimeout: 30_000 },
});
