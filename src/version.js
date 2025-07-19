// Charge et affiche la version de l'application depuis package.json
async function displayVersion() {
  const container = document.getElementById('version-container');
  if (!container) return;
  try {
    const response = await fetch('./package.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const pkg = await response.json();
    container.textContent = `Version ${pkg.version}`;
  } catch (err) {
    console.error('Impossible de charger la version', err);
  }
}

// Exécute immédiatement l'affichage de la version
export default function initVersion() {
  displayVersion();
}
