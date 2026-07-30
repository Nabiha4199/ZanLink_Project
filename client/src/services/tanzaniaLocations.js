const SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const MIN_REQUEST_INTERVAL_MS = 1100;
const CACHE_KEY = "zanlink:tanzania-location-searches";
const MAX_CACHED_SEARCHES = 80;

let lastRequestAt = 0;

function readCache() {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    const entries = Object.entries(cache).slice(-MAX_CACHED_SEARCHES);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Suggestions still work when browser storage is unavailable.
  }
}

function waitForRequestSlot(signal) {
  const delay = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
  if (!delay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delay);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Search cancelled", "AbortError"));
    }, { once: true });
  });
}

export async function searchTanzaniaLocations(query, signal) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  const cache = readCache();
  if (cache[normalizedQuery]) return cache[normalizedQuery];

  await waitForRequestSlot(signal);
  lastRequestAt = Date.now();

  const params = new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "tz",
    limit: "8",
    "accept-language": "en",
  });
  const response = await fetch(`${SEARCH_ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Location search failed (${response.status})`);
  }

  const results = (await response.json()).map((place) => ({
    id: `${place.osm_type}-${place.osm_id}`,
    name: place.name || place.display_name.split(",")[0],
    label: place.display_name,
  }));

  cache[normalizedQuery] = results;
  writeCache(cache);
  return results;
}
