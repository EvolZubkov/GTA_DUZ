import './ui/styles.css';
import { Game } from './engine/Game.js';

const game = new Game({ root: document.querySelector('#app') });
game.start();
