const SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const MIN_REQUEST_INTERVAL_MS = 1100;
const CACHE_KEY = "zanlink:zanzibar-location-searches";
const MAX_CACHED_SEARCHES = 200;

let lastRequestAt = 0;

const zanzibarAdministrativeLocations = [
  ["Kaskazini Unguja Region", "Zanzibar"],
  ["Kaskazini A Municipal Council", "Kaskazini Unguja Region"],
  ["Kaskazini B Town Council", "Kaskazini Unguja Region"],
  ["Kusini Unguja Region", "Zanzibar"],
  ["Kati Town Council", "Kusini Unguja Region"],
  ["Kusini District Council", "Kusini Unguja Region"],
  ["Mjini Magharibi Region", "Zanzibar"],
  ["Mjini Municipal Council", "Mjini Magharibi Region"],
  ["Magharibi A Municipal Council", "Mjini Magharibi Region"],
  ["Magharibi B Municipal Council", "Mjini Magharibi Region"],
  ["Kaskazini Pemba Region", "Zanzibar"],
  ["Wete Town Council", "Kaskazini Pemba Region"],
  ["Micheweni District Council", "Kaskazini Pemba Region"],
  ["Kusini Pemba Region", "Zanzibar"],
  ["Chake Chake Town Council", "Kusini Pemba Region"],
  ["Mkoani Town Council", "Kusini Pemba Region"],
  ["Stone Town", "Mjini Municipal Council, Mjini Magharibi"],
  ["Darajani", "Mjini Municipal Council, Mjini Magharibi"],
  ["Mkunazini", "Mjini Municipal Council, Mjini Magharibi"],
  ["Kiponda", "Mjini Municipal Council, Mjini Magharibi"],
  ["Malindi", "Mjini Municipal Council, Mjini Magharibi"],
  ["Forodhani", "Mjini Municipal Council, Mjini Magharibi"],
  ["Shangani", "Mjini Municipal Council, Mjini Magharibi"],
  ["Mlandege", "Mjini Municipal Council, Mjini Magharibi"],
  ["Michenzani", "Mjini Municipal Council, Mjini Magharibi"],
  ["Kikwajuni", "Mjini Municipal Council, Mjini Magharibi"],
  ["Mwanakwerekwe", "Magharibi A Municipal Council, Mjini Magharibi"],
  ["Kisauni", "Magharibi A Municipal Council, Mjini Magharibi"],
  ["Mbweni", "Magharibi B Municipal Council, Mjini Magharibi"],
  ["Chukwani", "Magharibi B Municipal Council, Mjini Magharibi"],
  ["Kiembesamaki", "Magharibi B Municipal Council, Mjini Magharibi"],
  ["Fuoni", "Magharibi A Municipal Council, Mjini Magharibi"],
  ["Bububu", "Magharibi A Municipal Council, Mjini Magharibi"],
  ["Mtoni", "Magharibi A Municipal Council, Mjini Magharibi"],
  ["Nungwi", "Kaskazini A Municipal Council, Kaskazini Unguja"],
  ["Kendwa", "Kaskazini A Municipal Council, Kaskazini Unguja"],
  ["Matemwe", "Kaskazini A Municipal Council, Kaskazini Unguja"],
  ["Kiwengwa", "Kaskazini B Town Council, Kaskazini Unguja"],
  ["Pongwe", "Kaskazini B Town Council, Kaskazini Unguja"],
  ["Mangapwani", "Kaskazini B Town Council, Kaskazini Unguja"],
  ["Koani", "Kati Town Council, Kusini Unguja"],
  ["Jozani", "Kati Town Council, Kusini Unguja"],
  ["Bwejuu", "Kati Town Council, Kusini Unguja"],
  ["Paje", "Kusini District Council, Kusini Unguja"],
  ["Jambiani", "Kusini District Council, Kusini Unguja"],
  ["Makunduchi", "Kusini District Council, Kusini Unguja"],
  ["Kizimkazi", "Kusini District Council, Kusini Unguja"],
  ["Wete", "Wete Town Council, Kaskazini Pemba"],
  ["Konde", "Micheweni District Council, Kaskazini Pemba"],
  ["Micheweni", "Micheweni District Council, Kaskazini Pemba"],
  ["Chake Chake", "Chake Chake Town Council, Kusini Pemba"],
  ["Mkoani", "Mkoani Town Council, Kusini Pemba"],
  ["Mizingani Road", "Stone Town, Mjini Magharibi"],
  ["Kenyatta Road", "Stone Town, Mjini Magharibi"],
  ["Creek Road", "Stone Town, Mjini Magharibi"],
  ["Gizenga Street", "Stone Town, Mjini Magharibi"],
  ["Hurumzi Street", "Stone Town, Mjini Magharibi"],
  ["Sokomuhogo Street", "Stone Town, Mjini Magharibi"],
  ["Shangani Street", "Stone Town, Mjini Magharibi"],
  ["Kiponda Street", "Stone Town, Mjini Magharibi"],
  ["Malindi Street", "Stone Town, Mjini Magharibi"],
  ["Darajani Road", "Stone Town, Mjini Magharibi"],
  ["Vuga Road", "Stone Town, Mjini Magharibi"],
  ["Mkunazini Road", "Stone Town, Mjini Magharibi"],
  ["Mchangani Road", "Stone Town, Mjini Magharibi"],
  ["Benjamin Mkapa Road", "Mjini Magharibi"],
  ["Malawi Road", "Mjini Magharibi"],
  ["Karume Road", "Mjini Magharibi"],
  ["Nyerere Road", "Mjini Magharibi"],
  ["Airport Road", "Mjini Magharibi"],
  ["Kaunda Road", "Mjini Magharibi"],
  ["Mlandege Road", "Mjini Magharibi"],
  ["Michenzani Road", "Mjini Magharibi"],
  ["Kikwajuni Road", "Mjini Magharibi"],
  ["Kilimani Road", "Mjini Magharibi"],
  ["Amani Road", "Mjini Magharibi"],
  ["Kwa Mchina Road", "Mjini Magharibi"],
  ["Magomeni Road", "Mjini Magharibi"],
  ["Mwanakwerekwe Road", "Mjini Magharibi"],
  ["Kisauni Road", "Mjini Magharibi"],
  ["Mazizini Road", "Mjini Magharibi"],
  ["Chukwani Road", "Mjini Magharibi"],
  ["Mbweni Road", "Mjini Magharibi"],
  ["Fuoni Road", "Mjini Magharibi"],
  ["Bububu Road", "Mjini Magharibi"],
  ["Mtoni Road", "Mjini Magharibi"],
  ["Chuini Road", "Mjini Magharibi"],
  ["Kiembe Samaki Road", "Mjini Magharibi"],
  ["Fumba Road", "Kusini Magharibi"],
  ["Nungwi Road", "Kaskazini Unguja"],
  ["Kendwa Road", "Kaskazini Unguja"],
  ["Matemwe Road", "Kaskazini Unguja"],
  ["Kiwengwa Road", "Kaskazini Unguja"],
  ["Pongwe Road", "Kaskazini Unguja"],
  ["Mangapwani Road", "Kaskazini Unguja"],
  ["Koani Road", "Kusini Unguja"],
  ["Jozani Road", "Kusini Unguja"],
  ["Paje Road", "Kusini Unguja"],
  ["Jambiani Road", "Kusini Unguja"],
  ["Bwejuu Road", "Kusini Unguja"],
  ["Makunduchi Road", "Kusini Unguja"],
  ["Kizimkazi Road", "Kusini Unguja"],
  ["Wete Road", "Kaskazini Pemba"],
  ["Micheweni Road", "Kaskazini Pemba"],
  ["Konde Road", "Kaskazini Pemba"],
  ["Chake Chake Road", "Kusini Pemba"],
  ["Mkoani Road", "Kusini Pemba"],
].map(([name, area], index) => ({
  id: `zanzibar-admin-${index}`,
  name,
  label: `${name}, ${area}, Zanzibar`,
}));

function isWithinZanzibar(latitude, longitude) {
  const inUnguja = latitude >= -6.55 && latitude <= -5.68 && longitude >= 39.08 && longitude <= 39.62;
  const inPemba = latitude >= -5.58 && latitude <= -4.72 && longitude >= 39.48 && longitude <= 40.02;
  return inUnguja || inPemba;
}

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

  const administrativeMatches = zanzibarAdministrativeLocations.filter((place) =>
    `${place.name} ${place.label}`.toLowerCase().includes(normalizedQuery)
  );
  const cache = readCache();
  if (cache[normalizedQuery]) {
    return [...administrativeMatches, ...cache[normalizedQuery]]
      .filter((place, index, all) => all.findIndex((item) => item.label === place.label) === index)
      .slice(0, 20);
  }

  await waitForRequestSlot(signal);
  lastRequestAt = Date.now();

  const params = new URLSearchParams({
    q: `${query.trim()}, Zanzibar`,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "tz",
    limit: "50",
    viewbox: "39.05,-4.70,40.10,-6.60",
    bounded: "1",
    "accept-language": "en",
  });
  let results = [];
  try {
    const response = await fetch(`${SEARCH_ENDPOINT}?${params}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Location search failed (${response.status})`);
    }
    results = (await response.json())
      .filter((place) => isWithinZanzibar(Number(place.lat), Number(place.lon)))
      .map((place) => ({
        id: `${place.osm_type}-${place.osm_id}`,
        name: place.name || place.display_name.split(",")[0],
        label: place.display_name.slice(0, 180),
        latitude: Number(place.lat),
        longitude: Number(place.lon),
      }));
  } catch (error) {
    if (error.name === "AbortError" || !administrativeMatches.length) throw error;
  }

  cache[normalizedQuery] = results;
  writeCache(cache);
  return [...administrativeMatches, ...results]
    .filter((place, index, all) => all.findIndex((item) => item.label === place.label) === index)
    .slice(0, 20);
}

export async function reverseZanzibarLocation(latitude, longitude, signal) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isWithinZanzibar(lat, lon)) {
    throw new Error("Your current position is outside Zanzibar.");
  }

  const cacheKey = `gps:${lat.toFixed(5)},${lon.toFixed(5)}`;
  const cache = readCache();
  if (cache[cacheKey]) return cache[cacheKey];

  await waitForRequestSlot(signal);
  lastRequestAt = Date.now();
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "18",
    "accept-language": "en",
  });
  const response = await fetch(`${REVERSE_ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("We could not identify an address for your current position.");
  }

  const place = await response.json();
  const result = {
    id: `${place.osm_type}-${place.osm_id}`,
    name: place.name || place.display_name.split(",")[0],
    label: place.display_name.slice(0, 180),
    latitude: lat,
    longitude: lon,
  };
  cache[cacheKey] = result;
  writeCache(cache);
  return result;
}
