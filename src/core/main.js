// Point d'entrée de l'application: charge les modules et démarre l'animation

import './setupScene.js';
import './physicsWorld.js';
import '../entities/track.js';
import '../entities/riders.js';
import '../ui/ui.js';
import '../ui/startButton.js';
import '../ui/soundToggle.js';
import initVersion from '../utils/version.js';
import { initCameraControls } from '../logic/cameraController.js';

initCameraControls();
// La simulation est désormais démarrée par startButton.js après interaction utilisateur
initVersion();
