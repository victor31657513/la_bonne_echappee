// Charge et affiche la version de l'application depuis package.json
async function displayVersion() {
  const container = document.getElementById('version-container');
  if (!container) return;
  try {
    const pkg = await import('../package.json', { assert: { type: 'json' } });
    container.textContent = `Version ${pkg.default.version}`;
  } catch (err) {
    console.error('Impossible de charger la version', err);
  }
}

// Exécute immédiatement l'affichage de la version
export default function initVersion() {
  displayVersion();
}
