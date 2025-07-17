import { THREE, camera, renderer, scene } from './setupScene.js';
import { riders, teamColors, riderGeom } from './riders.js';
import { TRACK_WRAP } from './track.js';

let selectedIndex = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const selectionMarkerGeom = new THREE.EdgesGeometry(riderGeom);
const selectionMarkerMat = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 4 });
const selectionMarker = new THREE.LineSegments(selectionMarkerGeom, selectionMarkerMat);
selectionMarker.visible = false;
scene.add(selectionMarker);

const teamSelect = document.getElementById('teamSelect');
const teamControlsDiv = document.getElementById('teamControls');
const teamColorsCss = teamColors.map(c => `#${c.getHexString()}`);
teamSelect.innerHTML = '';
teamColorsCss.forEach((col, t) => {
  const opt = new Option(`Team ${t + 1}`, t);
  opt.style.backgroundColor = col;
  opt.style.color = '#fff';
  teamSelect.append(opt);
});

function showTeamControls(tid) {
  teamControlsDiv.innerHTML = '';
  const relayLabel = document.createElement('label');
  relayLabel.textContent = 'Team Relay: ';
  const relaySel = document.createElement('select');
  [0, 1, 2, 3].forEach(v => relaySel.append(new Option(v === 0 ? 'None' : v, v)));
  relaySel.value = 0;
  relaySel.addEventListener('change', e => {
    const lvl = +e.target.value;
    riders
      .filter(r => r.team === tid)
      .forEach((r, idx) => {
        r.relayIntensity = lvl;
        const sel = document.getElementById(`relay_${tid}_${idx}`);
        if (sel) sel.value = lvl;
      });
  });
  teamControlsDiv.append(relayLabel, relaySel, document.createElement('hr'));
  riders
    .filter(r => r.team === tid)
    .forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'rider-control';
      row.innerHTML = `
      <span>Rider ${idx + 1}${r.isLeader ? ' (Leader)' : ''}</span>
      <label>Relay:<select id="relay_${tid}_${idx}"><option>0</option><option>1</option><option>2</option><option>3</option></select></label>
      <label><input type="checkbox" id="prot_${tid}_${idx}" ${r.protectLeader ? 'checked' : ''} ${r.isLeader ? 'disabled' : ''}/> Protect</label>
      <label>Effort:<select id="eff_${tid}_${idx}"><option value="0">Follower</option><option value="1">Normal</option><option value="2">Attack</option></select></label>`;
      teamControlsDiv.append(row);
      document.getElementById(`relay_${tid}_${idx}`).value = r.relayIntensity;
      document.getElementById(`relay_${tid}_${idx}`).addEventListener('change', e => (r.relayIntensity = +e.target.value));
      document.getElementById(`prot_${tid}_${idx}`).addEventListener('change', e => (r.protectLeader = e.target.checked));
      document.getElementById(`eff_${tid}_${idx}`).value = r.effortMode;
      document.getElementById(`eff_${tid}_${idx}`).addEventListener('change', e => (r.effortMode = +e.target.value));
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
  } else if (event.key === 'ArrowDown') {
    selectedIndex = findRelativeRider(selectedIndex, 'next');
  } else if (event.key === 'ArrowUp') {
    selectedIndex = findRelativeRider(selectedIndex, 'prev');
  }
  updateSelectionHelper();
});

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

export { selectedIndex, updateSelectionHelper };
