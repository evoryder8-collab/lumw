import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { parseHTML } from 'linkedom';

export async function startPreview() {
  const { document } = parseHTML(fs.readFileSync('dist/index.html', 'utf8'));
  const base = document.querySelector('.brand').getAttribute('href').replace(/\/$/, '');
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const server = spawn(process.execPath, ['node_modules/astro/astro.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, PUBLIC_BASE: base || '/' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${output}`);
    try {
      const response = await fetch(`${origin}${base}/`);
      if (response.ok) return { origin, base, url: (route = '/') => `${origin}${base}${route}`, close: () => server.kill('SIGTERM') };
    } catch { /* Server has not bound its port yet. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  server.kill('SIGTERM');
  throw new Error(`Preview did not start: ${output}`);
}
