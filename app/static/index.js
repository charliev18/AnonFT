const AnonFTContractJson = require('../../build/contracts/AnonFTFactory.json');

const CONTRACT_ADDR = '0xEa6Cbb5Ff1775f209925561976C49a4949938020';
const CONTRACT_ACCT = '0x82aaFE26333752B9ae2DB449541C4987A7146e80';

const SERVER_BASE = "http://localhost:8080/";

const proofCached = {};
const tokenCached = {};

const varDocumentMapping = {
    'witnesses': ['prove-1-w', 'prove-2-w'],
    'identifiers': ['input-identifiers'],
    'n': ['input-n'],
    'k': ['input-k'],
    'challenge': ['prove-2-c', 'verify-2-c'],
    'r': ['prove-2-r'],
    'x': ['verify-2-x'],
    'y': ['verify-2-y']
}

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

    tokenCached['tokenId'] = document.getElementById("input-token-id").value;
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
        gas: 400000
    })
    .then(function(receipt) {
        tokenCached['tokenId'] = receipt['events']['Transfer']['returnValues']['tokenId'];

        getPublicParams();
    });

    return false;
}

async function getPublicParams() {
    anonFTContract.methods.getOwnershipDataFor(tokenCached['tokenId']).call()
    .then(function(receipt) {
        tokenCached['n'] = receipt['n'];
        tokenCached['k'] = receipt['k'];
        tokenCached['identifiers'] = '[' + receipt['identifiers'].join(", ") + ']';

        showToken();
    });
}

function showToken() {
    document.getElementById('token-id').innerText = 'ID: ' + tokenCached['tokenId'];
    document.getElementById('token-n').innerText = 'N: ' + tokenCached['n'];
    document.getElementById('token-k').innerText = 'K: ' + tokenCached['k'];
    document.getElementById('token-identifiers').innerText = 'Identifiers: ' + tokenCached['identifiers'];
}

function cacheValues(json) {
    for (const value of Object.values(json)) {
        Object.assign(proofCached, value);
    }
    console.log(proofCached);
}

function autoFillCached() {
    for (const [key, value] of Object.entries(proofCached)) {
        if (!varDocumentMapping[key]) continue;
        for (const docId of varDocumentMapping[key]) {
            document.getElementById(docId).value = value;
        }
    }
}

const toTitleCase = str => str.replace(/(^\w)/g, m => m.toUpperCase())

/* 
Builds the following response HTML object:

<div class="card" style="width: 18rem;">
    <div class="card-header">
        <h5 class="card-title">Response</h5>
    </div>
    <div class="card-body">
        <h6 class="card-text">Public values:</h6>
        <p class="card-text">key1: value1</p>
        <p class="card-text">key2: value2</p>
        ...
    </div>
</div> 
*/
function buildResponse(obj, stage) {
    // Build HTML object
    var wrapper = document.createElement('div');
    var innerHTML = '<div class="card" style="width: 18rem;">' + 
                        '<div class="card-header">' +
                            '<h5 class="card-title">Response</h5>' +
                        '</div>' + 
                        '<div class="card-body">';

    for (const [outerKey, outerValue] of Object.entries(obj)) {
        innerHTML += `<h6 class="card-text">${toTitleCase(outerKey)} values:</h6>`;
        for (const [innerKey, innerValue] of Object.entries(outerValue)) {
            console.log(innerValue);
            innerHTML += `<p class="card-text">${toTitleCase(innerKey)}: ${toTitleCase(innerValue.toString())}</p>`;
        }
    }

    innerHTML += '</div></div>'
    wrapper.innerHTML = innerHTML;

    // Insert into document
    var location = stage + '-response';
    document.getElementById(location).innerHTML = '';
    document.getElementById(location).appendChild(wrapper);
}

/*  
 * Builds alert to display client errors to user
 */
async function handleError(reason, stage) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="alert alert-danger alert-dismissible" role="alert">' + 
                        reason + 
                        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>';
    
    var location = stage + '-alert';
    document.getElementById(location).innerHTML = '';
    document.getElementById(location).appendChild(wrapper);
}

/*
 * Communicates relevant request to server and handles response
 */
async function retrieveFromServer(endpoint, stage, req) {
    fetch(SERVER_BASE + endpoint, req)
    .then((response) => {
        if (response.ok) {
            return response.json();
        }

        return Promise.reject(response);
    }).then((json) => {
        buildResponse(json, stage);
        cacheValues(json);
        autoFillCached();
    }).catch(error => {
        console.log(error);
        error.text().then(err => handleError(err, stage));
    });

    return 
}

async function getSetupParams(event) {
    event.preventDefault();
    console.log("In setup")
    proofCached['k'] = document.getElementById('setup-k').value;

    retrieveFromServer(
        'setup',
        'setup', 
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                p : document.getElementById('setup-p').value,
                q : document.getElementById('setup-q').value,
                k : document.getElementById('setup-k').value
            })
        }
    );

    return false;
}

async function proverFirstAction(event) {
    event.preventDefault();
    console.log("In prover 1")

    retrieveFromServer(
        'prove1',
        'prove-1',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                n : tokenCached['n'],
                k : tokenCached['k'],
                witnesses : JSON.parse(document.getElementById('prove-1-w').value)
            })
        }
    );

    return false;
}

async function proverSecondAction(event) {
    event.preventDefault();
    console.log("In prover 2")

    retrieveFromServer(
        'prove2',
        'prove-2',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                n : tokenCached['n'],
                k : tokenCached['k'],
                r : document.getElementById('prove-2-r').value,
                challenge : JSON.parse(document.getElementById('prove-2-c').value),
                witnesses : JSON.parse(document.getElementById('prove-2-w').value)
            })
        }
    );

    return false;
}

async function verifierFirstAction(event) {
    event.preventDefault();
    console.log("In verifier 1")

    retrieveFromServer(
        'verify1',
        'verify-1',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                k : tokenCached['k']
            })
        }
    );

    return false;
}

async function verifierSecondAction(event) {
    event.preventDefault();
    console.log("In verifier 2")

    retrieveFromServer(
        'verify2',
        'verify-2',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                n : tokenCached['n'],
                k : tokenCached['k'],
                identifiers : tokenCached['identifiers'],
                x : document.getElementById('verify-2-x').value,
                y : document.getElementById('verify-2-y').value,
                challenge : JSON.parse(document.getElementById('verify-2-c').value)
            })
        }
    );

    return false;
}

init();
