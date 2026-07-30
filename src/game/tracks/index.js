import { alpenpass } from './Alpenpass.js';
import { cotedalbatre } from './CoteDAlbatre.js';
import { portofino } from './Portofino.js';

export const TRACKS = {
  alpenpass,
  cotedalbatre,
  portofino,
};

export const TRACK_ORDER = ['alpenpass', 'cotedalbatre', 'portofino'];

export function getTrack(id) {
  return TRACKS[id] || TRACKS.alpenpass;
}
