import test from 'node:test';
import assert from 'node:assert/strict';
import { FESTIVALS, festivalState, countdownParts, festivalRange, ritualDate } from './festival.js';
const at = value => Date.parse(value);
test('each festival changes day at midnight IST, including when the browser is abroad', () => {
  for (const festival of FESTIVALS) {
    festival.starts.forEach((start, day) => {
      assert.equal(festivalState(start).day, day);
      assert.equal(festivalState(start).festival.year, festival.year);
      if (day) assert.equal(festivalState(start - 1).day, day - 1);
      const active = festivalState(start + 12 * 3600000);
      assert.equal(active.day, day);
      assert.equal(active.target, day < 3 ? festival.starts[day + 1] : null);
    });
  }
  assert.equal(festivalState(at('2026-11-13T18:30:00Z')).day, 1);
});
test('final day remains Usha Arghya; midnight rolls to the verified following lunar year', () => {
  assert.equal(festivalState(at('2026-11-16T23:59:59+05:30')).day, 3);
  const next = festivalState(at('2026-11-17T00:00:00+05:30'));
  assert.equal(next.status, 'next-year');
  assert.equal(next.festival.year, 2027);
  assert.equal(next.target, at('2027-11-02T00:00:00+05:30'));
  assert.equal(next.day, -1);
  assert.ok(countdownParts(at('2026-11-17T00:00:00+05:30'), next.target).days > 300);
  assert.equal(festivalState(at('2027-01-01T00:00:00+05:30')).festival.year, 2027);
});
test('countdown handles second boundaries without negative or invalid values', () => {
  const target = at('2026-11-15T00:00:00+05:30');
  assert.deepEqual(countdownParts(target - 90061000, target), { days: 1, hours: 1, minutes: 1, seconds: 1 });
  assert.deepEqual(countdownParts(target + 1000, target), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});
test('dates localize and ranges support festivals spanning months', () => {
  assert.match(ritualDate('2027-11-02'), /2027/);
  assert.match(ritualDate('2027-11-02', 'hi'), /नवंबर/);
  assert.match(festivalRange(FESTIVALS[4]), /October/);
  assert.match(festivalRange(FESTIVALS[4]), /November/);
});
test('exhausted calendar does not invent future lunar dates or freeze a countdown', () => {
  const state = festivalState(FESTIVALS.at(-1).end);
  assert.equal(state.status, 'unlisted');
  assert.equal(state.target, null);
});
