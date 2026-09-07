#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createPublicKey, verify } from 'node:crypto';
const [manifestPath, sigPath, publicKeyPath] = process.argv.slice(2);
if (!manifestPath || !sigPath || !publicKeyPath) { console.error('Usage: node verify-release-signature.mjs <manifest> <signature> <public-key.pem>'); process.exit(2); }
const data=await readFile(manifestPath); const sig=Buffer.from((await readFile(sigPath,'utf8')).trim(),'base64');
const key=createPublicKey(await readFile(publicKeyPath));
if (key.asymmetricKeyType!=='ed25519') throw new Error('Expected Ed25519 public key');
if (!verify(null,data,key,sig)) { console.error(JSON.stringify({status:'UNVERIFIED',reason:'SIGNATURE_INVALID'})); process.exit(1); }
console.log(JSON.stringify({status:'VERIFIED',algorithm:'Ed25519'}));
