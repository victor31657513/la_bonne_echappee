// Point d'entrée de l'application: charge les modules et démarre l'animation

import './setupScene.js';
import './physicsWorld.js';
import './track.js';
import './riders.js';
import './ui.js';
import './startButton.js';
import initVersion from './version.js';
import { animate } from './animation.js';

animate();
initVersion();
