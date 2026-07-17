import { useEffect, useMemo, useState } from 'react';
import indiaXyCities from '../data/indiaXyCities.json';
import './IndiaLocationPicker.css';

function locationLabel(location) {
  return `${location.city}, ${location.state}`;
}

function IndiaLocationPicker({ location, onChange }) {
  const selectedLocation = useMemo(
    () => indiaXyCities.find(item => item.id === location?.id) || null,
    [location?.id]
  );
  const [query, setQuery] = useState(selectedLocation ? locationLabel(selectedLocation) : '');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedLocation ? locationLabel(selectedLocation) : '');
  }, [selectedLocation]);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('en-IN');
    if (!normalizedQuery) return indiaXyCities.slice(0, 10);

    return indiaXyCities
      .filter(item => [item.city, item.state, ...(item.aliases || [])]
        .some(value => value.toLocaleLowerCase('en-IN').includes(normalizedQuery)))
      .slice(0, 12);
  }, [query]);

  const selectLocation = item => {
    onChange({
      id: item.id,
      city: item.city,
      state: item.state,
      country: item.country,
      tier: item.tier
    });
    setQuery(locationLabel(item));
    setIsOpen(false);
  };

  const handleChange = event => {
    setQuery(event.target.value);
    if (selectedLocation) onChange(null);
    setIsOpen(true);
  };

  return (
    <div className="india-location-picker">
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Search an X or Y city"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-label="City"
      />
      {isOpen && (
        <div className="india-location-results" role="listbox">
          {results.length ? results.map(item => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === selectedLocation?.id}
              onMouseDown={event => event.preventDefault()}
              onClick={() => selectLocation(item)}
            >
              <span>{item.city}</span>
              <small>{item.state} · Class {item.tier}</small>
            </button>
          )) : <p className="india-location-empty">No eligible city found. Choose a listed Class X or Y city.</p>}
        </div>
      )}
      {selectedLocation && <p className="india-location-selected">Selected: {selectedLocation.city}, {selectedLocation.state}, India · Class {selectedLocation.tier}</p>}
    </div>
  );
}

export default IndiaLocationPicker;
