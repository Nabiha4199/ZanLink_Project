export function formatDate(value) {
  return new Intl.DateTimeFormat("en-TZ", { dateStyle: "medium", timeStyle: "short", hour12: true }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-TZ", { hour: "numeric", minute: "2-digit", hour12: true }).format(value);
  }
  const text = String(value).trim();
  if (/[ap]\.?m\.?$/i.test(text)) return text.toUpperCase().replace(/\./g, "");
  const timeMatch = text.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const date = new Date();
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    return new Intl.DateTimeFormat("en-TZ", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  }
  return text;
}

export function money(value, currency = "TZS") {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Number(value || 0));
}

export function usd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}
