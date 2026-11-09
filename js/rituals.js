// Common rituals state machine 鈥?doc: 07-common-rituals.md

export const RITUAL_STATES = { IDLE: 'idle', RUNNING: 'running', DONE: 'done' };

// Session-only state (not persisted)
const _state = {};

export function getRitualState(key) {
  return _state[key] ?? RITUAL_STATES.IDLE;
}

export function startRitual(key) {
  _state[key] = RITUAL_STATES.RUNNING;
}

export function completeRitual(key) {
  _state[key] = RITUAL_STATES.DONE;
}

export function resetAll() {
  for (const k of Object.keys(_state)) delete _state[k];
  _beadCount = 0;
}

// Visual marker: tiny light point (not a checkmark)
export function markerFor(state) {
  if (state === RITUAL_STATES.DONE)    return '鉁?;
  if (state === RITUAL_STATES.RUNNING) return '鈼?;
  return '鈼?;
}

// 鈹€鈹€ Incense (涓婇) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// Duration: 60 seconds real, 6 seconds in prototype
export function runIncense(onDone) {
  startRitual('incense');
  const DURATION = 6000;
  const start = Date.now();
  const timer = setInterval(() => {
    const elapsed = Date.now() - start;
    const pct = Math.min(elapsed / DURATION, 1);
    document.getElementById('incense-progress-bar')?.style.setProperty('--pct', pct);
    if (pct >= 1) {
      clearInterval(timer);
      completeRitual('incense');
      onDone?.();
    }
  }, 200);
  return () => clearInterval(timer);
}

// 鈹€鈹€ Sit (闈欏潗) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// Options: 1/3/5 min real, 5/15/30 seconds in prototype
export function runSit(minutes, onDone) {
  startRitual('sit');
  const PROTO_DURATIONS = { 1: 5000, 3: 10000, 5: 15000 };
  const duration = PROTO_DURATIONS[minutes] ?? 5000;
  const timer = setTimeout(() => {
    completeRitual('sit');
    onDone?.();
  }, duration);
  return () => clearTimeout(timer);
}

// 鈹€鈹€ Mo / wooden fish (鏈ㄩ奔) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
let _moLastTap = 0;
export function tapMo() {
  const now = Date.now();
  if (now - _moLastTap < 300) return false; // 300ms debounce
  _moLastTap = now;
  if (getRitualState('mo') !== RITUAL_STATES.DONE) {
    // First tap = done for today (session)
    completeRitual('mo');
  }
  return true; // tap accepted
}

// 鈹€鈹€ Beads (蹇电彔) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
let _beadCount = 0;
export function tapBead() {
  _beadCount = (_beadCount + 1);
  if (_beadCount >= 108) {
    completeRitual('beads');
    return { count: _beadCount, milestone: true };
  }
  return { count: _beadCount, milestone: false };
}
export function getBeadCount() { return _beadCount; }
export function resetBeads() { _beadCount = 0; }

