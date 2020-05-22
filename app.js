const express = require('express');
const session = require('express-session');

(async () => {
  const config = require('./config.json');
  const router = await require('./idsrv')(config);

  const expressApp = express();

  expressApp.set('trust proxy', true);
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', './views');

  expressApp.get('/robots.txt',(req,res)=>{
    res.header('Content-Type', 'text/plain');
    res.end("User-agent: *\nDisallow: /\n");
  });

  expressApp.use(session({
    secret: 'some secret string',
    resave: false,
    saveUninitialized: false, //??? しかも要るかな？
    httpOnly: true, // openid-clientパッケージの要請
    secure: true, // openid-clientパッケージの要請
    //cookie: { path: '/auth', maxAge: 30 * 60 * 1000 }
    cookie: { maxAge: 30 * 60 * 1000 }
  }));

  expressApp.use('/',router);

  // express listen
  expressApp.listen(config.server.port,()=>{
    console.log(`check https://${config.server.hostname}${config.server.prefix}/.well-known/openid-configuration`);
  });
})();
