const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const forge = require("node-forge");

const digest = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const address = (value) => String(value || "").replace(/^::ffff:/, "");
const loopback = (value) => ["127.0.0.1", "::1"].includes(address(value));
const privateAddress = (value) =>
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address(value));

function networkAddresses() {
  return Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
    entries
      .filter(
        (item) =>
          item.family === "IPv4" &&
          !item.internal &&
          privateAddress(item.address),
      )
      .map((item) => ({ name, address: item.address })),
  );
}

function createAccess() {
  const pairings = new Map();
  const sessions = new Map();
  const cleanup = () => {
    for (const entries of [pairings, sessions])
      for (const [key, item] of entries)
        if (item.expiresAt <= Date.now()) entries.delete(key);
  };
  function session(req) {
    if (loopback(req.socket.remoteAddress))
      return { id: "desktop", local: true };
    if (!privateAddress(req.socket.remoteAddress)) return null;
    const cookie = String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("studio_session="));
    if (!cookie) return null;
    const value = sessions.get(digest(cookie.slice("studio_session=".length)));
    return value && value.expiresAt > Date.now() ? value : null;
  }
  function requireAdmin(req, res, next) {
    cleanup();
    const value = session(req);
    if (!value)
      return res
        .status(401)
        .json({
          message:
            "Scannez le QR code affiché sur le PC pour autoriser ce téléphone.",
        });
    req.studioSession = value;
    next();
  }
  function createPairing(owner) {
    cleanup();
    if (pairings.size >= 100)
      throw new Error(
        "Trop de connexions en attente. Réessayez dans quelques minutes.",
      );
    const token = randomToken();
    const expiresAt = Date.now() + 2 * 60 * 1000;
    pairings.set(digest(token), { expiresAt, owner });
    return { token, expiresAt };
  }
  function consumePairing(req, res) {
    if (
      !loopback(req.socket.remoteAddress) &&
      !privateAddress(req.socket.remoteAddress)
    )
      return res
        .status(403)
        .json({ message: "Connexion réservée au réseau local." });
    const key = digest(req.body.token || "");
    const pairing = pairings.get(key);
    if (!pairing || pairing.expiresAt <= Date.now())
      return res
        .status(410)
        .json({
          message:
            "Ce QR code a expiré ou a déjà été utilisé. Créez-en un nouveau sur le PC.",
        });
    pairings.delete(key);
    const token = randomToken();
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    sessions.set(digest(token), {
      id: crypto.randomUUID(),
      expiresAt,
      local: false,
    });
    res.setHeader(
      "Set-Cookie",
      `studio_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${req.secure ? "; Secure" : ""}`,
    );
    res.json({ ok: true, expiresAt });
  }
  return { requireAdmin, session, createPairing, consumePairing };
}

function requestSafety(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "microphone=(self)");
  let host;
  try {
    host = new URL(`${req.protocol}://${req.headers.host}`).hostname
      .replace(/^\[|\]$/g, "")
      .toLowerCase();
  } catch {
    return res.status(400).json({ message: "Hôte non valide." });
  }
  const allowed = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    os.hostname().toLowerCase(),
    ...networkAddresses().map((item) => item.address),
  ]);
  if (!allowed.has(host))
    return res.status(403).json({ message: "Hôte non autorisé." });
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
    if (req.headers.origin !== `${req.protocol}://${req.headers.host}`)
      return res
        .status(403)
        .json({ message: "Origine de la requête non autorisée." });
  }
  if (req.path.startsWith("/api/") || req.path === "/")
    res.setHeader("Cache-Control", "no-store");
  next();
}

function createTLS(root) {
  const directory = path.join(root, ".studio", "tls");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const caPath = path.join(directory, "root-ca.crt");
  const caKeyPath = path.join(directory, "root-ca.key");
  const serial = () => "01" + crypto.randomBytes(15).toString("hex");
  if (!fs.existsSync(caPath) || !fs.existsSync(caKeyPath)) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = serial();
    cert.validity.notBefore = new Date(Date.now() - 86400000);
    cert.validity.notAfter = new Date(Date.now() + 3 * 365 * 86400000);
    cert.setSubject([
      { name: "commonName", value: "Code Alkhayrat Studio - Local CA" },
    ]);
    cert.setIssuer(cert.subject.attributes);
    cert.setExtensions([
      { name: "basicConstraints", cA: true, pathLenConstraint: 0 },
      { name: "keyUsage", keyCertSign: true, cRLSign: true },
      { name: "subjectKeyIdentifier" },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    fs.writeFileSync(caKeyPath, forge.pki.privateKeyToPem(keys.privateKey), {
      mode: 0o600,
    });
    fs.writeFileSync(caPath, forge.pki.certificateToPem(cert));
  }
  const ips = [
    "127.0.0.1",
    ...networkAddresses().map((item) => item.address),
  ].sort();
  const hostname = os.hostname().toLowerCase();
  const signature = digest(JSON.stringify({ ips, hostname }));
  const metadataPath = path.join(directory, "server.json");
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  } catch {}
  const keyPath = path.join(directory, "server.key");
  const certPath = path.join(directory, "server.crt");
  if (
    metadata?.signature !== signature ||
    metadata?.expiresAt < Date.now() + 7 * 86400000 ||
    !fs.existsSync(keyPath) ||
    !fs.existsSync(certPath)
  ) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const ca = forge.pki.certificateFromPem(fs.readFileSync(caPath, "utf8"));
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = serial();
    cert.validity.notBefore = new Date(Date.now() - 86400000);
    cert.validity.notAfter = new Date(Date.now() + 365 * 86400000);
    cert.setSubject([{ name: "commonName", value: "Code Alkhayrat Studio" }]);
    cert.setIssuer(ca.subject.attributes);
    cert.setExtensions([
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: [
          ...ips.map((ip) => ({ type: 7, ip })),
          ...["localhost", hostname, hostname + ".local"].map((value) => ({
            type: 2,
            value,
          })),
        ],
      },
    ]);
    cert.sign(
      forge.pki.privateKeyFromPem(fs.readFileSync(caKeyPath, "utf8")),
      forge.md.sha256.create(),
    );
    fs.writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey), {
      mode: 0o600,
    });
    fs.writeFileSync(certPath, forge.pki.certificateToPem(cert));
    fs.writeFileSync(
      metadataPath,
      JSON.stringify({
        signature,
        expiresAt: cert.validity.notAfter.getTime(),
      }),
    );
  }
  const ca = fs.readFileSync(caPath);
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
    ca,
    caPath,
    fingerprint: new crypto.X509Certificate(ca).fingerprint256,
  };
}

module.exports = {
  createAccess,
  createTLS,
  networkAddresses,
  requestSafety,
  digest,
  randomToken,
  loopback,
  privateAddress,
  address,
};
