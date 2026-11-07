import { createPublicKey, verify } from "node:crypto";

const decode = (value) =>
  JSON.parse(Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64url"));

export function createAccessVerifier(settings, fetcher = fetch, clock = Date.now) {
  let cached = null;
  const issuer = `https://${settings.accessTeamDomain}`;

  async function keys(force = false) {
    if (!force && cached?.expires > clock()) return cached.value;
    const response = await fetcher(`${issuer}/cdn-cgi/access/certs`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error("access_keys");
    const value = await response.json();
    if (!Array.isArray(value?.keys)) throw Error("access_keys");
    cached = { value: value.keys, expires: clock() + 3600000 };
    return cached.value;
  }

  async function validate(raw) {
    if (typeof raw !== "string" || raw.length > 8192) throw Error("access_token");
    const parts = raw.split(".");
    if (parts.length !== 3) throw Error("access_token");
    const header = decode(parts[0]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw Error("access_alg");
    let jwk = (await keys()).find((item) => item.kid === header.kid);
    if (!jwk) jwk = (await keys(true)).find((item) => item.kid === header.kid);
    if (!jwk) throw Error("access_key");
    const signed = Buffer.from(`${parts[0]}.${parts[1]}`),
      signature = Buffer.from(parts[2], "base64url");
    if (!verify("RSA-SHA256", signed, createPublicKey({ key: jwk, format: "jwk" }), signature)) {
      jwk = (await keys(true)).find((item) => item.kid === header.kid);
      if (!jwk || !verify("RSA-SHA256", signed, createPublicKey({ key: jwk, format: "jwk" }), signature))
        throw Error("access_signature");
    }
    const claims = decode(parts[1]), now = Math.floor(clock() / 1000), aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== issuer || !aud.includes(settings.accessAud) || claims.type !== "app") throw Error("access_claims");
    if (!Number.isFinite(claims.exp) || claims.exp < now - 30 || (claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > now + 30))) throw Error("access_expired");
    const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
    if (!settings.adminEmails.has(email)) throw Error("access_email");
    return email;
  }

  return { validate };
}
