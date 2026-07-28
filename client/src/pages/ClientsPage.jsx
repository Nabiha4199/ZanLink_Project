import React, { useState } from "react";
import { locationOptions } from "../config/workflow";

const emptyClient = { name: "", contact: "", email: "", locations: [] };

export default function ClientsPage({ clients, onRegister }) {
  const [form, setForm] = useState(emptyClient);
  const [locationQuery, setLocationQuery] = useState("");
  const [search, setSearch] = useState("");
  const visible = clients.filter((client) =>
    `${client.name} ${client.contact} ${client.email} ${(client.locations || []).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function submit(event) {
    event.preventDefault();
    onRegister({
      name: form.name,
      contact: form.contact,
      email: form.email,
      locations: form.locations,
    }).then(() => {
      setForm(emptyClient);
      setLocationQuery("");
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
          <label>Contact Number<input required value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
          <label>Email Address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <LocationPicker form={form} setForm={setForm} query={locationQuery} setQuery={setLocationQuery} />
        </div>
        <div className="button-row"><button className="btn" disabled={!form.locations.length}>Register Client</button></div>
      </form>
      <section className="panel filters client-filters">
        <div className="filter-heading"><div><strong>Registered Clients</strong><span>{clients.length} client(s)</span></div></div>
        <input aria-label="Search clients" placeholder="Search name, contact, email or location" value={search} onChange={(event) => setSearch(event.target.value)} />
      </section>
      {!visible.length ? <div className="panel empty">No clients match this search.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Contact</th><th>Email</th><th>Location(s)</th></tr></thead>
            <tbody>{visible.map((client) => (
              <tr key={client.id}><td><strong>{client.name}</strong></td><td>{client.contact}</td><td>{client.email}</td><td>{(client.locations || []).join(", ")}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function LocationPicker({ form, setForm, query, setQuery }) {
  const normalizedQuery = query.trim().toLowerCase();
  const exact = locationOptions.find((place) => place.name.toLowerCase() === normalizedQuery);
  const directMatches = normalizedQuery
    ? locationOptions.filter((place) => `${place.name} ${place.area}`.toLowerCase().includes(normalizedQuery))
    : [];
  const nearbyMatches = exact
    ? locationOptions.filter((place) => place.area === exact.area && place.name !== exact.name)
    : [];
  const suggestions = [...directMatches, ...nearbyMatches]
    .filter((place, index, all) => all.findIndex((item) => item.name === place.name) === index)
    .filter((place) => !form.locations.includes(place.name))
    .slice(0, 9);

  function addLocation(value) {
    const location = value.trim();
    if (!location) return;
    if (!form.locations.some((item) => item.toLowerCase() === location.toLowerCase())) {
      setForm({ ...form, locations: [...form.locations, location] });
    }
    setQuery("");
  }

  return (
    <div className="wide location-picker">
      <label>Location(s)
        <div className="location-input-row">
          <input
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Start typing, e.g. Mkunazini"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLocation(suggestions[0]?.name || query);
              }
            }}
          />
          <button className="btn secondary" type="button" onClick={() => addLocation(query)}>Add</button>
        </div>
      </label>
      {!!suggestions.length && (
        <div className="location-suggestions" role="listbox">
          {exact && <strong>Nearby {exact.area}</strong>}
          {suggestions.map((place) => (
            <button key={place.name} type="button" role="option" onClick={() => addLocation(place.name)}>
              <span>{place.name}</span><small>{place.area}</small>
            </button>
          ))}
        </div>
      )}
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
