// Kartik Chhath dates, checked against Drik Panchang's four-day calendars.
// https://www.drikpanchang.com/chhath/chhath-puja-calendar.html?year=2026
// Extend this table with verified lunar dates; never add 365 days to a festival.
export const FESTIVALS = [
  ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'],
  ['2027-11-02', '2027-11-03', '2027-11-04', '2027-11-05'],
  ['2028-10-21', '2028-10-22', '2028-10-23', '2028-10-24'],
  ['2029-11-09', '2029-11-10', '2029-11-11', '2029-11-12'],
  ['2030-10-30', '2030-10-31', '2030-11-01', '2030-11-02'],
].map(dates => ({ year: Number(dates[0].slice(0, 4)), dates,
  starts: dates.map(date => Date.parse(`${date}T00:00:00+05:30`)),
  end: Date.parse(`${dates[3]}T00:00:00+05:30`) + 86400000,
}));

export function festivalState(now = Date.now()) {
  const festival = FESTIVALS.find(item => now < item.end);
  if (!festival) return { festival: FESTIVALS.at(-1), day: -1, target: null, nextDay: null, status: 'unlisted' };
  const day = festival.starts.findLastIndex(start => now >= start);
  const status = day < 0 ? (now >= FESTIVALS[0].end ? 'next-year' : 'upcoming') : 'active';
  return { festival, day, status, nextDay: day < 0 ? 0 : day < 3 ? day + 1 : null,
    target: day < 0 ? festival.starts[0] : day < 3 ? festival.starts[day + 1] : null };
}

export function countdownParts(now, target) {
  const diff = Math.max(0, (target ?? now) - now);
  return { days: Math.floor(diff / 86400000), hours: Math.floor(diff % 86400000 / 3600000),
    minutes: Math.floor(diff % 3600000 / 60000), seconds: Math.floor(diff % 60000 / 1000) };
}

export function ritualDate(date, language = 'en', withWeekday = false) {
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
    ...(withWeekday ? { weekday: 'long' } : {}),
  }).format(new Date(`${date}T00:00:00+05:30`));
}

export function festivalRange(festival, language = 'en') {
  const formatter = new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
  });
  return formatter.formatRange(new Date(festival.starts[0]), new Date(festival.starts[3]));
}
