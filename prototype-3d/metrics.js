import { firstLoadBytes } from './logic.js';

export function createMetrics(renderer) {
  const samples = [];
  let last = performance.now();
  let frames = 0;
  let fps = 0;
  let low = 60;
  const output = {
    fps: document.querySelector('#metric-fps'), low: document.querySelector('#metric-low'),
    triangles: document.querySelector('#metric-triangles'), calls: document.querySelector('#metric-calls'),
    memory: document.querySelector('#metric-memory'), bytes: document.querySelector('#metric-bytes')
  };
  function tick(now) {
    frames += 1;
    if (now - last >= 1000) {
      fps = frames * 1000 / (now - last);
      samples.push(fps);
      if (samples.length > 120) samples.shift();
      low = Math.min(...samples);
      frames = 0; last = now;
      output.fps.textContent = fps.toFixed(0);
      output.low.textContent = low.toFixed(0);
      const stats = renderer._sceneStats || renderer.info.render;
      output.triangles.textContent = stats.triangles.toLocaleString('vi-VN');
      output.calls.textContent = stats.calls.toLocaleString('vi-VN');
      if (performance.memory) output.memory.textContent = `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB`;
      const bytes = firstLoadBytes(performance.getEntriesByType('resource'));
      output.bytes.textContent = `${(bytes / 1048576).toFixed(2)} MB`;
      window.__CHUAMAY_METRICS__ = { fps, low, triangles: stats.triangles, calls: stats.calls, bytes, memory: performance.memory?.usedJSHeapSize || null };
    }
  }
  return { tick, snapshot: () => window.__CHUAMAY_METRICS__ || null };
}
