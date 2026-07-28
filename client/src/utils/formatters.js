export function formatDate(value) {
  return new Intl.DateTimeFormat("en-TZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
