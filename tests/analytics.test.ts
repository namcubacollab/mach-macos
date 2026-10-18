import assert from 'node:assert/strict';
import { buildInsights, categoryTotals, dayEvents, dayKey, formatDuration, hourlyBuckets, rangeEvents, searchEvents, summarize, topSources, usageSegments, weekDays } from '../src/analytics';
import { createDemoState } from '../src/demo';
import type { Activity } from '../src/types';

const localTime = (day: number, hour = 0, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
function activity(overrides: Partial<Activity> = {}): Activity {
  return { id: 'a', title: 'Thiết kế đường dẫn', app: 'Arc', domain: 'figma.com', category: 'work', kind: 'page', startedAt: localTime(17, 9), duration: 3600, ...overrides };
}

// Foreground pages override app heartbeats. New pages supersede older pages.
const overlap = [
  activity({ id: 'app', app: 'Arc', kind: 'app', domain: undefined, duration: 7200 }),
  activity({ id: 'page', startedAt: localTime(17, 9, 30), duration: 3600, category: 'learn' }),
  activity({ id: 'social', startedAt: localTime(17, 10), duration: 900, domain: 'x.com', category: 'social' }),
  activity({ id: 'click', kind: 'interaction', duration: 99999, action: 'like' }),
];
assert.equal(summarize(overlap).totalSeconds, 7200);
assert.equal(summarize(overlap).focusSeconds, 6300);
assert.equal(summarize(overlap).socialSeconds, 900);
assert.equal(summarize(overlap).longestFocusSeconds, 3600);
assert.equal(summarize(overlap).interactions, 1);
assert.deepEqual(usageSegments(overlap).map(segment => segment.event.id), ['app', 'page', 'social', 'page', 'app']);
assert.equal(categoryTotals(overlap).reduce((sum, category) => sum + category.seconds, 0), 7200);
assert.equal(topSources(overlap).reduce((sum, source) => sum + source.seconds, 0), 7200);

// A single session may span hours and midnight; usage is attributed exactly.
const overnight = [activity({ startedAt: localTime(16, 23, 30), duration: 5400 })];
assert.equal(summarize(dayEvents(overnight, new Date(localTime(16)))).totalSeconds, 1800);
assert.equal(summarize(dayEvents(overnight, new Date(localTime(17)))).totalSeconds, 3600);
const midnightBuckets = hourlyBuckets(overnight, new Date(localTime(17)));
assert.equal(midnightBuckets.length, 24);
assert.equal(midnightBuckets[0].work, 3600);
assert.equal(midnightBuckets[1].total, 0);
assert.equal(hourlyBuckets(overnight, new Date(localTime(16)))[23].total, 1800);
const midnightOverlap = [activity({ id: 'z-older', startedAt: localTime(16, 23), duration: 7200 }), activity({ id: 'a-newer', startedAt: localTime(16, 23, 30), duration: 5400, category: 'social' })];
assert.equal(summarize(dayEvents(midnightOverlap, new Date(localTime(17)))).socialSeconds, 3600);
const splitHour = hourlyBuckets([activity({ startedAt: localTime(17, 9, 45), duration: 2700 })], new Date(localTime(17)));
assert.equal(splitHour[9].total, 900);
assert.equal(splitHour[10].total, 1800);
assert.equal(hourlyBuckets(overlap, new Date(localTime(17))).reduce((sum, bucket) => sum + bucket.total, 0), 7200);

// Weekly ranges include sessions crossing in, clip sessions crossing out, and
// exclude records at the exclusive end even when they have zero duration.
const weekStart = new Date(localTime(11));
const weekEnd = new Date(localTime(18));
const crossWeek = [
  activity({ id: 'enters-week', startedAt: localTime(10, 23, 30), duration: 3600 }),
  activity({ id: 'ends-at-start', startedAt: localTime(10, 23), duration: 3600 }),
  activity({ id: 'starts-at-start', startedAt: localTime(11), duration: 0 }),
  activity({ id: 'leaves-week', startedAt: localTime(17, 23, 45), duration: 3600, category: 'social' }),
  activity({ id: 'at-end', startedAt: localTime(18), duration: 0 }),
  activity({ id: 'interaction-inside', kind: 'interaction', startedAt: localTime(17, 23, 59), duration: 99999 }),
  activity({ id: 'interaction-outside', kind: 'interaction', startedAt: localTime(18), duration: 99999 }),
];
const clippedWeek = rangeEvents(crossWeek, weekStart, weekEnd);
assert.deepEqual(clippedWeek.map(event => event.id), ['enters-week', 'starts-at-start', 'leaves-week', 'interaction-inside']);
assert.equal(clippedWeek[0].startedAt, weekStart.getTime());
assert.equal(clippedWeek[0].duration, 1800);
assert.equal(clippedWeek[2].duration, 900);
assert.equal(summarize(clippedWeek).totalSeconds, 2700);
assert.equal(summarize(clippedWeek).interactions, 1);
assert.equal(weekDays(crossWeek, new Date(localTime(17))).reduce((sum, day) => sum + day.totalSeconds, 0), summarize(clippedWeek).totalSeconds);
assert.equal(crossWeek[0].startedAt, localTime(10, 23, 30));
assert.equal(crossWeek[0].duration, 3600);
assert.deepEqual(rangeEvents(crossWeek, weekStart, weekStart), []);
assert.deepEqual(rangeEvents(crossWeek, weekEnd, weekStart), []);
assert.deepEqual(rangeEvents(crossWeek, new Date(NaN), weekEnd), []);
assert.deepEqual(rangeEvents(crossWeek, weekStart, new Date(NaN)), []);
const reclipped = dayEvents(rangeEvents(midnightOverlap, new Date(localTime(16, 23, 45)), weekEnd), new Date(localTime(17)));
assert.equal(summarize(reclipped).socialSeconds, 3600);

// Compare the heap sweep with a simple independent per-second oracle across
// deterministic overlapping imports, including equal starts and page/app ties.
let randomSeed = 8357;
const random = () => {
  randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
  return randomSeed / 2 ** 32;
};
for (let trial = 0; trial < 20; trial++) {
  const generated = Array.from({ length: 100 }, (_, index) => activity({
    id: `generated-${index}`,
    startedAt: localTime(17) + Math.floor(random() * 80) * 1000,
    duration: 1 + Math.floor(random() * 30),
    kind: random() < .5 ? 'app' : 'page',
    category: random() < .5 ? 'work' : 'social',
  }));
  const segments = usageSegments(generated);
  for (let second = 0; second < 110; second++) {
    const at = localTime(17) + second * 1000;
    const oracle = generated.filter(event => event.startedAt <= at && event.startedAt + event.duration * 1000 > at)
      .sort((a, b) => Number(b.kind === 'page') - Number(a.kind === 'page') || b.startedAt - a.startedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))[0];
    const actual = segments.find(segment => segment.startedAt <= at && segment.endedAt > at)?.event;
    assert.equal(actual?.id, oracle?.id);
  }
}

// Zero-duration visits and interactions count, but cannot fabricate elapsed time.
const pointEvents = [activity({ duration: 0 }), activity({ id: 'like', kind: 'interaction', duration: 12, action: 'like' })];
assert.equal(summarize(pointEvents).totalSeconds, 0);
assert.equal(summarize(pointEvents).visits, 1);
assert.equal(summarize(pointEvents).interactions, 1);
assert.equal(dayEvents(pointEvents, new Date(localTime(17))).length, 2);
assert.equal(dayEvents([activity({ startedAt: localTime(18), duration: 0 })], new Date(localTime(17))).length, 0);
assert.equal(summarize([activity({ duration: -1 }), activity({ duration: NaN }), activity({ startedAt: NaN })]).totalSeconds, 0);
assert.equal(summarize([]).focusPercent, 0);
assert.ok(categoryTotals([]).every(category => category.percent === 0));
assert.equal(buildInsights([])[0].id, 'empty');

// Accent-insensitive search includes Vietnamese đ, URLs, excerpts, and categories.
const searchable = [activity({ excerpt: 'Ghi chú về trạng thái trống' }), activity({ id: 'other', title: 'Nghỉ ngơi', category: 'life', domain: 'spotify.com' })];
assert.equal(searchEvents(searchable, 'THIET KE duong').length, 1);
assert.equal(searchEvents(searchable, 'trang thai trong')[0].id, 'a');
assert.equal(searchEvents(searchable, 'ca nhan')[0].id, 'other');
assert.equal(searchEvents(searchable, 'figma.com')[0].id, 'a');
assert.equal(searchEvents(searchable, 'khong-co').length, 0);
assert.equal(searchEvents(searchable, ' ').length, 2);

// No context switch is counted across a lunch break, even between different apps.
assert.equal(summarize([activity({ duration: 600 }), activity({ id: 'b', domain: 'github.com', startedAt: localTime(17, 13), duration: 600 })]).contextSwitches, 0);
assert.equal(summarize([activity({ duration: 600 }), activity({ id: 'b', domain: 'github.com', startedAt: localTime(17, 9, 10), duration: 600 })]).contextSwitches, 1);
assert.equal(summarize([activity({ duration: 600 }), activity({ id: 'b', domain: 'github.com', startedAt: localTime(17, 9, 10), duration: 600 })]).longestFocusSeconds, 1200);
assert.equal(dayKey(new Date(localTime(17))), '2026-10-17');
assert.equal(formatDuration(3600), '1 giờ');
assert.equal(formatDuration(3660, true), '1h 1p');
assert.equal(formatDuration(0), '0 phút');
assert.equal(formatDuration(30), '< 1 phút');

// The showcase is stable, covers seven local days, and defaults to no collection.
const sampleDate = new Date(localTime(17, 20));
const demo = createDemoState(sampleDate);
assert.deepEqual(demo, createDemoState(sampleDate));
assert.equal(demo.collector.platform, 'demo');
assert.equal(demo.settings.recording, false);
assert.equal(demo.settings.captureSocial, false);
assert.equal(new Set(demo.events.map(event => dayKey(event.startedAt))).size, 7);
assert.equal(new Set(demo.events.map(event => event.id)).size, demo.events.length);
const today = dayEvents(demo.events, sampleDate);
assert.equal(summarize(today).totalSeconds, 324 * 60);
assert.equal(summarize(today).interactions, 10);
assert.ok(weekDays(demo.events, sampleDate).every(day => day.totalSeconds > 0));
assert.equal(weekDays(demo.events, sampleDate)[6].totalSeconds, summarize(today).totalSeconds);
console.log('Analytics: interval precedence, day/hour attribution, search and demo fixtures passed.');
