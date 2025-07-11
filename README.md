# La Bonne Échappée

This project displays a 3D visualization of a cycling route using Three.js. All
third‑party libraries are now loaded from public CDNs. The **togeojson** library
is fetched from jsDelivr, so no local copy is required.

Open `index.html` in a modern browser to run the demo. If your browser keeps
serving old JavaScript files, each module import in `index.html` now includes a
query string version (e.g. `gpxLoader.js?v=20240401`). Bump this version value
whenever you deploy a new build to force browsers to fetch the latest assets.
