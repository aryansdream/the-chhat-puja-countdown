// Scene-local coordinates: eight gently staggered channels stay inside the water.
export function diyaWaterPosition(index) {
  const row = Math.floor(index / 8), column = index % 8;
  const depth = row / 4;
  const left = 8 + column * 11.5 + (row % 2 ? 2 : -1);
  const top = 12 + row * 17 + Math.sin(index * 2.7) * .8;
  return { left: `${left}%`, top: `${top}%`, '--diya-scale': .68 + depth * .3,
    '--drift-x': `${Math.sin(index) * 2}px`, '--drift-y': '1.3px' };
}

