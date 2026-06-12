const crypto = require('crypto');

const secretKey = 'fb4b6ac20b3c9b6e615b4ac5a274e6076b489494053456e94ae587d62f46d341';
const keyBuffer = Buffer.from(secretKey, 'hex');
const text = "1//0ghKz-this-is-a-fake-google-refresh-token";

const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
let encrypted = cipher.update(text, 'utf8', 'hex');
encrypted += cipher.final('hex');

const authTag = cipher.getAuthTag().toString('hex');
const ivHex = iv.toString('hex');

const payload = `${ivHex}:${authTag}:${encrypted}`;
console.log(payload);
