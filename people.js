import express from 'express';
const router = express.Router();

const init = async function(config) {
  let colUsers = null;

  // MongoDBのクライアントを受け取ってDBを取得し、
  // usersを記録するためのcollectionを取得。
  // DBは'idsrv'の決め打ち
  router.set_mongo_client = async function(mc) {
    const db = mc.db('idsrv');
    colUsers = await db.collection('users');
  };

  router.get('/:uid',async (req,res)=>{
    const uid = req.params.uid;
    let cert_mod = null;
    let cert_exp = null;
    let pub_key = '';
    const us = await colUsers.find({id:uid}).toArray();
    if (us.length>0) {
      cert_mod = us[0].pub_mod;
      cert_exp = us[0].pub_exp;
    }
    if (!!cert_mod && !!cert_exp) {
      pub_key = `  cert:key [
    rdf:type cert:RSAPublicKey ;
    cert:modules "${cert_mod}"^^<http://www.w3.org/2001/XMLSchema#hexBinary> ;
    cert:exponent "${cert_exp}"^^<http://www.w3.org/2001/XMLSchema#integer>
  ] ;
`;
    }

    const ttl = `@prefix : <https://${config.server.hostname}/people/${uid}#>.
@prefix n0: <http://xmlns.com/foaf/0.1/>.
@prefix schem: <http://schema.org/>.
@prefix n: <http://www.w3.org/2006/vcard/ns#>.
@prefix cert: <http://www.w3.org/ns/auth/cert#>.
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.

:me
  a schem:Person, n0:Person;
${pub_key}
  n:fn "Dummy name".

`;
    res.setHeader('content-type', 'text/turtle');
    res.send(ttl);
  });

  return router;
};

export default init;
