# AnonFT
Privacy preserving NFT proof of ownership

Before running this repo, rename config.js.example to config.js and fill in the relevant variable with your Ethereum wallet information as is described within the file.

### Deploying Smart Contracts

Starting ganache:

    docker run -p 8545:8545 -d trufflesuite/ganache-cli:latest -g 0

Deploying contracts to local chain:

    truffle deploy

Deploying contracts to Goerli testnet:

    truffle migrate --network goerli

Then make note of the AnonFTFactory contract address and contract account to put into config.js

### Running the Webapp

Execute the following command:

    ./startup.sh

go to: http://localhost:8080/

### Run Whisper Node

To setup a node to communicate on the Whisper network run:

    cd whisper/
    docker-compose up -d

To shut down the Whisper node:

    docker-compose down

### Running a Relayer

To setup a relayer server, first complete the relevant relayer entries in config.js.

Then execute:

    cd relayer/
    npm install
    node relayer.js

Relayer should be listening on http://localhost:3000/

Built using Truffle, and OpenZeppelin

!!!Disclaimer!!!

The code in app/static/tornadoIntegrations.js is a paired down and slightly modified version of cli.js from https://github.com/tornadocash/tornado-cli

It is made clear by the comments within the file which parts are taken from the Tornado git repo and which functions are original for this repo
