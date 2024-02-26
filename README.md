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
    cp config/config.example.json config/config.json
    vi config/config.json
    npm run generate-keys
    cp config/clients.example.json config/clients.json
    vi config/clients.json
    cp config/users.example.json config/users.json
    vi config/users.json

### run

    node src/app.js

