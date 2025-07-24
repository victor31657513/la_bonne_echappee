// Interface utilisateur: sélection et contrôles des coureurs

import {
  THREE,
  camera,
  renderer,
  scene,
  registerLineMaterial
} from '../core/setupScene.js';
import { riders, teamColors, riderGeom } from '../entities/riders.js';
import { TRACK_WRAP } from '../entities/track.js';
import { on, emit } from '../utils/eventBus.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// Au démarrage, on se concentre sur un coureur situé vers le milieu du peloton
let selectedIndex = Math.floor(riders.length / 2);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const selectionEdges = new THREE.EdgesGeometry(riderGeom);
const selectionMarkerGeom = new LineSegmentsGeometry().fromEdgesGeometry(selectionEdges);
const selectionMarkerMat = new LineMaterial({ color: 0xffff00, linewidth: 4 });
registerLineMaterial(selectionMarkerMat);
const selectionMarker = new LineSegments2(selectionMarkerGeom, selectionMarkerMat);
selectionMarker.computeLineDistances();
selectionMarker.visible = false;
scene.add(selectionMarker);

const teamSelect = document.getElementById('teamSelect');
const teamControlsDiv = document.getElementById('teamControls');
const speedIndicator = document.getElementById('speed-indicator');
const teamColorsCss = teamColors.map(c => `#${c.getHexString()}`);
teamColorsCss.forEach((col, t) => {
  const opt = teamSelect.options[t];
  if (opt) {
    opt.style.backgroundColor = col;
    opt.style.color = '#fff';
  }
});

/**
 * Affiche les contrôles associés à l'équipe sélectionnée.
 *
 * @param {number} tid Identifiant de l'équipe à afficher.
 * @returns {void}
 */
function showTeamControls(tid) {
  teamControlsDiv.innerHTML = '';
  const teamRelaySelect = document.createElement('select');
  const teamRelayOpts = [
    { label: 'Followers', value: '0' },
    { label: 'Relay', value: '1' }
  ];
  teamRelayOpts.forEach(optInfo => {
    const opt = document.createElement('option');
    opt.value = optInfo.value;
    opt.textContent = optInfo.label;
    teamRelaySelect.append(opt);
  });
  teamRelaySelect.value = riders.some(r => r.team === tid && r.relaySetting > 0)
    ? '1'
    : '0';

  const intensityLabel = document.createElement('label');
  intensityLabel.textContent = 'Team Intensity:';
  const teamIntInput = document.createElement('input');
  teamIntInput.type = 'range';
  teamIntInput.min = '0';
  teamIntInput.max = '100';
  teamIntInput.step = '25';
  const firstRider = riders.find(r => r.team === tid);
  teamIntInput.value = firstRider ? firstRider.baseIntensity : 50;
  const teamIntVal = document.createElement('span');
  teamIntVal.textContent = teamIntInput.value;
  teamIntInput.addEventListener('input', e => {
    const val = Math.round(+e.target.value / 25) * 25;
    teamIntInput.value = val;
    teamIntVal.textContent = val;
    riders
      .filter(r => r.team === tid)
      .forEach(r => {
        r.baseIntensity = val;
        if (!r.isAttacking) {
          r.intensity = val;
          emit('intensityChange', { rider: r, value: val });
        }
      });
  });
  const teamIntensityContainer = document.createElement('div');
  teamIntensityContainer.append(intensityLabel, teamIntInput, teamIntVal);
  const relayContainer = document.createElement('label');
  relayContainer.textContent = 'Team Mode:';
  relayContainer.append(teamRelaySelect);

  function resetTeamIntensity() {
    teamIntInput.value = 50;
    teamIntVal.textContent = 50;
    riders
      .filter(r => r.team === tid)
      .forEach((r, idx) => {
        r.baseIntensity = 50;
        r.intensity = 50;
        emit('intensityChange', { rider: r, value: 50 });
        const slider = document.getElementById(`int_${tid}_${idx}`);
        const span = document.getElementById(`int_val_${tid}_${idx}`);
        if (slider) slider.value = 50;
        if (span) span.textContent = 50;
      });
  }

  teamRelaySelect.addEventListener('change', e => {
    const active = e.target.value === '1';
    riders
      .filter(r => r.team === tid)
      .forEach((r, idx) => {
        r.relaySetting = active ? 3 : 0;
        if (!active) r.isAttacking = false;
        const sel = document.getElementById(`state_${tid}_${idx}`);
        if (sel) sel.value = active ? 'relay' : 'followers';
      });
    if (!active) resetTeamIntensity();
  });

  teamControlsDiv.append(relayContainer, teamIntensityContainer, document.createElement('hr'));
  riders
    .filter(r => r.team === tid)
    .forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'rider-control';
      row.innerHTML = `
      <span>Rider ${idx + 1}${r.isLeader ? ' (Leader)' : ''}</span>
      <label>Intensity:<input type="range" min="0" max="100" step="25" list="intensityTicks" id="int_${tid}_${idx}" value="${r.baseIntensity}"/><span id="int_val_${tid}_${idx}">${r.baseIntensity}</span></label>
      <label><input type="checkbox" id="prot_${tid}_${idx}" ${r.protectLeader ? 'checked' : ''} ${r.isLeader ? 'disabled' : ''}/> Protect</label>
      <select id="state_${tid}_${idx}">
        <option value="followers">Followers</option>
        <option value="relay">Relay</option>
      </select>
      <button id="atk_${tid}_${idx}">Attack</button>
      <progress id="gauge_${tid}_${idx}" max="100" value="${r.attackGauge}"></progress>`;
      teamControlsDiv.append(row);
      const intensityInput = document.getElementById(`int_${tid}_${idx}`);
      intensityInput.addEventListener('input', e => {
        const val = Math.round(+e.target.value / 25) * 25;
        intensityInput.value = val;
        r.baseIntensity = val;
        document.getElementById(`int_val_${tid}_${idx}`).textContent = val;
        if (!r.isAttacking) {
          r.intensity = r.baseIntensity;
          emit('intensityChange', { rider: r, value: r.intensity });
        }
      });
      on('intensityChange', payload => {
        if (payload.rider === r) {
          intensityInput.value = payload.value;
          document.getElementById(`int_val_${tid}_${idx}`).textContent = payload.value;
        }
      });
      on('phaseChange', payload => {
        if (payload.rider === r) {
          row.dataset.phase = payload.phase;
        }
      });
      document.getElementById(`prot_${tid}_${idx}`).addEventListener('change', e => (r.protectLeader = e.target.checked));
      const stateSel = document.getElementById(`state_${tid}_${idx}`);
      stateSel.value = r.relaySetting > 0 ? 'relay' : 'followers';
      stateSel.addEventListener('change', e => {
        if (e.target.value === 'relay') {
          r.relaySetting = 3;
          r.isAttacking = false;
        } else {
          r.relaySetting = 0;
          r.isAttacking = false;
          resetTeamIntensity();
        }
      });
      document.getElementById(`atk_${tid}_${idx}`).addEventListener('click', () => {
        if (r.attackGauge > 0) r.isAttacking = true;
      });
    });
}
teamSelect.addEventListener('change', () => showTeamControls(+teamSelect.value));
teamSelect.dispatchEvent(new Event('change'));

renderer.domElement.addEventListener('click', event => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(riders.map(r => r.mesh));
  if (intersects.length) {
    selectedIndex = riders.findIndex(r => r.mesh === intersects[0].object);
    updateSelectionHelper();
  }
});

/**
 * Trouve le coureur précédent ou suivant sur la piste par rapport à un indice.
 *
 * @param {number} currentIdx Indice du coureur de référence.
 * @param {'next'|'prev'} direction Direction de recherche.
 * @returns {number} Indice du coureur trouvé.
 */
function findRelativeRider(currentIdx, direction) {
  const currentDist = riders[currentIdx].trackDist;
  let bestIdx = currentIdx;
  let bestDelta = TRACK_WRAP;
  riders.forEach((r, idx) => {
    if (idx === currentIdx) return;
    let delta;
    if (direction === 'next') {
      delta = r.trackDist - currentDist;
      if (delta <= 0) delta += TRACK_WRAP;
    } else {
      delta = currentDist - r.trackDist;
      if (delta <= 0) delta += TRACK_WRAP;
    }
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

window.addEventListener('keydown', event => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  if (selectedIndex === null) {
    selectedIndex = 0;
  } else if (event.key === 'ArrowUp') {
    selectedIndex = findRelativeRider(selectedIndex, 'next');
  } else if (event.key === 'ArrowDown') {
    selectedIndex = findRelativeRider(selectedIndex, 'prev');
  }
  updateSelectionHelper();
});

/**
 * Met à jour le marqueur visuel autour du coureur actuellement sélectionné.
 *
 * @returns {void}
 */
function updateSelectionHelper() {
  if (selectedIndex !== null) {
    const rider = riders[selectedIndex];
    selectionMarker.position.copy(rider.mesh.position);
    selectionMarker.quaternion.copy(rider.mesh.quaternion);
    selectionMarker.visible = true;
  } else {
    selectionMarker.visible = false;
  }
}

// Met à jour régulièrement les jauges d'attaque affichées
setInterval(() => {
  const tid = +teamSelect.value;
  riders
    .filter(r => r.team === tid)
    .forEach((r, idx) => {
      const el = document.getElementById(`gauge_${tid}_${idx}`);
      if (el) el.value = r.attackGauge;
    });
}, 100);

setInterval(() => {
  if (speedIndicator) {
    if (selectedIndex !== null) {
      const v = riders[selectedIndex].body.velocity.length();
      const kmh = v * 3.6;
      speedIndicator.textContent = `Speed: ${kmh.toFixed(1)} km/h`;
    } else {
      speedIndicator.textContent = '';
    }
  }
}, 100);

// S'assurer que le marqueur de sélection est visible au chargement
updateSelectionHelper();

export { selectedIndex, updateSelectionHelper };
