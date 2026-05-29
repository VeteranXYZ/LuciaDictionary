export const STREAK_COUNT_KEY = "lucia_daily_streak";
export const STREAK_LAST_DATE_KEY = "lucia_last_active_date";

export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToUtcDay(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day) / 86400000;
}

export function calculateDailyStreak(previous = {}, todayKey = toDateKey()) {
  const lastDate = previous.lastDate || "";
  const current = Math.max(1, Number(previous.count) || 1);
  if (lastDate === todayKey) return { count: current, lastDate: todayKey };

  const lastDay = dateKeyToUtcDay(lastDate);
  const today = dateKeyToUtcDay(todayKey);
  const count = lastDay != null && today != null && today - lastDay === 1 ? current + 1 : 1;
  return { count, lastDate: todayKey };
}

export function updateDailyStreak(storage = localStorage, date = new Date()) {
  const todayKey = toDateKey(date);
  const next = calculateDailyStreak({
    count: storage.getItem(STREAK_COUNT_KEY),
    lastDate: storage.getItem(STREAK_LAST_DATE_KEY)
  }, todayKey);
  storage.setItem(STREAK_COUNT_KEY, String(next.count));
  storage.setItem(STREAK_LAST_DATE_KEY, next.lastDate);
  return next;
}
