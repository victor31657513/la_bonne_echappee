const applause = new Audio('sounds/applause-01.wav');
const helicopter = new Audio('sounds/helicopter.wav');

applause.loop = true;
helicopter.loop = true;

/**
 * Met à jour le volume des sons d'ambiance en fonction du niveau de zoom.
 *
 * @param {number} progress Valeur comprise entre 0 (zoom le plus proche)
 * et 1 (zoom le plus lointain).
 * @returns {void}
 */
function updateAmbientSound(progress) {
  const t = Math.min(1, Math.max(0, progress));
  applause.volume = 1 - 0.9 * t;
  helicopter.volume = 0.1 + 0.9 * t;
}

/**
 * Initialise la lecture des effets sonores d'ambiance.
 *
 * @param {number} progress Niveau de zoom initial normalisé.
 * @returns {void}
 */
function initAmbientSound(progress = 0) {
  // Les volumes sont mis à zéro pour tenter la lecture sans interaction.
  applause.volume = 0;
  helicopter.volume = 0;
  applause.play().catch(() => {});
  helicopter.play().catch(() => {});
  updateAmbientSound(progress);
}

export { initAmbientSound, updateAmbientSound };
