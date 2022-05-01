# AnonFT
Privacy preserving NFT proof of ownership

Starting ganache:

    docker run -p 8545:8545 -d trufflesuite/ganache-cli:latest -g 0

Deploying contracts to local chain:

    truffle deploy

Then make note of the AnonFTFactory contract address and contract account to put into index.js

Running the webapp:

    ./startup

go to: http://localhost:8080/

Built using Truffle, and OpenZeppelin
