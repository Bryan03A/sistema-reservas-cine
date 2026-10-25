import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const directorio = join(process.cwd(), "keys");
mkdirSync(directorio, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

writeFileSync(
  join(directorio, "private.pem"),
  privateKey,
  { encoding: "utf8", mode: 0o600 }
);

writeFileSync(
  join(directorio, "public.pem"),
  publicKey,
  { encoding: "utf8" }
);

console.log("Claves RSA generadas en backend/usuarios/keys.");
console.log("No compartas ni publiques private.pem.");