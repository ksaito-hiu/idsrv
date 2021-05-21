#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const jose = require('jose2');

if (process.argv.length!==3) {
  console.log("You must specify your configuration file for idsrv as the 1st argument.");
  process.exit(1);
}

const cnf_path = path.join(process.cwd(),process.argv[2]);
const config = require(cnf_path);

const keystore = new jose.JWKS.KeyStore();

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
  const the_path = path.join(config.idsrv_root,'jwks.json');
  fs.writeFileSync(the_path, JSON.stringify(keystore.toJWKS(true), null, 2));
});
