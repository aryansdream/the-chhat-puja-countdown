import test from 'node:test';
import assert from 'node:assert/strict';
import { diyaWaterPosition } from './riverLayout.js';
test('all forty shared diyas stay in their water channels, even at the smallest phone size', () => {
  const width = 200, height = 115;
  const boxes = Array.from({ length: 40 }, (_, i) => {
    const p = diyaWaterPosition(i), scale = p['--diya-scale'];
    const x = parseFloat(p.left) / 100 * width, y = parseFloat(p.top) / 100 * height;
    const halfWidth = 22 * scale / 2 + 2, halfHeight = 18 * scale / 2 + 1.3;
    assert.ok(x - halfWidth > 0 && x + halfWidth < width);
    assert.ok(y - halfHeight > 0 && y + halfHeight < height);
    return { x, y, halfWidth, halfHeight };
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    // The visible flames must remain separate. Soft light reflections may meet.
    assert.ok(Math.abs(a.x - b.x) >= (a.halfWidth + b.halfWidth - 4) || Math.abs(a.y - b.y) >= (a.halfHeight + b.halfHeight - 2.6), `Diyas ${i} and ${j} collide`);
  }
});
