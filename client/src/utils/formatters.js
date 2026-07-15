export function formatDate(value) {
  return new Intl.DateTimeFormat("en-TZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function money(value) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function usd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}
