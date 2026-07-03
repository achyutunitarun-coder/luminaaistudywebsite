const sodium = require('tweetsodium');
const publicKey = process.argv[2];
const secret = process.argv[3];
const keyBytes = new Uint8Array(Buffer.from(publicKey, 'base64'));
const secretBytes = new Uint8Array(Buffer.from(secret));
const encryptedBytes = sodium.seal(secretBytes, keyBytes);
const result = Buffer.from(encryptedBytes).toString('base64');
process.stdout.write(result);
