import React, { useEffect, useId, useRef, useState } from "react";
import { searchTanzaniaLocations } from "../services/tanzaniaLocations";

export const countryCodes = [
  ["TZ", "Tanzania", "+255"],
  ["AF", "Afghanistan", "+93"],
  ["AL", "Albania", "+355"],
  ["DZ", "Algeria", "+213"],
  ["AS", "American Samoa", "+1-684"],
  ["AD", "Andorra", "+376"],
  ["AO", "Angola", "+244"],
  ["AI", "Anguilla", "+1-264"],
  ["AQ", "Antarctica", "+672"],
  ["AG", "Antigua and Barbuda", "+1-268"],
  ["AR", "Argentina", "+54"],
  ["AM", "Armenia", "+374"],
  ["AW", "Aruba", "+297"],
  ["AU", "Australia", "+61"],
  ["AT", "Austria", "+43"],
  ["AZ", "Azerbaijan", "+994"],
  ["BS", "Bahamas", "+1-242"],
  ["BH", "Bahrain", "+973"],
  ["BD", "Bangladesh", "+880"],
  ["BB", "Barbados", "+1-246"],
  ["BY", "Belarus", "+375"],
  ["BE", "Belgium", "+32"],
  ["BZ", "Belize", "+501"],
  ["BJ", "Benin", "+229"],
  ["BM", "Bermuda", "+1-441"],
  ["BT", "Bhutan", "+975"],
  ["BO", "Bolivia", "+591"],
  ["BQ", "Bonaire, Sint Eustatius and Saba", "+599"],
  ["BA", "Bosnia and Herzegovina", "+387"],
  ["BW", "Botswana", "+267"],
  ["BR", "Brazil", "+55"],
  ["IO", "British Indian Ocean Territory", "+246"],
  ["VG", "British Virgin Islands", "+1-284"],
  ["BN", "Brunei", "+673"],
  ["BG", "Bulgaria", "+359"],
  ["BF", "Burkina Faso", "+226"],
  ["BI", "Burundi", "+257"],
  ["KH", "Cambodia", "+855"],
  ["CM", "Cameroon", "+237"],
  ["CA", "Canada", "+1"],
  ["CV", "Cape Verde", "+238"],
  ["KY", "Cayman Islands", "+1-345"],
  ["CF", "Central African Republic", "+236"],
  ["TD", "Chad", "+235"],
  ["CL", "Chile", "+56"],
  ["CN", "China", "+86"],
  ["CX", "Christmas Island", "+61"],
  ["CC", "Cocos Islands", "+61"],
  ["CO", "Colombia", "+57"],
  ["KM", "Comoros", "+269"],
  ["CG", "Congo", "+242"],
  ["CD", "Congo DR", "+243"],
  ["CK", "Cook Islands", "+682"],
  ["CR", "Costa Rica", "+506"],
  ["CI", "Cote d'Ivoire", "+225"],
  ["HR", "Croatia", "+385"],
  ["CU", "Cuba", "+53"],
  ["CW", "Curacao", "+599"],
  ["CY", "Cyprus", "+357"],
  ["CZ", "Czech Republic", "+420"],
  ["DK", "Denmark", "+45"],
  ["DJ", "Djibouti", "+253"],
  ["DM", "Dominica", "+1-767"],
  ["DO", "Dominican Republic", "+1-809"],
  ["EC", "Ecuador", "+593"],
  ["EG", "Egypt", "+20"],
  ["SV", "El Salvador", "+503"],
  ["GQ", "Equatorial Guinea", "+240"],
  ["ER", "Eritrea", "+291"],
  ["EE", "Estonia", "+372"],
  ["SZ", "Eswatini", "+268"],
  ["ET", "Ethiopia", "+251"],
  ["FK", "Falkland Islands", "+500"],
  ["FO", "Faroe Islands", "+298"],
  ["FJ", "Fiji", "+679"],
  ["FI", "Finland", "+358"],
  ["FR", "France", "+33"],
  ["GF", "French Guiana", "+594"],
  ["PF", "French Polynesia", "+689"],
  ["GA", "Gabon", "+241"],
  ["GM", "Gambia", "+220"],
  ["GE", "Georgia", "+995"],
  ["DE", "Germany", "+49"],
  ["GH", "Ghana", "+233"],
  ["GI", "Gibraltar", "+350"],
  ["GR", "Greece", "+30"],
  ["GL", "Greenland", "+299"],
  ["GD", "Grenada", "+1-473"],
  ["GP", "Guadeloupe", "+590"],
  ["GU", "Guam", "+1-671"],
  ["GT", "Guatemala", "+502"],
  ["GG", "Guernsey", "+44-1481"],
  ["GN", "Guinea", "+224"],
  ["GW", "Guinea-Bissau", "+245"],
  ["GY", "Guyana", "+592"],
  ["HT", "Haiti", "+509"],
  ["HN", "Honduras", "+504"],
  ["HK", "Hong Kong", "+852"],
  ["HU", "Hungary", "+36"],
  ["IS", "Iceland", "+354"],
  ["IN", "India", "+91"],
  ["ID", "Indonesia", "+62"],
  ["IR", "Iran", "+98"],
  ["IQ", "Iraq", "+964"],
  ["IE", "Ireland", "+353"],
  ["IM", "Isle of Man", "+44-1624"],
  ["IL", "Israel", "+972"],
  ["IT", "Italy", "+39"],
  ["JM", "Jamaica", "+1-876"],
  ["JP", "Japan", "+81"],
  ["JE", "Jersey", "+44-1534"],
  ["JO", "Jordan", "+962"],
  ["KZ", "Kazakhstan", "+7"],
  ["KE", "Kenya", "+254"],
  ["KI", "Kiribati", "+686"],
  ["XK", "Kosovo", "+383"],
  ["KW", "Kuwait", "+965"],
  ["KG", "Kyrgyzstan", "+996"],
  ["LA", "Laos", "+856"],
  ["LV", "Latvia", "+371"],
  ["LB", "Lebanon", "+961"],
  ["LS", "Lesotho", "+266"],
  ["LR", "Liberia", "+231"],
  ["LY", "Libya", "+218"],
  ["LI", "Liechtenstein", "+423"],
  ["LT", "Lithuania", "+370"],
  ["LU", "Luxembourg", "+352"],
  ["MO", "Macau", "+853"],
  ["MG", "Madagascar", "+261"],
  ["MW", "Malawi", "+265"],
  ["MY", "Malaysia", "+60"],
  ["MV", "Maldives", "+960"],
  ["ML", "Mali", "+223"],
  ["MT", "Malta", "+356"],
  ["MH", "Marshall Islands", "+692"],
  ["MQ", "Martinique", "+596"],
  ["MR", "Mauritania", "+222"],
  ["MU", "Mauritius", "+230"],
  ["YT", "Mayotte", "+262"],
  ["MX", "Mexico", "+52"],
  ["FM", "Micronesia", "+691"],
  ["MD", "Moldova", "+373"],
  ["MC", "Monaco", "+377"],
  ["MN", "Mongolia", "+976"],
  ["ME", "Montenegro", "+382"],
  ["MS", "Montserrat", "+1-664"],
  ["MA", "Morocco", "+212"],
  ["MZ", "Mozambique", "+258"],
  ["MM", "Myanmar", "+95"],
  ["NA", "Namibia", "+264"],
  ["NR", "Nauru", "+674"],
  ["NP", "Nepal", "+977"],
  ["NL", "Netherlands", "+31"],
  ["NC", "New Caledonia", "+687"],
  ["NZ", "New Zealand", "+64"],
  ["NI", "Nicaragua", "+505"],
  ["NE", "Niger", "+227"],
  ["NG", "Nigeria", "+234"],
  ["NU", "Niue", "+683"],
  ["NF", "Norfolk Island", "+672"],
  ["KP", "North Korea", "+850"],
  ["MK", "North Macedonia", "+389"],
  ["MP", "Northern Mariana Islands", "+1-670"],
  ["NO", "Norway", "+47"],
  ["OM", "Oman", "+968"],
  ["PK", "Pakistan", "+92"],
  ["PW", "Palau", "+680"],
  ["PS", "Palestine", "+970"],
  ["PA", "Panama", "+507"],
  ["PG", "Papua New Guinea", "+675"],
  ["PY", "Paraguay", "+595"],
  ["PE", "Peru", "+51"],
  ["PH", "Philippines", "+63"],
  ["PL", "Poland", "+48"],
  ["PT", "Portugal", "+351"],
  ["PR", "Puerto Rico", "+1-787"],
  ["QA", "Qatar", "+974"],
  ["RE", "Reunion", "+262"],
  ["RO", "Romania", "+40"],
  ["RU", "Russia", "+7"],
  ["RW", "Rwanda", "+250"],
  ["BL", "Saint Barthelemy", "+590"],
  ["SH", "Saint Helena", "+290"],
  ["KN", "Saint Kitts and Nevis", "+1-869"],
  ["LC", "Saint Lucia", "+1-758"],
  ["MF", "Saint Martin", "+590"],
  ["PM", "Saint Pierre and Miquelon", "+508"],
  ["VC", "Saint Vincent and the Grenadines", "+1-784"],
  ["WS", "Samoa", "+685"],
  ["SM", "San Marino", "+378"],
  ["ST", "Sao Tome and Principe", "+239"],
  ["SA", "Saudi Arabia", "+966"],
  ["SN", "Senegal", "+221"],
  ["RS", "Serbia", "+381"],
  ["SC", "Seychelles", "+248"],
  ["SL", "Sierra Leone", "+232"],
  ["SG", "Singapore", "+65"],
  ["SX", "Sint Maarten", "+1-721"],
  ["SK", "Slovakia", "+421"],
  ["SI", "Slovenia", "+386"],
  ["SB", "Solomon Islands", "+677"],
  ["SO", "Somalia", "+252"],
  ["ZA", "South Africa", "+27"],
  ["KR", "South Korea", "+82"],
  ["SS", "South Sudan", "+211"],
  ["ES", "Spain", "+34"],
  ["LK", "Sri Lanka", "+94"],
  ["SD", "Sudan", "+249"],
  ["SR", "Suriname", "+597"],
  ["SE", "Sweden", "+46"],
  ["CH", "Switzerland", "+41"],
  ["SY", "Syria", "+963"],
  ["TW", "Taiwan", "+886"],
  ["TJ", "Tajikistan", "+992"],
  ["TH", "Thailand", "+66"],
  ["TL", "Timor-Leste", "+670"],
  ["TG", "Togo", "+228"],
  ["TK", "Tokelau", "+690"],
  ["TO", "Tonga", "+676"],
  ["TT", "Trinidad and Tobago", "+1-868"],
  ["TN", "Tunisia", "+216"],
  ["TR", "Turkey", "+90"],
  ["TM", "Turkmenistan", "+993"],
  ["TC", "Turks and Caicos Islands", "+1-649"],
  ["TV", "Tuvalu", "+688"],
  ["UG", "Uganda", "+256"],
  ["UA", "Ukraine", "+380"],
  ["AE", "United Arab Emirates", "+971"],
  ["GB", "United Kingdom", "+44"],
  ["US", "United States", "+1"],
  ["UY", "Uruguay", "+598"],
  ["VI", "US Virgin Islands", "+1-340"],
  ["UZ", "Uzbekistan", "+998"],
  ["VU", "Vanuatu", "+678"],
  ["VA", "Vatican City", "+379"],
  ["VE", "Venezuela", "+58"],
  ["VN", "Vietnam", "+84"],
  ["WF", "Wallis and Futuna", "+681"],
  ["EH", "Western Sahara", "+212"],
  ["YE", "Yemen", "+967"],
  ["ZM", "Zambia", "+260"],
  ["ZW", "Zimbabwe", "+263"],
];

const emptyClient = { name: "", countryIso: "TZ", contact: "", email: "", locations: [], geoLocations: [] };

function normalizeTanzaniaContact(value) {
  const digits = String(value || "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("255")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  if (!/^[67]\d{8}$/.test(local)) return "";
  return `+255 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export default function ClientsPage({ clients, onRegister }) {
  const [form, setForm] = useState(emptyClient);
  const [locationQuery, setLocationQuery] = useState("");
  const [geoDraft, setGeoDraft] = useState("");
  const [search, setSearch] = useState("");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [contactError, setContactError] = useState("");
  const [locationError, setLocationError] = useState("");
  const visible = clients.filter((client) =>
    `${client.name} ${client.contact} ${client.email} ${(client.locations || []).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const pendingLocation = locationQuery.trim();
  const locationsToSubmit = pendingLocation && !form.locations.some((location) => location.toLowerCase() === pendingLocation.toLowerCase())
    ? [...form.locations, pendingLocation]
    : form.locations;
  const geoLocationsToSubmit = pendingLocation
    ? mergeGeoLocation(form.geoLocations, pendingLocation, geoDraft)
    : form.geoLocations;

  function submit(event) {
    event.preventDefault();
    const selectedCountry = countryCodes.find(([iso]) => iso === form.countryIso) || countryCodes[0];
    const contact = selectedCountry[0] === "TZ" ? normalizeTanzaniaContact(form.contact) : `${selectedCountry[2]} ${form.contact}`.trim();
    if (selectedCountry[0] === "TZ" && !contact) {
      setContactError("Enter a valid Tanzania number, for example 0712 345 678.");
      return;
    }
    setContactError("");
    setLocationError("");
    onRegister({
      name: form.name,
      contact,
      email: form.email,
      locations: locationsToSubmit,
      geoLocations: geoLocationsToSubmit,
    }).then(() => {
      setForm(emptyClient);
      setLocationQuery("");
      setGeoDraft("");
    }).catch(() => {});
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title"><h1>Clients</h1><p>Register clients and their service locations before creating a request.</p></div>
      </div>
      <form className="panel" onSubmit={submit}>
        <div className="section-title"><h2>Register Client</h2></div>
        <div className="form-grid">
          <label>Client Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Contact Number
            <div className="phone-input-wrap">
              <CountryCodePicker
                open={countryPickerOpen}
                selectedIso={form.countryIso}
                setOpen={setCountryPickerOpen}
                onChange={(countryIso) => setForm({ ...form, countryIso })}
              />
              <input
                inputMode="tel"
                placeholder="Phone number"
                required
                aria-invalid={!!contactError}
                pattern={form.countryIso === "TZ" ? "^(?:\\+?255[\\s-]?|0)?[67][0-9]{2}[\\s-]?[0-9]{3}[\\s-]?[0-9]{3}$" : undefined}
                title={form.countryIso === "TZ" ? "Enter a valid Tanzania number, for example 0712 345 678." : undefined}
                value={form.contact}
                onChange={(event) => {
                  setContactError("");
                  setForm({ ...form, contact: event.target.value });
                }}
              />
            </div>
            {contactError && <small className="field-error">{contactError}</small>}
          </label>
          <label>Email Address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <LocationPicker form={form} setForm={setForm} query={locationQuery} setQuery={setLocationQuery} geoDraft={geoDraft} setGeoDraft={setGeoDraft} error={locationError} setError={setLocationError} />
        </div>
        <div className="button-row"><button className="btn" disabled={!locationsToSubmit.length}>Register Client</button></div>
      </form>
      <section className="panel filters client-filters">
        <div className="filter-heading"><div><strong>Registered Clients</strong><span>{clients.length} client(s)</span></div></div>
        <input aria-label="Search clients" placeholder="Search name, contact, email or location" value={search} onChange={(event) => setSearch(event.target.value)} />
      </section>
      {!visible.length ? <div className="panel empty">No clients match this search.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Contact</th><th>Email</th><th>Location(s)</th><th>Geo Location</th></tr></thead>
            <tbody>{visible.map((client) => (
              <tr key={client.id}><td><strong>{client.name}</strong></td><td>{client.contact}</td><td>{client.email}</td><td>{(client.locations || []).join(", ")}</td><td>{formatClientGeoLocations(client.geoLocations)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function mergeGeoLocation(geoLocations, location, geoDraft) {
  const [latitude, longitude] = String(geoDraft).split(",").map((value) => Number(value.trim()));
  if (!location || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return geoLocations;
  return [...geoLocations.filter((item) => item.location !== location), { location, latitude, longitude }];
}

function formatClientGeoLocations(geoLocations = []) {
  if (!geoLocations.length) return "-";
  return geoLocations
    .map((item) => `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}`)
    .join("; ");
}

export function CountryCodePicker({ open, selectedIso, setOpen, onChange }) {
  const selectedCountry = countryCodes.find(([iso]) => iso === selectedIso) || countryCodes[0];

  function selectCountry(iso) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div
      className="country-code-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="country-code-button"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <FlagImage iso={selectedCountry[0]} country={selectedCountry[1]} />
        <span>{selectedCountry[2]}</span>
      </button>
      {open && (
        <div className="country-code-menu" role="listbox">
          {countryCodes.map(([iso, country, code]) => (
            <button
              aria-selected={iso === selectedIso}
              className={iso === selectedIso ? "active" : ""}
              key={iso}
              role="option"
              title={country}
              type="button"
              onClick={() => selectCountry(iso)}
            >
              <FlagImage iso={iso} country={country} />
              <span>{code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FlagImage({ iso, country }) {
  return (
    <img
      alt={`${country} flag`}
      className="country-flag"
      loading="lazy"
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.webp`}
    />
  );
}

function LocationPicker({ form, setForm, query, setQuery, geoDraft, setGeoDraft, error, setError }) {
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const requestNumber = useRef(0);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      setStatus("idle");
      setActiveIndex(-1);
      return undefined;
    }

    const controller = new AbortController();
    const currentRequest = ++requestNumber.current;
    setStatus("loading");
    setIsOpen(true);

    const debounce = window.setTimeout(() => {
      searchTanzaniaLocations(trimmedQuery, controller.signal)
        .then((results) => {
          if (currentRequest !== requestNumber.current) return;
          const available = results.filter((place) =>
            !form.locations.some((location) => location.toLowerCase() === place.label.toLowerCase())
          );
          setSuggestions(available);
          setStatus(available.length ? "ready" : "empty");
          setActiveIndex(available.length ? 0 : -1);
        })
        .catch((error) => {
          if (error.name === "AbortError" || currentRequest !== requestNumber.current) return;
          setSuggestions([]);
          setStatus("error");
          setActiveIndex(-1);
        });
    }, 450);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [query, form.locations]);

  function addLocation(value, geo = null) {
    const location = value.trim();
    if (!location) return;
    const [draftLatitude, draftLongitude] = String(geoDraft).split(",").map((entry) => entry.trim());
    const latitude = Number(geo?.latitude ?? draftLatitude);
    const longitude = Number(geo?.longitude ?? draftLongitude);
    if (!form.locations.some((item) => item.toLowerCase() === location.toLowerCase())) {
      const hasGeoLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
      const geoLocations = hasGeoLocation
        ? [...form.geoLocations.filter((item) => item.location !== location), { location, latitude, longitude }]
        : form.geoLocations;
      setForm({ ...form, locations: [...form.locations, location], geoLocations });
    }
    setError("");
    setQuery("");
    setGeoDraft("");
    setSuggestions([]);
    setIsOpen(false);
    setStatus("idle");
  }

  return (
    <div className="location-picker">
      <label>Location(s)
        <div className="location-input-row">
          <div className="location-combobox">
            <span className="location-search-icon" aria-hidden="true">⌕</span>
            <input
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={isOpen && query.trim().length >= 2}
              aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
              autoComplete="off"
              role="combobox"
              placeholder="Search any address or place in Zanzibar"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
              onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && suggestions.length) {
                  event.preventDefault();
                  setIsOpen(true);
                  setActiveIndex((index) => (index + 1) % suggestions.length);
                } else if (event.key === "ArrowUp" && suggestions.length) {
                  event.preventDefault();
                  setIsOpen(true);
                  setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
                } else if (event.key === "Escape") {
                  setIsOpen(false);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const selected = suggestions[activeIndex];
                  addLocation(selected?.label || query, selected);
                }
              }}
            />
            {!!query && (
              <button className="location-clear" aria-label="Clear location search" type="button" onClick={() => setQuery("")}>×</button>
            )}
            {isOpen && query.trim().length >= 2 && (
              <div className="location-suggestions" id={listboxId} role="listbox">
                {status === "loading" && <div className="location-message"><span className="location-spinner" />Searching across Zanzibar…</div>}
                {status === "empty" && <div className="location-message">No matching place found. You can still add the address you typed.</div>}
                {status === "error" && <div className="location-message">Suggestions are unavailable. You can still add the address you typed.</div>}
                {suggestions.map((place, index) => (
                  <button
                    className={index === activeIndex ? "active" : ""}
                    id={`${listboxId}-${index}`}
                    key={place.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => addLocation(place.label, place)}
                  >
                    <span>{place.name}</span>
                    <small>{place.label}</small>
                  </button>
                ))}
                {(status === "ready" || status === "empty") && (
                  <div className="location-attribution">Search results © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
                )}
              </div>
            )}
          </div>
          <div className="location-action-buttons">
            <button className="btn secondary" type="button" onClick={() => addLocation(query)}>Add</button>
          </div>
        </div>
      </label>
      <label>Geo Location (optional)<input inputMode="decimal" placeholder="Latitude, longitude (e.g. -6.1659, 39.2026)" value={geoDraft} onChange={(event) => setGeoDraft(event.target.value)} /></label>
      {error && <small className="field-error">{error}</small>}
      {!!form.locations.length && (
        <div className="location-chips">
          {form.locations.map((location) => (
            <span key={location}>{location}<button aria-label={`Remove ${location}`} type="button" onClick={() => setForm({ ...form, locations: form.locations.filter((item) => item !== location) })}>×</button></span>
          ))}
        </div>
      )}
    </div>
  );
}
