// Logical game size. The renderer draws at SCALE x this size.
export const W = 256;
export const H = 240;
export const SCALE = 3;

export const GRASS_Y = 176;          // top of the foreground grass
export const FLY_FLOOR = GRASS_Y - 40; // lowest y a flying duck turns back from
export const LAND_Y = GRASS_Y + 20;  // a falling duck is hidden by the grass here

export const DUCKS_PER_ROUND = 10;
export const DUCKS_PER_WAVE = 1;
export const SHOTS_PER_WAVE = 3;

export const requiredHits = (round) => Math.min(9, 6 + Math.floor((round - 1) / 2));
export const duckSpeed = (round) => Math.min(170, 75 + 10 * round);
export const flightTime = (round) => Math.max(4.5, 7 - 0.3 * round);
export const pointsFor = (type, round) => [500, 1000, 1500][type] * (1 + Math.floor((round - 1) / 5));
export const pickDuckType = (round) => {
  const r = Math.random();
  if (round < 3) return 0;
  if (round < 6) return r < 0.5 ? 0 : 1;
  return r < 0.34 ? 0 : r < 0.67 ? 1 : 2;
};
