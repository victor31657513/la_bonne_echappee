# La Bonne Échappée

This project displays a 3D visualization of a cycling route using Three.js. All
third‑party libraries are now loaded from public CDNs. The **togeojson** library
is fetched from jsDelivr, so no local copy is required.

The cyclist simulation now caps speed at 50&nbsp;km/h on flat terrain and
automatically brakes before sharp turns.

Open `index.html` in a modern browser to run the demo. Two modes are available:

- **Production**: simply open `index.html`.
- **Development**: append `?dev` to the URL (e.g. `index.html?dev`). In this
  mode each JavaScript module is loaded with a timestamp query parameter so the
  browser always fetches the latest version.
