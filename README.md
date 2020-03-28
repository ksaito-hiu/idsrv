# idsrv

A WebID-OIDC authentication server just for Hokkaido
Information University.

It's in the testing phase now.

### setup

    npm install
    node generate-keys.js
    cp config.example.json config.json
    vi config.json
    cp clients.example.json clients.json
    vi clients.json
    cp users.example.json users.json
    vi users.json

### run

    node app.js

