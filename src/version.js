// Charge et affiche la version de l'application depuis version.json
async function displayVersion() {
  const container = document.getElementById('version-container');
  if (!container) return;
  try {
    const versionData = await import('../version.json', { assert: { type: 'json' } });
    container.textContent = `Version ${versionData.default.version}`;
  } catch (err) {
    console.error('Impossible de charger la version', err);
  }
}

// Exécute immédiatement l'affichage de la version
export default function initVersion() {
  displayVersion();
}
