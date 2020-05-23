const express = require('express');

(async () => {
  const config = require('./config.json');
  const idsrv = await require('./idsrv')(config);

  const expressApp = express();

  expressApp.get('/robots.txt',(req,res)=>{
    res.header('Content-Type', 'text/plain');
    res.end("User-agent: *\nDisallow: /\n");
  });

  expressApp.use('/',idsrv);

  // express listen
  expressApp.listen(config.server.port,()=>{
    console.log(`check https://${config.server.hostname}${config.server.prefix}/.well-known/openid-configuration`);
  });
})();
