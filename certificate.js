const express = require('express');
const forge = require('node-forge');

// 生成した証明書の有効期限(単位:分)
const time_limit = 10;


const router = express.Router();

const init = async function(config,initial_users) {
  let colUsers = null;

  // uidとpasswordを受け取りx509証明書を作り
  // 必要な情報を返す関数
  function create_certificate(uid,password) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear()+10);
    const attrs = [
      {
        name: 'commonName',
        value: `WebID for ${uid}`
      }
      ,{
        name: 'UID',
        type: '0.9.2342.19200300.100.1.1',
        value: config.server.id2webid(uid)
      }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{
      name: 'subjectKeyIdentifier'
    },{
      name: 'subjectAltName',
      altNames: [{
        type: 6, // URI
        value: config.server.id2webid(uid)
      }]
    },{
      name: 'basicConstraints',
      cA: false
    }, {
      name: 'extKeyUsage',
      clientAuth: true
    }, {
      name: 'nsCertType',
      client: true
    }]);
    // self-sign certificate
    cert.sign(keys.privateKey);

    const pem = forge.pki.privateKeyToPem(keys.privateKey)
              + forge.pki.certificateToPem(cert);
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password);
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    let pub_mod = '';
    for (let i=0;i<keys.publicKey.n.data.length;i++) {
      const num = keys.publicKey.n.data[i];
      // 以下の1行は、numを7桁の16進数に変換するプログラム
      const h = ('000000'+num.toString(16).toUpperCase()).substr(-7);
      if (i%2===0) {
        pub_mod = h.substring(5,7) + pub_mod;
        pub_mod = h.substring(3,5) + pub_mod;
        pub_mod = h.substring(1,3) + pub_mod;
        pub_mod = h.substring(0,1) + pub_mod;
      } else {
        pub_mod = h.substring(6,7) + pub_mod;
        pub_mod = h.substring(4,6) + pub_mod;
        pub_mod = h.substring(2,4) + pub_mod;
        pub_mod = h.substring(0,2) + pub_mod;
      }
    }
    pub_mod = pub_mod.substring(6);
    const pub_exp = keys.publicKey.e.data[0];
    return {
      pem,
      p12Der,
      pub_mod,
      pub_exp
    };
  }

  // MongoDBのクライアントを受け取ってDBを取得し、
  // usersを記録するためのcollectionを取得。
  // DBは'idsrv'の決め打ち
  router.set_mongo_client = async function(mc) {
    const db = mc.db('idsrv');
    colUsers = await db.collection('users');
  };

  // ログインチェック
  function loginCheck(req,res,next) {
    if (!req.session) {
      res.render('message',{message:"You have to login."});
      return;
    }
    if (!req.session.webid) {
      res.render('message',{message:"You have to login."});
      return;
    }
    next();
  }

  router.get('/',loginCheck,(req,res)=>{
    res.render('certificate/cert_top');
  });

  router.get('/new_cert',loginCheck,(req,res)=> {
    const uid = req.session.uid;
    const password1 = req.query.password1 || "";
    const password2 = req.query.password2 || "";
    if (password1 != password2) {
      res.render('error',{message:'Password did not match!'});
      return;
    }
    const cert = create_certificate(uid,password1);
    req.session.cert = cert;
    setTimeout(function() {
      delete req.session.cert;
    },time_limit*60*1000);
    res.render('certificate/new_cert',{time_limit});
  });

  router.get('/pem_cert',loginCheck,(req,res)=> {
    if (!req.session.cert || !req.session.cert.pem) {
      res.render('error',{message:'You have to create cert first!'});
      return;
    }
    res.setHeader('Content-disposition','attachment; filename=webid.pem');
    res.setHeader('Content-Type','text/plain');
    res.send(req.session.cert.pem);
  });

  router.get('/p12_cert',loginCheck,(req,res)=> {
    if (!req.session.cert || !req.session.cert.p12Der) {
      res.render('error',{message:'You have to create cert first!'});
      return;
    }
    res.setHeader('Content-disposition','attachment; filename=webid.p12');
    res.setHeader('Content-Type','application/x-pkcs12');
    res.setHeader('Content-Length',req.session.cert.p12Der.length);
    res.write(req.session.cert.p12Der,'binary');
    res.end();
  });

  router.get('/register',loginCheck,async (req,res)=> {
    if (!req.session.cert || !req.session.cert.pub_mod || !req.session.cert.pub_exp) {
      res.render('error',{message:'You have to create cert first!'});
      return;
    }
    const uid = req.session.uid;
    const pub_mod = req.session.cert.pub_mod;
    const pub_exp = req.session.cert.pub_exp;
    for (let u of initial_users.users) {
      if (u.id === uid) {
        res.render('error',{message:'Could not register, because you are a special user.'});
        return;
      }
    }
    const r = await colUsers.updateOne({id:uid},{$set:{pub_mod,pub_exp}},{upsert:true});
    if (r.modifiedCount!==1) {
      res.render('error',{message:'Could not register your public_key to the database.'});
      return;
    }
    delete req.session.cert;
    res.render('certificate/register');
  });

  return router;
};

module.exports = init;
