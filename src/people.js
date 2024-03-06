import express from 'express';
const router = express.Router();

// 2022,05/30: WebIDプロファイルからリンクされる
// prefs.ttlと、さらにそこからリンクされるprivateTypeIndex.ttlと
// publicTypeIndex.ttlに対応させたけど、そもそもこれらが何を
// 意味しているか理解していない状態。
const init = async function(config) {
  let colUsers = null;
  let trustedApps = null;

  // MongoDBのクライアントを受け取ってDBを取得し、
  // usersを記録するためのcollectionを取得。
  // DBは'idsrv'の決め打ち
  router.set_mongo_client = async function(mc) {
    const db = mc.db('idsrv');
    colUsers = await db.collection('users');
  };

  // このサーバーで認証される全てのユーザにとって
  // 信頼できるアプリの情報を受け取る。
  router.set_trusted_apps = async function(trusted_apps) {
    trustedApps = trusted_apps;
  };

  router.get('/:uid/prefs.ttl',async (req,res)=>{
    const uid = req.params.uid;
    const ttl = `@prefix : <#>.
@prefix dct: <http://purl.org/dc/terms/>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix space: <http://www.w3.org/ns/pim/space#>.

</people/${uid}#me>
    space:workspace :id1653875911170, :id1653875990310;
    solid:privateTypeIndex <./privateTypeIndex.ttl>;
    solid:publicTypeIndex <./publicTypeIndex.ttl>.
<> a space:ConfigurationFile; dct:title "Preferences file".

:id1653875911170 space:uriPrefix "null".

:id1653875990310 space:uriPrefix "users".
`;
    res.setHeader('content-type', 'text/turtle');
    res.send(ttl);
  });

  router.get('/:uid/privateTypeIndex.ttl',async (req,res)=>{
    const uid = req.params.uid;
    const ttl = `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<>
    a solid:TypeIndex ;
    a solid:UnlistedDocument.
`;
    res.setHeader('content-type', 'text/turtle');
    res.send(ttl);
  });

  router.get('/:uid/publicTypeIndex.ttl',async (req,res)=>{
    const uid = req.params.uid;
    const ttl = `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<>
    a solid:TypeIndex ;
    a solid:ListedDocument.
`;
    res.setHeader('content-type', 'text/turtle');
    res.send(ttl);
  });

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
    a cert:RSAPublicKey ;
    cert:modules "${cert_mod}"^^<http://www.w3.org/2001/XMLSchema#hexBinary> ;
    cert:exponent "${cert_exp}"^^<http://www.w3.org/2001/XMLSchema#integer>
  ] ;
`;
    }

    let trustList = '';
    for (let i=0;i<trustedApps.apps.length;i++) {
      const ta = trustedApps.apps[i];
      trustList += "    [\n      ";
      for (let j=0;j<ta.acl.length;j++) {
        trustList += `acl:${ta.acl[j]}`;
        if (j != (ta.acl.length - 1))
          trustList += ", ";
        else
          trustList += ";\n";
      }
      trustList += `      acl:origin <${ta.url}>\n`;
      trustList += "    ]";
      if (i != (trustedApps.apps.length - 1))
        trustList += ",\n";
      else
        trustList += "";
    }

    const ttl = `@prefix : <#>.
@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix cert: <http://www.w3.org/ns/auth/cert#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix ldp: <http://www.w3.org/ns/ldp#>.
@prefix schema: <http://schema.org/>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix space: <http://www.w3.org/ns/pim/space#>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix pro: <./>.

pro:card a foaf:PersonalProfileDocument; foaf:maker :me; foaf:primaryTopic :me.

:me
  a schema:Person, foaf:Person;
${pub_key}
  space:preferencesFile <./${uid}/prefs.ttl>;
  solid:privateTypeIndex <./${uid}/privateTypeIndex.ttl>;
  solid:publicTypeIndex <./${uid}/publicTypeIndex.ttl>;
  vcard:fn "${uid}";
  foaf:name "${uid}";
  acl:trustedApp
${trustList}
  .

`;
    res.setHeader('content-type', 'text/turtle');
    res.send(ttl);
  });

  return router;
};

export default init;
