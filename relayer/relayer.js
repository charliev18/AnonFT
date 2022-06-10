const express = require('express');
const bodyParser = require('body-parser');
const { PRIVATE_KEY, goerliProxyAddr, ethProxyAddr, anonFTAddr, provider, gasLimit, etherscanApiKey, accountAddr } = require('./config');
const Web3 = require('web3');
const tornadoProxyABI = require('./tornadoProxyABI.json');
const anonFTjson = require('../build/contracts/AnonFTFactory.json');

const app = express();
const port = 3000;;

let web3, goerliContract, ethContract, anonFTContract, nonce;

function init() {
    web3 = new Web3(provider);
    goerliContract = new web3.eth.Contract(tornadoProxyABI, goerliProxyAddr);
    console.log("done init");
    // ethContract = new web3.eth.Contract(tornadoProxyABI, ethProxyAddr);
    anonFTContract = new web3.eth.Contract(anonFTjson.abi, anonFTAddr);

    // let calldata = anonFTContract.methods.mintDummy(209, 4, JSON.parse("[-16, 130, 188, 102]")).encodeABI();
    // submitTransaction(anonFTAddr, calldata)
}

async function submitTransaction(destination, calldata) {
    let _nonce = await getNonce();
    nonce = nonce > _nonce ? nonce : _nonce;
    console.log(nonce);

    tx = {
        nonce: nonce,
        to: destination,
        data: calldata,
        gas: gasLimit
    }
    return web3.eth.accounts.signTransaction(tx, PRIVATE_KEY)
        .then((res) => {
            return res.rawTransaction;
        })
        .then((raw) => {
            nonce += 1;
            return web3.eth.sendSignedTransaction(raw);
        })
        .then((receipt) => {
            console.log(receipt);
            return receipt;
        }).catch(err => {
            console.log(err);
            return err;
        }
    );
}

async function getNonce() {
    return await web3.eth.getTransactionCount(accountAddr);
}

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

app.use(bodyParser.urlencoded({extended: false}))

app.use(bodyParser.json())

app.all('/', (req, res) => {
    console.log("Hello");
    res.send('Hello World!');
    res.end();
});

// This is open to attacks if users only submit 'commit' without following up with mint
app.post('/commit', (req, res) => {
    console.log("HANDLING COMMITMENT");
    console.log(req.body);
    let ident = req.body.publicIds;
    let commitment = req.body.commitment;

    let calldata = anonFTContract.methods.commitID(commitment, ident.n, ident.k, ident.identifiers).encodeABI();

    submitTransaction(anonFTAddr, calldata).then((receipt) => {
        res.send(receipt);
    });
})

app.post('/pay', (req, res) => {
    console.log("HANDLING PAYMENT");
    console.log(req.body);

    let snark = req.body.proof;
    let contract = req.body.contract;
    let args = req.body.args;

    let calldata = goerliContract.methods.withdraw(snark, ...args).encodeABI();

    submitTransaction(contract, calldata).then((receipt) => {
        res.send(receipt);
    });
})

app.post('/confirm', (req, res) => {
    console.log("HANDLING CONFIRMATION");
    console.log(req.body);

    let commitment = req.body.commitment;
    let tokenId = req.body.tokenId;

    let calldata;
    if (tokenId == 0) {
        calldata = anonFTContract.methods.confirmAndMint(commitment).encodeABI();
    } else {
        calldata = anonFTContract.methods.confirmAndTransfer(tokenId, commitment).encodeABI();
    }
    
    submitTransaction(anonFTAddr, calldata).then((receipt) => {
        res.send(receipt);
    });
})

app.post('/initProof', (req, res) => {
    console.log("HANDLING PROOF COMMITMENT");
    console.log(req.body);

    let commitment = req.body.commitment;
    let tokenId = req.body.tokenId;
    let address = req.body.address;
    
    let calldata = anonFTContract.methods.initiateSaleProof(commitment, tokenId, address).encodeABI();

    submitTransaction(anonFTAddr, calldata).then((receipt) => {
        res.send(receipt);
    });
})

app.post('/proveCommit', (req, res) => {
    console.log("HANDLING PROOF COMMITMENT");
    console.log(req.body);

    let commitment = req.body.commitment;
    let x = req.body.x;
    
    let calldata = anonFTContract.methods.receiveChallenge(commitment, x).encodeABI();

    submitTransaction(anonFTAddr, calldata).then((receipt) => {
        res.send(receipt['logs'][0]['data']);
    });
})

app.post('/proveVerify', (req, res) => {
    console.log("HANDLING PROOF VERIFICATION");
    console.log(req.body);

    let commitment = req.body.commitment;
    let y = req.body.y;
    
    let calldata = anonFTContract.methods.submitVerification(commitment, y).encodeABI();

    submitTransaction(anonFTAddr, calldata).then((receipt) => {
        res.send(receipt);
    });
})

init();

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})
