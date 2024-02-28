#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as jose from 'jose';
import { readFile } from 'fs/promises';

async function load_json(file_name) {
  return JSON.parse(
    await readFile(
      new URL(file_name, import.meta.url)
    )
  );
}

if (process.argv.length!==3) {
  console.log("You must specify your configuration file for idsrv as the 1st argument.");
  process.exit(1);
}

const cnf_path = path.join(process.cwd(),process.argv[2]);
const config = await load_json(cnf_path);

const keystore = { keys: [] };

let keyPair;

keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
keystore.keys.push(await jose.exportJWK(keyPair.privateKey));
keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
keystore.keys.push(await jose.exportJWK(keyPair.privateKey));
keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
keystore.keys.push(await jose.exportJWK(keyPair.privateKey));
keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
keystore.keys.push(await jose.exportJWK(keyPair.privateKey));
keyPair = await jose.generateKeyPair('RS384', { modulusLength: 2048 });
keystore.keys.push(await jose.exportJWK(keyPair.privateKey));
keyPair = await jose.generateKeyPair('RS384', { modulusLength: 2048 });
keystore.keys.push(await jose.exportJWK(keyPair.privateKey));
keyPair = await jose.generateKeyPair('RS512', { modulusLength: 2048 });
keystore.keys.push(await jose.exportJWK(keyPair.privateKey));
keyPair = await jose.generateKeyPair('RS512', { modulusLength: 2048 });
keystore.keys.push(await jose.exportJWK(keyPair.privateKey));

const the_path = path.join(config.idsrv_root,'config/jwks.json');
fs.writeFileSync(the_path, JSON.stringify(keystore, null, 2));


/*
Promise.all([
  keystore.generate('RSA', 2048, { alg: 'RS256', use: 'sig' }),
  keystore.generate('RSA', 2048, { alg: 'RS256', key_ops: ['verify'] }),
  keystore.generate('RSA', 2048, { alg: 'RS256', key_ops: ['verify'] }),
  keystore.generate('RSA', 2048, { alg: 'RS256', key_ops: ['verify'] }),
  keystore.generate('RSA', 2048, { alg: 'RS384', key_ops: ['verify'] }),
  keystore.generate('RSA', 2048, { alg: 'RS384', key_ops: ['verify'] }),
  keystore.generate('RSA', 2048, { alg: 'RS512', key_ops: ['verify'] }),
  keystore.generate('RSA', 2048, { alg: 'RS512', key_ops: ['verify'] }),
]).then(() => {
  const the_path = path.join(config.idsrv_root,'config/jwks.json');
  fs.writeFileSync(the_path, JSON.stringify(keystore.toJWKS(true), null, 2));
});
*/
