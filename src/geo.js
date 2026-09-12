let cachedPosition = null;
let requestInFlight = null;

/** Asks the browser (once) for the user's location; resolves null if denied/unavailable. */
export function getUserLocation() {
  if (cachedPosition) return Promise.resolve(cachedPosition);
  if (requestInFlight) return requestInFlight;
  if (!("geolocation" in navigator)) return Promise.resolve(null);

  requestInFlight = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedPosition = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        resolve(cachedPosition);
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000 }
    );
  });
  return requestInFlight;
}
