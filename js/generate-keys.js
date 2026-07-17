// Jalankan sekali aja: node generate-keys.js
// Ini bikin 2 file: doku-private-key.pem (RAHASIA, buat secret Supabase)
// dan doku-public-key.pem (buat di-paste ke dashboard DOKU).

const crypto = require("crypto");
const fs = require("fs");

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

fs.writeFileSync("doku-private-key.pem", privateKey);
fs.writeFileSync("doku-public-key.pem", publicKey);

console.log("Selesai! 2 file dibuat:");
console.log("  - doku-private-key.pem  (JANGAN dibagikan ke siapapun)");
console.log("  - doku-public-key.pem   (paste isinya ke dashboard DOKU)");
