const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDayParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

export function formatDayShort(date: string): string {
  const { month, day } = parseDayParts(date);
  return `${MONTHS_SHORT[month - 1]} ${day}`;
}

export function formatDayLong(date: string): string {
  const { year, month, day } = parseDayParts(date);
  return `${MONTHS_LONG[month - 1]} ${day}, ${year}`;
}
