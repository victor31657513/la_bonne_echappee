// Charge et affiche la version de l'application depuis version.json
async function displayVersion() {
  const container = document.getElementById('version-container');
  if (!container) return;
  try {
    const response = await fetch('version.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const versionData = await response.json();
    container.textContent = `Version ${versionData.version}`;
  } catch (err) {
    console.error('Impossible de charger la version', err);
  }
}

// Exécute immédiatement l'affichage de la version
export default function initVersion() {
  displayVersion();
}
