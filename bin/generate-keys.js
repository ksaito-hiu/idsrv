#!/usr/bin/env node

import path from 'path';
import * as jose from 'jose';
import { readFile, writeFile } from 'fs/promises';

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
let keyPairObj;

keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
keyPairObj = await jose.exportJWK(keyPair.privateKey);
keyPairObj.kid = "key01";
keyPairObj.alg = "RS256";
keyPairObj.use = "sig";
keystore.keys.push(keyPairObj);

keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
keyPairObj = await jose.exportJWK(keyPair.privateKey);
keyPairObj.kid = "key02";
keyPairObj.alg = "RS256";
keyPairObj.key_ops = ["verify"];
keystore.keys.push(keyPairObj);

keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
keyPairObj = await jose.exportJWK(keyPair.privateKey);
keyPairObj.kid = "key03";
keyPairObj.alg = "RS256";
keyPairObj.key_ops = ["verify"];
keystore.keys.push(keyPairObj);

keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
keyPairObj = await jose.exportJWK(keyPair.privateKey);
keyPairObj.kid = "key04";
keyPairObj.alg = "RS256";
keyPairObj.key_ops = ["verify"];
keystore.keys.push(keyPairObj);

keyPair = await jose.generateKeyPair('RS384', { modulusLength: 2048 });
keyPairObj = await jose.exportJWK(keyPair.privateKey);
keyPairObj.kid = "key05";
keyPairObj.alg = "RS384";
keyPairObj.key_ops = ["verify"];
keystore.keys.push(keyPairObj);

keyPair = await jose.generateKeyPair('RS384', { modulusLength: 2048 });
keyPairObj = await jose.exportJWK(keyPair.privateKey);
keyPairObj.kid = "key06";
keyPairObj.alg = "RS384";
keyPairObj.key_ops = ["verify"];
keystore.keys.push(keyPairObj);

keyPair = await jose.generateKeyPair('RS512', { modulusLength: 2048 });
keyPairObj = await jose.exportJWK(keyPair.privateKey);
keyPairObj.kid = "key07";
keyPairObj.alg = "RS512";
keyPairObj.key_ops = ["verify"];
keystore.keys.push(keyPairObj);

keyPair = await jose.generateKeyPair('RS512', { modulusLength: 2048 });
keyPairObj = await jose.exportJWK(keyPair.privateKey);
keyPairObj.kid = "key08";
keyPairObj.alg = "RS512";
keyPairObj.key_ops = ["verify"];
keystore.keys.push(keyPairObj);

const the_path = path.join(config.idsrv_root,'config/jwks.json');
await writeFile(the_path, JSON.stringify(keystore, null, 2));
