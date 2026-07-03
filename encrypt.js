const sodium = require('tweetsodium');
const publicKey = process.argv[2];
const secret = process.argv[3];
const encryptedBytes = sodium.seal(secret, Buffer.from(publicKey, 'base64'));
process.stdout.write(Buffer.from(encryptedBytes).toString('base64'));
