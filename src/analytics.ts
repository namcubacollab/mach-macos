import type { Activity, Category } from './types';

export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  work: { label: 'Công việc', color: '#91aa7e' },
  learn: { label: 'Học hỏi', color: '#a5afd0' },
  social: { label: 'Mạng xã hội', color: '#dfa783' },
  life: { label: 'Cá nhân', color: '#a8c4b4' },
};

export interface UsageSegment {
  startedAt: number;
  endedAt: number;
  event: Activity;
}

const categories = Object.keys(CATEGORIES) as Category[];
const isFocus = (category: Category) => category === 'work' || category === 'learn';
const sourceKey = (event: Activity) => event.domain?.toLowerCase().replace(/^www\./, '') || event.app;
const originalStart = Symbol('original activity start');
type ClippedActivity = Activity & { [originalStart]?: number };
const precedenceStart = (event: ClippedActivity) => event[originalStart] ?? event.startedAt;

/**
 * Usage is elapsed foreground time, not the sum of every collected signal.
 * Browser pages take precedence over app sessions; within either kind the
 * latest started session wins (ID provides a stable tie-break). Interaction
 * records never add time. Adjacent pieces of the same event are merged.
 */
export function usageSegments(events: Activity[]): UsageSegment[] {
  const edges: Array<{ at: number; start: boolean; index: number }> = [];
  const usable = events.filter(event => event.kind !== 'interaction'
    && Number.isFinite(event.startedAt) && Number.isFinite(event.duration) && event.duration > 0);
  usable.forEach((event, index) => {
    const endedAt = event.startedAt + event.duration * 1000;
    if (!Number.isFinite(endedAt) || endedAt <= event.startedAt) return;
    edges.push({ at: event.startedAt, start: true, index }, { at: endedAt, start: false, index });
  });
  edges.sort((a, b) => a.at - b.at || Number(a.start) - Number(b.start));
  const active = new Set<number>();
  // A max-heap with lazy expiry avoids rescanning every overlapping event at
  // each boundary. Even heavily overlapping imports take O(n log n) time.
  const heap: number[] = [];
  const outranks = (left: number, right: number) => {
    const a = usable[left];
    const b = usable[right];
    if (a.kind !== b.kind) return a.kind === 'page';
    const startDifference = precedenceStart(a) - precedenceStart(b);
    if (startDifference) return startDifference > 0;
    if (a.id !== b.id) return a.id > b.id;
    return left < right;
  };
  const push = (index: number) => {
    let slot = heap.length;
    heap.push(index);
    while (slot > 0) {
      const parent = (slot - 1) >> 1;
      if (!outranks(index, heap[parent])) break;
      heap[slot] = heap[parent];
      slot = parent;
    }
    heap[slot] = index;
  };
  const pop = () => {
    const tail = heap.pop();
    if (!heap.length || tail === undefined) return;
    let slot = 0;
    while (slot * 2 + 1 < heap.length) {
      let child = slot * 2 + 1;
      if (child + 1 < heap.length && outranks(heap[child + 1], heap[child])) child++;
      if (!outranks(heap[child], tail)) break;
      heap[slot] = heap[child];
      slot = child;
    }
    heap[slot] = tail;
  };
  const result: UsageSegment[] = [];
  let position = 0;
  while (position < edges.length) {
    const startedAt = edges[position].at;
    while (position < edges.length && edges[position].at === startedAt) {
      const edge = edges[position++];
      if (edge.start) {
        active.add(edge.index);
        push(edge.index);
      }
      else active.delete(edge.index);
    }
    while (heap.length && !active.has(heap[0])) pop();
    if (position === edges.length || active.size === 0) continue;
    const winner = usable[heap[0]];
    if (!winner) continue;
    const endedAt = edges[position].at;
    const previous = result[result.length - 1];
    if (previous && previous.event === winner && previous.endedAt === startedAt) previous.endedAt = endedAt;
    else result.push({ startedAt, endedAt, event: winner });
  }
  return result;
}

export function formatDuration(seconds: number, compact = false): string {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safeSeconds / 60);
  if (minutes < 1) return safeSeconds > 0 ? (compact ? '<1p' : '< 1 phút') : (compact ? '0p' : '0 phút');
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return compact ? `${minutes}p` : `${minutes} phút`;
  if (!rest) return compact ? `${hours}h` : `${hours} giờ`;
  return compact ? `${hours}h ${rest}p` : `${hours} giờ ${rest} phút`;
}

export function formatClock(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '—';
  return new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function dayKey(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** Clip durations at local midnight. Point events belong only to their start day. */
export function dayEvents(events: Activity[], date: Date): Activity[] {
  const { start, end } = dayBounds(date);
  return rangeEvents(events, new Date(start), new Date(end));
}

/**
 * Intersect sessions with [start, endExclusive), retaining point events only
 * when their timestamps fall in that range. The original start remains the
 * overlap priority even when ranges are clipped more than once.
 */
export function rangeEvents(events: Activity[], start: Date, endExclusive: Date): Activity[] {
  const startTime = start.getTime();
  const endTime = endExclusive.getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return [];
  return events.flatMap(event => {
    if (!Number.isFinite(event.startedAt)) return [];
    if (event.kind === 'interaction' || !Number.isFinite(event.duration) || event.duration <= 0) {
      return event.startedAt >= startTime && event.startedAt < endTime ? [{ ...event, duration: 0 }] : [];
    }
    const eventEnd = event.startedAt + event.duration * 1000;
    if (!Number.isFinite(eventEnd)) return [];
    const clippedStart = Math.max(startTime, event.startedAt);
    const clippedEnd = Math.min(endTime, eventEnd);
    return clippedEnd > clippedStart ? [{ ...event, [originalStart]: precedenceStart(event), startedAt: clippedStart, duration: (clippedEnd - clippedStart) / 1000 }] : [];
  });
}

export function summarize(events: Activity[]) {
  const segments = usageSegments(events);
  let totalSeconds = 0;
  let focusSeconds = 0;
  let socialSeconds = 0;
  let contextSwitches = 0;
  let longestFocusSeconds = 0;
  let currentFocusSeconds = 0;
  let previous: UsageSegment | undefined;
  for (const segment of segments) {
    const seconds = (segment.endedAt - segment.startedAt) / 1000;
    totalSeconds += seconds;
    if (segment.event.category === 'social') socialSeconds += seconds;
    const contiguous = previous && segment.startedAt - previous.endedAt <= 1000;
    if (isFocus(segment.event.category)) {
      focusSeconds += seconds;
      currentFocusSeconds = contiguous && previous && isFocus(previous.event.category) ? currentFocusSeconds + seconds : seconds;
      longestFocusSeconds = Math.max(longestFocusSeconds, currentFocusSeconds);
    } else currentFocusSeconds = 0;
    // A return after a longer break is a new session, not a context switch.
    if (previous && segment.startedAt - previous.endedAt <= 5 * 60 * 1000
      && sourceKey(segment.event) !== sourceKey(previous.event)) contextSwitches++;
    previous = segment;
  }
  return {
    totalSeconds,
    focusSeconds,
    socialSeconds,
    visits: events.filter(event => event.kind === 'page').length,
    uniqueDomains: new Set(events.filter(event => event.kind !== 'interaction' && event.domain).map(sourceKey)).size,
    interactions: events.filter(event => event.kind === 'interaction').length,
    contextSwitches,
    longestFocusSeconds,
    focusPercent: totalSeconds ? Math.round(focusSeconds / totalSeconds * 100) : 0,
  };
}

export function categoryTotals(events: Activity[]) {
  const totals: Record<Category, number> = { work: 0, learn: 0, social: 0, life: 0 };
  for (const segment of usageSegments(events)) totals[segment.event.category] += (segment.endedAt - segment.startedAt) / 1000;
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return categories.map(category => ({ category, ...CATEGORIES[category], seconds: totals[category], percent: total ? totals[category] / total * 100 : 0 }));
}

const sourceNames: Record<string, string> = {
  'figma.com': 'Figma', 'github.com': 'GitHub', 'notion.so': 'Notion', 'linear.app': 'Linear',
  'youtube.com': 'YouTube', 'x.com': 'X / Twitter', 'facebook.com': 'Facebook', 'instagram.com': 'Instagram',
  'linkedin.com': 'LinkedIn', 'reddit.com': 'Reddit', 'threads.net': 'Threads', 'threads.com': 'Threads',
  'developer.apple.com': 'Apple Developer', 'react.dev': 'React Docs', 'vercel.com': 'Vercel',
  'read.cv': 'Read.cv', 'are.na': 'Are.na', 'spotify.com': 'Spotify', 'open.spotify.com': 'Spotify',
  'calendar.google.com': 'Google Calendar', 'mail.google.com': 'Gmail', 'docs.google.com': 'Google Docs',
  'medium.com': 'Medium', 'substack.com': 'Substack', 'dribbble.com': 'Dribbble',
};

export function topSources(events: Activity[]) {
  const sources = new Map<string, { name: string; domain?: string; seconds: number; visits: number; category: Category; categorySeconds: Record<Category, number> }>();
  const ensure = (event: Activity) => {
    const key = sourceKey(event);
    let source = sources.get(key);
    if (!source) {
      source = { name: sourceNames[key] || event.domain || event.app, domain: event.domain, seconds: 0, visits: 0,
        category: event.category, categorySeconds: { work: 0, learn: 0, social: 0, life: 0 } };
      sources.set(key, source);
    }
    return source;
  };
  for (const event of events) if (event.kind === 'page') ensure(event).visits++;
  for (const segment of usageSegments(events)) {
    const source = ensure(segment.event);
    const seconds = (segment.endedAt - segment.startedAt) / 1000;
    source.seconds += seconds;
    source.categorySeconds[segment.event.category] += seconds;
  }
  return [...sources.values()].map(({ categorySeconds, ...source }) => ({ ...source,
    category: source.seconds ? categories.reduce((best, category) => categorySeconds[category] > categorySeconds[best] ? category : best, source.category) : source.category,
  })).sort((a, b) => b.seconds - a.seconds || b.visits - a.visits || a.name.localeCompare(b.name));
}

export function hourlyBuckets(events: Activity[], date: Date) {
  const result = Array.from({ length: 24 }, (_, hour) => ({ hour, work: 0, learn: 0, social: 0, life: 0, total: 0 }));
  for (const segment of usageSegments(dayEvents(events, date))) {
    let cursor = segment.startedAt;
    while (cursor < segment.endedAt) {
      const local = new Date(cursor);
      // Advancing absolute time by the remaining minutes also handles repeated DST hours.
      const nextHour = cursor + (60 - local.getMinutes()) * 60000 - local.getSeconds() * 1000 - local.getMilliseconds();
      const until = Math.min(segment.endedAt, nextHour);
      const seconds = (until - cursor) / 1000;
      const bucket = result[local.getHours()];
      bucket[segment.event.category] += seconds;
      bucket.total += seconds;
      cursor = until;
    }
  }
  return result;
}

export function weekDays(events: Activity[], ending: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(ending);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const { totalSeconds, focusSeconds } = summarize(dayEvents(events, date));
    return { date, label: date.getDay() === 0 ? 'CN' : `T${date.getDay() + 1}`, totalSeconds, focusSeconds };
  });
}

export function buildInsights(events: Activity[]): Array<{ id: string; title: string; body: string; tone: 'positive' | 'neutral' | 'warning' }> {
  const summary = summarize(events);
  if (!summary.totalSeconds) return [{ id: 'empty', title: 'Bắt đầu từ một ngày bình thường', body: 'Khi có hoạt động, Mạch sẽ giúp bạn nhìn lại thời gian, nguồn đọc và những khoảng tập trung.', tone: 'neutral' }];
  const insights: Array<{ id: string; title: string; body: string; tone: 'positive' | 'neutral' | 'warning' }> = [];
  if (summary.longestFocusSeconds >= 20 * 60) insights.push({ id: 'focus', title: `${formatDuration(summary.longestFocusSeconds)} liền mạch`, body: 'Đây là khoảng công việc và học hỏi liên tục dài nhất, không xen hoạt động cá nhân hay mạng xã hội.', tone: 'positive' });
  const socialRatio = summary.socialSeconds / summary.totalSeconds;
  if (socialRatio >= .25) insights.push({ id: 'social', title: 'Một khoảng nghỉ có điểm dừng', body: `Mạng xã hội chiếm ${Math.round(socialRatio * 100)}% thời gian (${formatDuration(summary.socialSeconds)}). Thử dành một khung giờ riêng để lướt có chủ đích.`, tone: 'warning' });
  else if (summary.focusPercent >= 60) insights.push({ id: 'balance', title: 'Thời gian đang theo đúng ý bạn', body: `${summary.focusPercent}% thời gian dành cho công việc và học hỏi. Đây là tỷ trọng theo danh mục, không phải điểm đánh giá năng suất.`, tone: 'positive' });
  const learned = categoryTotals(events).find(category => category.category === 'learn');
  if (learned && learned.seconds >= 10 * 60) insights.push({ id: 'learning', title: 'Một chút tò mò mỗi ngày', body: `Bạn dành ${formatDuration(learned.seconds)} cho tài liệu và kiến thức mới. Lưu lại một điều đáng nhớ để lần đọc tiếp theo dễ bắt nhịp.`, tone: 'neutral' });
  const saved = events.filter(event => event.bookmarked).length;
  if (saved) insights.push({ id: 'saved', title: `${saved} dấu mốc để quay lại`, body: 'Các hoạt động được đánh dấu nằm trong Kho lưu. Tìm theo tiêu đề, tên ứng dụng hoặc đường dẫn khi cần xem lại.', tone: 'neutral' });
  if (summary.contextSwitches >= 20) insights.push({ id: 'switches', title: 'Có khá nhiều lần đổi ngữ cảnh', body: `${summary.contextSwitches} lần chuyển giữa các nguồn trong những phiên liền nhau. Gom các tab cùng việc có thể giúp bạn giữ nhịp lâu hơn.`, tone: 'warning' });
  if (!insights.length) insights.push({ id: 'overview', title: 'Bức tranh ngày đang dần rõ', body: `${summary.visits} lượt trang và ${summary.uniqueDomains} website đã được ghi nhận. Xem dòng thời gian để tìm lại mạch hoạt động của bạn.`, tone: 'neutral' });
  return insights.slice(0, 4);
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function searchEvents(events: Activity[], query: string): Activity[] {
  const tokens = normalizeSearch(query.trim()).split(/\s+/).filter(Boolean);
  if (!tokens.length) return events;
  return events.filter(event => {
    const text = normalizeSearch([event.title, event.url, event.domain, event.app, event.excerpt, event.action, CATEGORIES[event.category].label].filter(Boolean).join(' '));
    return tokens.every(token => text.includes(token));
  });
}
