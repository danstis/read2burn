// Spawns app.js as a child process with an isolated cwd (=> isolated NeDB file) and a free port.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const APP = path.join(__dirname, '..', '..', 'app.js');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function startServer(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2b-'));
  const port = await freePort();
  const child = spawn(process.execPath, [APP], {
    cwd: dir,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (c) => reject(new Error(`server exited early (${c})`)));
    child.stdout.on('data', (d) => /listening on port/.test(d) && resolve());
  });
  child.removeAllListeners('exit');
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    get: (p) => fetch(base + p),
    post: (p, form) =>
      fetch(base + p, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form),
      }),
    async stop() {
      const exited = new Promise((r) => child.once('exit', r));
      child.kill();
      await exited;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

module.exports = { startServer };
