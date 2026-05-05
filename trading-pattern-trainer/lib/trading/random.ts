export const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
export const randomInt = (min: number, max: number) => Math.floor(randomBetween(min, max + 1));
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function weightedChoice<T>(choices: Array<{ item: T; weight: number }>): T {
  const total = choices.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
  let roll = randomBetween(0, total || 1);
  for (const c of choices) {
    roll -= Math.max(0, c.weight);
    if (roll <= 0) return c.item;
  }
  return choices[choices.length - 1].item;
}
