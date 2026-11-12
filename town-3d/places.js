import * as hall from './hall/index.js';
import * as petgarden from './petgarden/index.js';

const places = Object.freeze({ chuamay: hall, petgarden });
export const placeForTemple = id => places[id] || null;
