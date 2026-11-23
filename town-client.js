// Standalone browser module. Nothing connects until enabled === true AND enter().
// The scene adapter calls setVisible(false/true) on visibility changes; no DOM here.
// Movement is a destination, never a per-frame position. The server permits 2/s.
// ticketUrl ends in /ticket (optional query); the existing /csrf sibling is read first.
// Callbacks receive server messages unchanged: onSnapshot/onJoin/onGone/onMove,
// onState/onRelease/onClaimResult. onState also carries seat continuation prompts.
// onDisconnect({retrying,retry?}) reports connection loss; onOffline('已离线') fires
// once after exhaustion. setState confirms seat arrival; continueSeat answers prompts.
// close is terminal. Only an explicit new enter() restarts an exhausted client.
export function createTownClient(options = {}) {
  const config = options || {};
  const backoff = [1000, 2000, 5000, 10000, 10000]; // Five retries after the initial attempt.
  let scene = config.scene, wanted = false, visible = true, closed = false, exhausted = false;
  let socket, controller, retryTimer, deadline, heartbeat;
  let generation = 0, retries = 0, ready = false, outSeq = 0, inSeq = 0, self;
  let lastMove = -Infinity, lastTarget, peers = new Set();

  function notify(name, value) {
    try { Promise.resolve(config[name]?.(value)).catch(() => {}); } catch {}
  }
  function dispose() {
    generation++;
    clearTimeout(retryTimer); clearTimeout(deadline); clearInterval(heartbeat);
    controller?.abort(); controller = undefined;
    const previous = socket; socket = undefined; ready = false;
    if (previous) {
      previous.onopen = previous.onmessage = previous.onerror = previous.onclose = null;
      try { previous.close(); } catch {}
    }
  }
  function fail(token) {
    if (token !== generation || closed || !wanted || exhausted) return;
    dispose();
    if (retries === backoff.length) {
      exhausted = true;
      notify('onDisconnect', { retrying: false });
      notify('onOffline', '已离线');
      return;
    }
    const delay = backoff[retries++];
    retryTimer = setTimeout(connect, delay);
    notify('onDisconnect', { retrying: true, retry: retries });
  }
  function send(type, data = {}, joining = false) {
    if (!socket || socket.readyState !== 1 || (!ready && !joining)) return false;
    try {
      if (socket.bufferedAmount > 32768) throw Error();
      socket.send(JSON.stringify({ v: 1, seq: ++outSeq, type, ...data }));
      return true;
    } catch { fail(generation); return false; }
  }
  const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
  const member = value => value && typeof value.actor === 'string' && typeof value.name === 'string'
    && point(value.at) && point(value.target) && typeof value.state === 'string';

  function receive(event, token) {
    if (token !== generation) return;
    try {
      if (typeof event.data !== 'string' || event.data.length > 65536) throw Error();
      const message = JSON.parse(event.data);
      if (message.v !== 1 || !Number.isSafeInteger(message.seq) || message.seq !== inSeq + 1) throw Error();
      inSeq = message.seq;
      if (message.type === 'snapshot') {
        if (message.scene !== scene || typeof message.self !== 'string' || typeof message.room !== 'string'
          || !Array.isArray(message.members) || !message.members.every(member)
          || !message.members.some(person => person.actor === message.self) || !Array.isArray(message.seats)) throw Error();
        ready = true; retries = 0; self = message.self;
        peers = new Set(message.members.map(person => person.actor));
        lastTarget = undefined; lastMove = -Infinity;
        clearTimeout(deadline); clearInterval(heartbeat);
        heartbeat = setInterval(() => send('ping', { background: !visible }), 20000);
        if (!visible) send('ping', { background: true });
        notify('onSnapshot', message);
        return;
      }
      if (!ready) throw Error(); // Includes ticket/scene refusal before the snapshot.
      switch (message.type) {
        case 'join':
          if (!member(message)) throw Error();
          if (!peers.has(message.actor)) {
            peers.add(message.actor);
            if (message.actor !== self) notify('onJoin', message);
          }
          break;
        case 'gone':
          // The existing server may broadcast gone twice for an unseated disconnect.
          if (peers.delete(message.actor) && message.actor !== self) notify('onGone', message);
          break;
        case 'move':
          if (typeof message.actor !== 'string' || !point(message.from) || !point(message.target)) throw Error();
          notify('onMove', message);
          break;
        case 'state': notify('onState', message); break;
        case 'release': notify('onRelease', message); break;
        case 'claim-result':
          if (typeof message.ok !== 'boolean') throw Error();
          notify('onClaimResult', message);
          break;
        case 'ping': break;
        default: throw Error();
      }
    } catch { fail(token); }
  }

  async function connect() {
    if (closed || exhausted || !wanted || config.enabled !== true) return;
    dispose();
    const token = generation;
    outSeq = inSeq = 0;
    try {
      controller = new AbortController();
      const signal = controller.signal;
      deadline = setTimeout(() => fail(token), 10000);
      // Existing logged-in sessions require the read-only CSRF endpoint before POST.
      const csrfUrl = String(config.ticketUrl).replace(/\/ticket(?=\?|$)/, '/csrf');
      if (csrfUrl === config.ticketUrl) throw Error();
      const csrfResponse = await fetch(csrfUrl, { credentials: 'same-origin', signal });
      if (token !== generation) return;
      if (!csrfResponse.ok) throw Error();
      const csrf = await csrfResponse.json();
      if (token !== generation) return;
      const headers = { 'Content-Type': 'application/json' };
      if (typeof csrf.csrf === 'string') headers['X-CSRF-Token'] = csrf.csrf;
      const response = await fetch(config.ticketUrl, {
        method: 'POST', credentials: 'same-origin', headers, body: '{}', signal,
      });
      if (token !== generation) return;
      if (!response.ok) throw Error();
      const data = await response.json();
      if (token !== generation) return;
      if (typeof data.ticket !== 'string' || !/^[\w-]{43}$/.test(data.ticket)) throw Error();
      socket = new WebSocket(config.wsUrl);
      socket.onopen = () => {
        if (token === generation) send('enter', { scene, ticket: data.ticket }, true);
      };
      socket.onmessage = event => receive(event, token);
      socket.onerror = socket.onclose = () => fail(token);
    } catch { fail(token); }
  }

  return {
    enter(nextScene = scene) {
      if (closed || config.enabled !== true || !['town', 'chuamay', 'suoi', 'lientri'].includes(nextScene)) return false;
      if (ready && scene !== nextScene) send('leave');
      scene = nextScene; wanted = true; exhausted = false; retries = 0;
      void connect();
      return true;
    },
    reportPosition(position) {
      const { from, target, at = Date.now() } = position || {};
      if (!ready || !visible || !point(from) || !point(target) || !Number.isFinite(at)) return false;
      const now = Date.now();
      if (now - lastMove < 500 || (from[0] === target[0] && from[1] === target[1])
        || (lastTarget && target[0] === lastTarget[0] && target[1] === lastTarget[1])) return false;
      if (!send('move', { from, target, at })) return false;
      lastMove = now; lastTarget = [...target];
      return true;
    },
    claimSeat(seat) { return typeof seat === 'string' && send('claim', { seat }); },
    releaseSeat(seat) { return (seat === undefined || typeof seat === 'string') && send('release', seat === undefined ? {} : { seat }); },
    setState(value, seconds = null) {
      if (!['walk', 'stand', 'sit', 'bow', 'mo', 'incense', 'lamp'].includes(value)
        || (seconds !== null && (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600))) return false;
      return send('state', { value, seconds });
    },
    continueSeat() { return send('ping', { background: !visible, continueSeat: true }); },
    setVisible(value) {
      if (typeof value !== 'boolean' || value === visible || closed) return;
      visible = value;
      if (!visible) send('ping', { background: true });
      else if (wanted && !exhausted) void connect(); // New ticket, authoritative fresh snapshot.
    },
    close() {
      if (closed) return;
      send('leave'); closed = true; wanted = false; dispose();
    },
  };
}
