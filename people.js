const express = require('express');
const router = express.Router();
const config = require('./config.json');

(async function() {
    router.get('/:uid',(req,res)=>{
        const uid = req.params.uid;
        const ttl = `@prefix : <https://id.do-johodai.ac.jp/people/${uid}#>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix n0: <http://xmlns.com/foaf/0.1/>.
@prefix schem: <http://schema.org/>.
@prefix n: <http://www.w3.org/2006/vcard/ns#>.
@prefix n1: <http://www.w3.org/ns/auth/acl#>.
@prefix cert: <http://www.w3.org/ns/auth/cert#>.
@prefix XML: <http://www.w3.org/2001/XMLSchema#>.
@prefix ldp: <http://www.w3.org/ns/ldp#>.
@prefix inbox: </inbox/>.
@prefix sp: <http://www.w3.org/ns/pim/space#>.

:me
    a schem:Person, n0:Person;
    n:fn "Dummy name".

`;
        res.setHeader('content-type', 'text/turtle');
        res.send(ttl);
    });
})();

module.exports = router;
