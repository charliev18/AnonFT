const express = require('express');
const bodyParser = require('body-parser');
const { PRIVATE_KEY, goerliProxyAddr, ethProxyAddr, anonFTAddr, provider, gasLimit, accountAddr } = require('../config.js');
const Web3 = require('web3');
const tornadoProxyABI = require('./tornadoProxyABI.json');
const anonFTjson = require('../build/contracts/AnonFTFactory.json');

const app = express();
const port = 3000;

let web3, goerliContract, ethContract, anonFTContract, nonce;


/**
 * Sets up relevant contracts and web3 provider, using values from config
 */
function init() {
    web3 = new Web3(provider);
    goerliContract = new web3.eth.Contract(tornadoProxyABI, goerliProxyAddr);
    console.log("done init");
    ethContract = new web3.eth.Contract(tornadoProxyABI, ethProxyAddr);
    anonFTContract = new web3.eth.Contract(anonFTjson.abi, anonFTAddr);
}


/**
 * Helper function to manage submitting web3 transactions
 * @param   destination: target contract address
 * @param   calldata: transaction content
 * @returns transaction receipt
 */
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


/**
 * Returns the current account nonce for better nonce management
 */
async function getNonce() {
    return await web3.eth.getTransactionCount(accountAddr);
}


/**
 * Sets up server to receive requests
 */
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


/**
 * Server endpoint for commit phase of anonymous transaction protocol
 * expects request like:
 * {
 *  publicIds: {n:..., k:..., identifiers:...},
 *  commitment: ...
 * }
 */
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


/**
 * Server endpoint for payment phase of anonymous transaction protocol
 * expects request like:
 * {
 *  proof: ...,
 *  contract: ...,
 *  args: {Tornado Cash arguments}
 * }
 */
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


/**
 * Server endpoint for confirmation phase of anonymous transaction protocol
 * expects request like:
 * {
 *  commitment: ...,
 *  tokenId: ...
 * }
 */
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


/**
 * Server endpoint for proof initiation phase of anonymous transaction protocol
 * expects request like:
 * {
 *  tokenId: ...,
 *  address: ...,
 *  commitment: ...
 * }
 */
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


/**
 * Server endpoint for proof commitent phase of anonymous transaction protocol
 * expects request like:
 * {
 *  x: ...,
 *  commitment: ...
 * }
 */
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


/**
 * Server endpoint for proof verification phase of anonymous transaction protocol
 * expects request like:
 * {
 *  y: ...,
 *  commitment: ...
 * }
 */
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
