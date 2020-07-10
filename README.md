# idsrv

A WebID-OIDC authentication server appropriating
google accounts for authentication.

It's in the testing phase now.

### setup

    npm install
    cp config.example.json config.json
    vi config.json
    ./generate-keys.js config.json
    cp clients.example.json clients.json
    vi clients.json
    cp users.example.json users.json
    vi users.json

### run

    node app.js

