# idsrv

A WebID-OIDC authentication server appropriating
google accounts for authentication.

It's in the testing phase now.

### setup mongodb

### setup nginx

If you use nginx for reverse proxy, do not forget
configure 'Access-Control-Allow-Headers'. For example

    add_header Access-Control-Allow-Headers "Authorization, X-XSRF-TOKEN, DPOP";

You sould include 'DPOP' in Access-Control-Allow-Headers.

### setup

    sudo apt install mongodb
    git clone https://github.com/ksaito-hiu/idsrv.git
    cd idsrv
    npm install
    cp config.example.json config.json
    vi config.json
    npm run generate-keys
    cp clients.example.json clients.json
    vi clients.json
    cp users.example.json users.json
    vi users.json

### run

    node app.js

