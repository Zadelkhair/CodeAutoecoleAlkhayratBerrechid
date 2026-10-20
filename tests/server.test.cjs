const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { createApp } = require('../server');
const { createAccess, createTLS } = require('../studio/network');
const { createPublication } = require('../studio/publication');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-server-test-'));
  fs.mkdirSync(path.join(root, 'docs', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public'));
  fs.writeFileSync(path.join(root, 'db.json'), JSON.stringify({ series: [{ num: 1, description: '', questions: [{ num: 1, answer: ['1'], img: '', audio: '', audio_explination: '' }] }] }));
  fs.writeFileSync(path.join(root, 'docs', 'db.js'), 'let database = {};');
  fs.writeFileSync(path.join(root, '.gitignore'), '.studio/\n');
  return root;
}
async function running(t) {
  const root = fixture();
  const app = createApp({ root });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { app.locals.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { root, url: 'http://127.0.0.1:' + server.address().port, app };
}
const jsonPost = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function wave() {
  const data = Buffer.alloc(48);
  data.write('RIFF', 0); data.writeUInt32LE(40, 4); data.write('WAVE', 8); data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(4, 40);
  return data;
}
function upload(data = wave()) { const body = new FormData(); body.set('audio', new Blob([data], { type: 'audio/wav' }), '../../not-a-path.wav'); return body; }

test('QR pairing is single-use, expiring, private-LAN-only and does not trust X-Forwarded-For', () => {
  const access = createAccess();
  const response = () => ({ code: 200, headers: {}, status(value) { this.code = value; return this; }, setHeader(name, value) { this.headers[name] = value; }, json(value) { this.body = value; } });
  const pairing = access.createPairing('desktop');
  const res = response();
  access.consumePairing({ socket: { remoteAddress: '192.168.1.9' }, body: { token: pairing.token } }, res);
  assert.equal(res.body.ok, true);
  const req = { socket: { remoteAddress: '192.168.1.9' }, headers: { cookie: res.headers['Set-Cookie'] } };
  assert.ok(access.session(req));
  const again = response();
  access.consumePairing({ socket: { remoteAddress: '192.168.1.9' }, body: { token: pairing.token } }, again);
  assert.equal(again.code, 410);
  assert.equal(access.session({ socket: { remoteAddress: '203.0.113.12' }, headers: { cookie: res.headers['Set-Cookie'], 'x-forwarded-for': '127.0.0.1' } }), null);
  assert.equal(access.session({ socket: { remoteAddress: '192.168.1.9' }, headers: { authorization: 'Bearer ' + pairing.token } }), null);
});
test('expired pairing cannot authenticate a phone', t => {
  const access = createAccess();
  const original = Date.now();
  const pairing = access.createPairing('desktop');
  t.mock.method(Date, 'now', () => original + 121000);
  let status;
  access.consumePairing({ socket: { remoteAddress: '192.168.1.9' }, body: { token: pairing.token } }, { status(value) { status = value; return this; }, json() {} });
  assert.equal(status, 410);
});
test('cross-origin writes and DNS rebinding are rejected; secrets are not served', async t => {
  const { url } = await running(t);
  let response = await fetch(url + '/series', { ...jsonPost({ num: 2, questions: [] }), headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' } });
  assert.equal(response.status, 403);
  const status = await new Promise((resolve, reject) => http.get(url + '/api/health', { headers: { Host: 'unrelated.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject));
  assert.equal(status, 403);
  for (const file of ['/.env', '/.git/config', '/.studio/tls/server.key']) assert.equal((await fetch(url + file)).status, 404);
});
test('phone audio arrives for the exact field without changing the question until saved', async t => {
  const { root, url } = await running(t);
  const before = fs.readFileSync(path.join(root, 'db.json'), 'utf8');
  const created = await fetch(url + '/api/mobile-recordings', jsonPost({ seriesNum: 1, questionNum: 1, field: 'audio_explination' })).then(response => response.json());
  assert.ok(created.qr.startsWith('data:image/png;base64,'));
  const token = new URL(created.url).hash.split('=')[1];
  const headers = { Authorization: 'Bearer ' + token };
  assert.equal((await fetch(url + '/api/phone-audio', { headers })).status, 200);
  assert.equal((await fetch(url + '/api/phone-audio', { headers: { Authorization: 'Bearer invalid' } })).status, 410);
  assert.equal((await fetch(url + '/api/phone-audio', { method: 'POST', headers, body: upload(Buffer.from('<html>Not an audio file</html>')) })).status, 415);
  assert.equal((await fetch(url + '/api/phone-audio', { method: 'POST', headers, body: upload() })).status, 201);
  assert.equal((await fetch(url + '/api/phone-audio', { method: 'POST', headers, body: upload() })).status, 409);
  const state = await fetch(url + '/api/mobile-recordings/' + created.id).then(response => response.json());
  assert.equal(state.state, 'ready'); assert.equal(state.field, 'audio_explination');
  const audio = Buffer.from(await (await fetch(url + '/api/mobile-recordings/' + created.id + '/audio')).arrayBuffer());
  assert.deepEqual(audio, wave());
  assert.equal(fs.readFileSync(path.join(root, 'db.json'), 'utf8'), before);
  assert.equal((await fetch(url + '/api/mobile-recordings/' + created.id + '/received', { method: 'POST' })).status, 200);
  assert.deepEqual(fs.readdirSync(path.join(root, '.studio', 'transfers')), []);
});
test('canceling a transfer invalidates its phone token', async t => {
  const { url } = await running(t);
  const created = await fetch(url + '/api/mobile-recordings', jsonPost({ seriesNum: 1, questionNum: 1, field: 'audio' })).then(response => response.json());
  const token = new URL(created.url).hash.split('=')[1];
  assert.equal((await fetch(url + '/api/mobile-recordings/' + created.id, { method: 'DELETE' })).status, 200);
  assert.equal((await fetch(url + '/api/phone-audio', { headers: { Authorization: 'Bearer ' + token } })).status, 410);
  assert.equal((await fetch(url + '/api/mobile-recordings', jsonPost({ seriesNum: 1, questionNum: 999, field: 'audio' }))).status, 404);
});
test('local HTTPS certificate is valid for localhost and stable across restarts', async t => {
  const root = fixture();
  const tls = createTLS(root);
  const second = createTLS(root);
  assert.deepEqual(tls.cert, second.cert);
  const server = https.createServer(tls, (req, res) => res.end('secure'));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const body = await new Promise((resolve, reject) => https.get({ hostname: '127.0.0.1', port: server.address().port, ca: tls.ca }, response => { let text = ''; response.on('data', chunk => text += chunk); response.on('end', () => resolve(text)); }).on('error', reject));
  assert.equal(body, 'secure');
});
function command(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function repository() {
  const root = fixture();
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-git-remote-'));
  command(remote, 'init', '--bare', '-b', 'main');
  command(root, 'init', '-b', 'main');
  command(root, 'config', 'user.name', 'Studio Test'); command(root, 'config', 'user.email', 'studio@example.test'); command(root, 'config', 'commit.gpgsign', 'false');
  command(root, 'add', '.'); command(root, 'commit', '-m', 'Initial fixture'); command(root, 'remote', 'add', 'origin', remote); command(root, 'push', '-u', 'origin', 'main');
  return { root, remote, publish: createPublication({ root, sync() { fs.writeFileSync(path.join(root, 'docs', 'db.js'), 'let database=' + fs.readFileSync(path.join(root, 'db.json'), 'utf8')); } }) };
}
test('publication uploads content only, excludes private settings and never force-pushes', async () => {
  const { root, remote, publish } = repository();
  fs.writeFileSync(path.join(root, 'public', 'unrelated.js'), 'uncommitted unrelated code');
  fs.mkdirSync(path.join(root, '.studio'), { recursive: true }); fs.writeFileSync(path.join(root, '.studio', 'secret.txt'), 'private');
  fs.writeFileSync(path.join(root, 'db.json'), JSON.stringify({ series: [] }));
  assert.equal((await publish.verify()).ok, true);
  assert.equal((await publish.publish()).ok, true);
  const files = command(remote, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'main');
  assert.match(files, /db.json/); assert.match(files, /docs\/db.js/);
  assert.doesNotMatch(files, /secret|unrelated/);
});
test('publication refuses unrelated staged files instead of committing them', async () => {
  const { root, publish } = repository();
  fs.writeFileSync(path.join(root, 'public', 'unrelated.js'), 'code'); command(root, 'add', 'public/unrelated.js');
  await assert.rejects(publish.publish(), /hors du contenu/);
});
test('remote changes are protected and a rejected push keeps local content', async () => {
  const { root, remote, publish } = repository();
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-other-clone-'));
  command(other, 'clone', remote, '.'); command(other, 'config', 'user.name', 'Other'); command(other, 'config', 'user.email', 'other@example.test'); command(other, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(other, 'other.txt'), 'remote change'); command(other, 'add', 'other.txt'); command(other, 'commit', '-m', 'Remote change'); command(other, 'push', 'origin', 'main');
  const remoteHead = command(remote, 'rev-parse', 'main');
  fs.writeFileSync(path.join(root, 'db.json'), JSON.stringify({ series: [], local: true }));
  await assert.rejects(publish.publish(), /conservés/);
  assert.equal(command(remote, 'rev-parse', 'main'), remoteHead);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'db.json'))).local, true);
});
