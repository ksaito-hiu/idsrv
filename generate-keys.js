const fs = require('fs');
const path = require('path');
const jose = require('jose');

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
  fs.writeFileSync(path.resolve('jwks.json'), JSON.stringify(keystore.toJWKS(true), null, 2));
});
