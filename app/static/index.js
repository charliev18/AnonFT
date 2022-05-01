const AnonFTContractJson = require('../../build/contracts/AnonFTFactory.json');

const CONTRACT_ADDR = '0x7c1E07969cf56fe6b562FFAe414Dc8412eb5cEFC';
const CONTRACT_ACCT = '0x53eD736Ac1e0e82A95B205FeB47976d27f0ff96c';

const SERVER_BASE = "http://localhost:8080/";

var tokenId = -1;
var publicParams = {n: -1, k: -1, identifiers: [-1, -1, -1]};

function init() {
    var web3 = new Web3('ws://localhost:8545');
    window.web3 = web3;

    var anonFTContract = new web3.eth.Contract(AnonFTContractJson.abi, CONTRACT_ADDR);
    // Bind to window
    anonFTContract.defaultAccount = CONTRACT_ACCT;
    window.anonFTContract = anonFTContract;

    document.getElementById("mint-nft").addEventListener('submit', mintNFT);
    document.getElementById("connect-nft").addEventListener('submit', connectNFT);
    document.getElementById("setup-proof").addEventListener('submit', getSetupParams);
    document.getElementById("prove-1").addEventListener('submit', proverFirstAction);
    document.getElementById("prove-2").addEventListener('submit', proverSecondAction);
    document.getElementById("verify-1").addEventListener('submit', verifierFirstAction);
    document.getElementById("verify-2").addEventListener('submit', verifierSecondAction);
    
    showToken();
}

async function connectNFT(event) {
    event.preventDefault();

    tokenId = document.getElementById("input-token-id").value;
    getPublicParams();

    return false;
}

async function mintNFT(event) {
    event.preventDefault();

    // TODO: ALLOW FILE UPLOAD
    // Parsing file upload
    // var fileDataRaw = document.getElementById("mint-upload").files[0].text();
    // var fileDataJson = JSON.parse(fileDataRaw);

    anonFTContract.methods.mint(document.getElementById("input-user-id").value,
                                document.getElementById("input-n").value,
                                document.getElementById("input-k").value,
                                JSON.parse(document.getElementById("input-identifiers").value)
                                )
    .send({
        from: CONTRACT_ACCT,
        gas: 300000
    })
    .then(function(receipt) {
        tokenId = receipt['events']['Transfer']['returnValues']['tokenId'];

        getPublicParams();
    });

    return false;
}

async function getPublicParams() {
    anonFTContract.methods.getOwnershipDataFor(tokenId).call()
    .then(function(receipt) {
        publicParams['n'] = receipt['n'];
        publicParams['k'] = receipt['k'];
        publicParams['identifiers'] = receipt['identifiers'];

        showToken();
    });
}

function showToken() {
    document.getElementById('token-id').innerText = 'ID: ' + tokenId;
    document.getElementById('token-n').innerText = 'N: ' + publicParams['n'];
    document.getElementById('token-k').innerText = 'K: ' + publicParams['k'];
    document.getElementById('token-identifiers').innerText = 'Identifiers: ' + publicParams['identifiers'];
}

async function getSetupParams(event) {
    event.preventDefault();
    console.log("In setup")

    fetch(SERVER_BASE + 'setup', {
        method : 'POST',
        headers: {'Content-Type': 'application/json;charset=utf-8'},
        body : JSON.stringify({
            p : document.getElementById('setup-p').value,
            q : document.getElementById('setup-q').value,
            k : document.getElementById('setup-k').value
        })
    }).then(
        response => response.json()
    ).then(
        html => console.log(html)
    );
    return false;
}

async function proverFirstAction(event) {
    event.preventDefault();
    console.log("In prover 1")

    fetch(SERVER_BASE + 'prove1', {
        method : 'POST',
        headers: {'Content-Type': 'application/json;charset=utf-8'},
        body : JSON.stringify({
            n : publicParams['n'],
            k : publicParams['k'],
            witnesses : JSON.parse(document.getElementById('prove-1-w').value)
        })
    }).then(
        response => response.json()
    ).then(
        html => console.log(html)
    );
    return false;
}

async function proverSecondAction(event) {
    event.preventDefault();
    console.log("In prover 2")

    fetch(SERVER_BASE + 'prove2', {
        method : 'POST',
        headers: {'Content-Type': 'application/json;charset=utf-8'},
        body : JSON.stringify({
            n : publicParams['n'],
            k : publicParams['k'],
            r : document.getElementById('prove-2-r').value,
            challenge : JSON.parse(document.getElementById('prove-2-c').value),
            witnesses : JSON.parse(document.getElementById('prove-2-w').value)
        })
    }).then(
        response => response.json()
    ).then(
        html => console.log(html)
    );
    return false;
}

async function verifierFirstAction(event) {
    event.preventDefault();
    console.log("In verifier 1")

    fetch(SERVER_BASE + 'verify1', {
        method : 'POST',
        headers: {'Content-Type': 'application/json;charset=utf-8'},
        body : JSON.stringify({
            k : publicParams['k']
        })
    }).then(
        response => response.json()
    ).then(
        html => console.log(html)
    );
    return false;
}

async function verifierSecondAction(event) {
    event.preventDefault();
    console.log("In verifier 2")

    fetch(SERVER_BASE + 'verify2', {
        method : 'POST',
        headers: {'Content-Type': 'application/json;charset=utf-8'},
        body : JSON.stringify({
            n : publicParams['n'],
            k : publicParams['k'],
            identifiers : publicParams['identifiers'],
            x : document.getElementById('verify-2-x').value,
            y : document.getElementById('verify-2-y').value,
            challenge : JSON.parse(document.getElementById('verify-2-c').value)
        })
    }).then(
        response => response.json()
    ).then(
        html => console.log(html)
    );
    return false;
}

init();
