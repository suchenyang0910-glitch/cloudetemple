// Morning sequence (早课 Buổi sáng) guided path.
// Steps: bell → incense → bow → sit.
// Shows once to first-time visitors; retrievable from menu (replay).
// GA4 events: morning_start, morning_step, morning_skip, morning_complete.

const STEPS = ['bell', 'incense', 'bow', 'sit'];
const STORAGE_KEY = 'ct-morning-seen';

const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } };
const write = v => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch {} };

export function createMorning({ event }) {
  let active = false;
  let stepIndex = 0;

  const obj = {
    shouldShow() {
      return !read();
    },

    start() {
      active = true;
      stepIndex = 0;
      write(true);
      event('morning_start', {});
    },

    replay() {
      active = true;
      stepIndex = 0;
      event('morning_start', { replay: true });
    },

    isActive() { return active; },

    currentStep() { return active ? STEPS[stepIndex] : null; },

    // Called from the morning bell view after user interaction + bell played.
    // Returns the next view to navigate to.
    bellDone() {
      stepIndex = 1;
      event('morning_step', { step: 'incense' });
      return 'incense';
    },

    // Called when an activity completes while morning is active.
    // Returns { navigate: 'next-view' } if handled, false otherwise.
    advance(kind) {
      if (!active) return false;
      const next = { incense: 'bow', bow: 'sit' }[kind];
      if (next) {
        stepIndex = STEPS.indexOf(next);
        event('morning_step', { step: next });
        return { navigate: next };
      }
      if (kind === 'sit') {
        active = false;
        event('morning_complete', {});
        return { navigate: 'home' };
      }
      return false;
    },

    // Skip current step. Returns { navigate: 'next-view' } or { navigate: 'home' }.
    skip(step) {
      event('morning_skip', { step: step ?? STEPS[stepIndex] });
      if (!step || step === 'morning' || stepIndex === 0) {
        active = false;
        return { navigate: 'home' };
      }
      const result = obj.advance(step);
      if (!result) { active = false; return { navigate: 'home' }; }
      return result;
    },

    end() { active = false; },
  };

  return obj;
}
