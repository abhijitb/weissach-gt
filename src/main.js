import { Game } from './game/Game.js';

// ?track=alpenpass | cotedalbatre | portofino
const trackId = new URLSearchParams(window.location.search).get('track') || 'alpenpass';

const game = new Game({ trackId });
game.init();
