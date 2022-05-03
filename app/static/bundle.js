(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const AnonFTContractJson = require('../../build/contracts/AnonFTFactory.json');

const CONTRACT_ADDR = '0xEa6Cbb5Ff1775f209925561976C49a4949938020';
const CONTRACT_ACCT = '0x82aaFE26333752B9ae2DB449541C4987A7146e80';

const SERVER_BASE = "http://localhost:8080/";

// var tokenId = -1;
// var publicParams = {n: -1, k: -1, identifiers: [-1, -1, -1]};
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

},{"../../build/contracts/AnonFTFactory.json":2}],2:[function(require,module,exports){
module.exports={
  "contractName": "AnonFTFactory",
  "abi": [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "approved",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "operator",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "approved",
          "type": "bool"
        }
      ],
      "name": "ApprovalForAll",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "getApproved",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "operator",
          "type": "address"
        }
      ],
      "name": "isApprovedForAll",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "ownerOf",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [],
      "name": "renounceOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "safeTransferFrom",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        },
        {
          "internalType": "bytes",
          "name": "_data",
          "type": "bytes"
        }
      ],
      "name": "safeTransferFrom",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "operator",
          "type": "address"
        },
        {
          "internalType": "bool",
          "name": "approved",
          "type": "bool"
        }
      ],
      "name": "setApprovalForAll",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes4",
          "name": "interfaceId",
          "type": "bytes4"
        }
      ],
      "name": "supportsInterface",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "tokenURI",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "n",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "k",
          "type": "uint256"
        },
        {
          "internalType": "int256[]",
          "name": "identifiers",
          "type": "int256[]"
        }
      ],
      "name": "mint",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "n",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "k",
          "type": "uint256"
        },
        {
          "internalType": "int256[]",
          "name": "identifiers",
          "type": "int256[]"
        }
      ],
      "name": "transfer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getLastID",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "getOwnershipDataFor",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "n",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "k",
              "type": "uint256"
            },
            {
              "internalType": "int256[]",
              "name": "identifiers",
              "type": "int256[]"
            }
          ],
          "internalType": "struct AnonFTFactory.IdentityData",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    }
  ],
  "metadata": "{\"compiler\":{\"version\":\"0.8.1+commit.df193b15\"},\"language\":\"Solidity\",\"output\":{\"abi\":[{\"inputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"approved\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"Approval\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"operator\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"bool\",\"name\":\"approved\",\"type\":\"bool\"}],\"name\":\"ApprovalForAll\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"previousOwner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"OwnershipTransferred\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"from\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"Transfer\",\"type\":\"event\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"approve\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"}],\"name\":\"balanceOf\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"getApproved\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"getLastID\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"getOwnershipDataFor\",\"outputs\":[{\"components\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"k\",\"type\":\"uint256\"},{\"internalType\":\"int256[]\",\"name\":\"identifiers\",\"type\":\"int256[]\"}],\"internalType\":\"struct AnonFTFactory.IdentityData\",\"name\":\"\",\"type\":\"tuple\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"operator\",\"type\":\"address\"}],\"name\":\"isApprovedForAll\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"k\",\"type\":\"uint256\"},{\"internalType\":\"int256[]\",\"name\":\"identifiers\",\"type\":\"int256[]\"}],\"name\":\"mint\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"name\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"ownerOf\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"renounceOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"from\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"safeTransferFrom\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"from\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"},{\"internalType\":\"bytes\",\"name\":\"_data\",\"type\":\"bytes\"}],\"name\":\"safeTransferFrom\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"operator\",\"type\":\"address\"},{\"internalType\":\"bool\",\"name\":\"approved\",\"type\":\"bool\"}],\"name\":\"setApprovalForAll\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes4\",\"name\":\"interfaceId\",\"type\":\"bytes4\"}],\"name\":\"supportsInterface\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"symbol\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"tokenURI\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"k\",\"type\":\"uint256\"},{\"internalType\":\"int256[]\",\"name\":\"identifiers\",\"type\":\"int256[]\"}],\"name\":\"transfer\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"from\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"tokenId\",\"type\":\"uint256\"}],\"name\":\"transferFrom\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"transferOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}],\"devdoc\":{\"kind\":\"dev\",\"methods\":{\"approve(address,uint256)\":{\"details\":\"See {IERC721-approve}.\"},\"balanceOf(address)\":{\"details\":\"See {IERC721-balanceOf}.\"},\"getApproved(uint256)\":{\"details\":\"See {IERC721-getApproved}.\"},\"isApprovedForAll(address,address)\":{\"details\":\"See {IERC721-isApprovedForAll}.\"},\"name()\":{\"details\":\"See {IERC721Metadata-name}.\"},\"owner()\":{\"details\":\"Returns the address of the current owner.\"},\"ownerOf(uint256)\":{\"details\":\"See {IERC721-ownerOf}.\"},\"renounceOwnership()\":{\"details\":\"Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.\"},\"safeTransferFrom(address,address,uint256)\":{\"details\":\"See {IERC721-safeTransferFrom}.\"},\"safeTransferFrom(address,address,uint256,bytes)\":{\"details\":\"See {IERC721-safeTransferFrom}.\"},\"setApprovalForAll(address,bool)\":{\"details\":\"See {IERC721-setApprovalForAll}.\"},\"supportsInterface(bytes4)\":{\"details\":\"See {IERC165-supportsInterface}.\"},\"symbol()\":{\"details\":\"See {IERC721Metadata-symbol}.\"},\"tokenURI(uint256)\":{\"details\":\"See {IERC721Metadata-tokenURI}.\"},\"transferFrom(address,address,uint256)\":{\"details\":\"See {IERC721-transferFrom}.\"},\"transferOwnership(address)\":{\"details\":\"Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.\"}},\"version\":1},\"userdoc\":{\"kind\":\"user\",\"methods\":{},\"version\":1}},\"settings\":{\"compilationTarget\":{\"project:/contracts/AnonFTFactory.sol\":\"AnonFTFactory\"},\"evmVersion\":\"istanbul\",\"libraries\":{},\"metadata\":{\"bytecodeHash\":\"ipfs\"},\"optimizer\":{\"enabled\":false,\"runs\":200},\"remappings\":[]},\"sources\":{\"@openzeppelin/contracts/access/Ownable.sol\":{\"keccak256\":\"0x24e0364e503a9bbde94c715d26573a76f14cd2a202d45f96f52134ab806b67b9\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://e12cbaa7378fd9b62280e4e1d164bedcb4399ce238f5f98fc0eefb7e50577981\",\"dweb:/ipfs/QmXRoFGUgfsaRkoPT5bxNMtSayKTQ8GZATLPXf69HcRA51\"]},\"@openzeppelin/contracts/token/ERC721/ERC721.sol\":{\"keccak256\":\"0x921f012325281f7d81e29c53a13824cf6c2c5d77232065d0d4f3f912e97af6ea\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://7dbcedc364fce0ab5e54d21d4cbd91a97959f52c0674cf5c36a314bb58308f62\",\"dweb:/ipfs/QmfYpqHKtu3bSQ9FGvLwzdxRNykStpVPtoLNTaM1KBKj6E\"]},\"@openzeppelin/contracts/token/ERC721/IERC721.sol\":{\"keccak256\":\"0x0d4de01fe5360c38b4ad2b0822a12722958428f5138a7ff47c1720eb6fa52bba\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://77724cecdfba8814632ab58737c2b0f2d4ad2d532bc614aee559b5593c1152f0\",\"dweb:/ipfs/QmUcE6gXyv7CQh4sUdcDABYKGTovTe1zLMZSEq95nkc3ph\"]},\"@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol\":{\"keccak256\":\"0xa82b58eca1ee256be466e536706850163d2ec7821945abd6b4778cfb3bee37da\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://6e75cf83beb757b8855791088546b8337e9d4684e169400c20d44a515353b708\",\"dweb:/ipfs/QmYvPafLfoquiDMEj7CKHtvbgHu7TJNPSVPSCjrtjV8HjV\"]},\"@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol\":{\"keccak256\":\"0x75b829ff2f26c14355d1cba20e16fe7b29ca58eb5fef665ede48bc0f9c6c74b9\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://a0a107160525724f9e1bbbab031defc2f298296dd9e331f16a6f7130cec32146\",\"dweb:/ipfs/QmemujxSd7gX8A9M8UwmNbz4Ms3U9FG9QfudUgxwvTmPWf\"]},\"@openzeppelin/contracts/utils/Address.sol\":{\"keccak256\":\"0x2ccf9d2313a313d41a791505f2b5abfdc62191b5d4334f7f7a82691c088a1c87\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://b3a57d0854b2fdce6ebff933a48dca2445643d1eccfc27f00292e937f26c6a58\",\"dweb:/ipfs/QmW45rZooS9TqR4YXUbjRbtf2Bpb5ouSarBvfW1LdGprvV\"]},\"@openzeppelin/contracts/utils/Context.sol\":{\"keccak256\":\"0xe2e337e6dde9ef6b680e07338c493ebea1b5fd09b43424112868e9cc1706bca7\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://6df0ddf21ce9f58271bdfaa85cde98b200ef242a05a3f85c2bc10a8294800a92\",\"dweb:/ipfs/QmRK2Y5Yc6BK7tGKkgsgn3aJEQGi5aakeSPZvS65PV8Xp3\"]},\"@openzeppelin/contracts/utils/Counters.sol\":{\"keccak256\":\"0xf0018c2440fbe238dd3a8732fa8e17a0f9dce84d31451dc8a32f6d62b349c9f1\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://59e1c62884d55b70f3ae5432b44bb3166ad71ae3acd19c57ab6ddc3c87c325ee\",\"dweb:/ipfs/QmezuXg5GK5oeA4F91EZhozBFekhq5TD966bHPH18cCqhu\"]},\"@openzeppelin/contracts/utils/Strings.sol\":{\"keccak256\":\"0x32c202bd28995dd20c4347b7c6467a6d3241c74c8ad3edcbb610cd9205916c45\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://8179c356adb19e70d6b31a1eedc8c5c7f0c00e669e2540f4099e3844c6074d30\",\"dweb:/ipfs/QmWFbivarEobbqhS1go64ootVuHfVohBseerYy9FTEd1W2\"]},\"@openzeppelin/contracts/utils/introspection/ERC165.sol\":{\"keccak256\":\"0xd10975de010d89fd1c78dc5e8a9a7e7f496198085c151648f20cba166b32582b\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://fb0048dee081f6fffa5f74afc3fb328483c2a30504e94a0ddd2a5114d731ec4d\",\"dweb:/ipfs/QmZptt1nmYoA5SgjwnSgWqgUSDgm4q52Yos3xhnMv3MV43\"]},\"@openzeppelin/contracts/utils/introspection/IERC165.sol\":{\"keccak256\":\"0x447a5f3ddc18419d41ff92b3773fb86471b1db25773e07f877f548918a185bf1\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://be161e54f24e5c6fae81a12db1a8ae87bc5ae1b0ddc805d82a1440a68455088f\",\"dweb:/ipfs/QmP7C3CHdY9urF4dEMb9wmsp1wMxHF6nhA2yQE5SKiPAdy\"]},\"project:/contracts/AnonFTFactory.sol\":{\"keccak256\":\"0x8fbb10576bee0728ee9fe07454d9e1373eec14cea25d3c39d88543272c457523\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://026a0aa61406fd78daba1248dda8cb989ef0582dda7992b579228f5bd02debc7\",\"dweb:/ipfs/QmQVs1vLn6ydpxnasqzHWHtTxQynmtcR1bZSNrKngSwDe6\"]}},\"version\":1}",
  "bytecode": "0x60806040523480156200001157600080fd5b506040518060400160405280600d81526020017f416e6f6e4654466163746f7279000000000000000000000000000000000000008152506040518060400160405280600481526020017f414e465400000000000000000000000000000000000000000000000000000000815250816000908051906020019062000096929190620001ca565b508060019080519060200190620000af929190620001ca565b505050620000d2620000c6620000ef60201b60201c565b620000f760201b60201c565b620000e96007620001bd60201b62000e821760201c565b620002df565b600033905090565b6000600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b6000816000018190555050565b828054620001d8906200027a565b90600052602060002090601f016020900481019282620001fc576000855562000248565b82601f106200021757805160ff191683800117855562000248565b8280016001018555821562000248579182015b82811115620002475782518255916020019190600101906200022a565b5b5090506200025791906200025b565b5090565b5b80821115620002765760008160009055506001016200025c565b5090565b600060028204905060018216806200029357607f821691505b60208210811415620002aa57620002a9620002b0565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b61315f80620002ef6000396000f3fe608060405234801561001057600080fd5b506004361061012c5760003560e01c8063715018a6116100ad578063bb287ff511610071578063bb287ff51461031b578063c87b56dd1461034b578063e985e9c51461037b578063f2fde38b146103ab578063f9986088146103c75761012c565b8063715018a61461029d5780638da5cb5b146102a757806395d89b41146102c5578063a22cb465146102e3578063b88d4fde146102ff5761012c565b806323b872dd116100f457806323b872dd146101e957806341265c411461020557806342842e0e146102215780636352211e1461023d57806370a082311461026d5761012c565b806301ffc9a71461013157806306fdde0314610161578063081812fc1461017f578063095ea7b3146101af57806312ba91ea146101cb575b600080fd5b61014b6004803603810190610146919061211a565b6103f7565b6040516101589190612604565b60405180910390f35b6101696104d9565b604051610176919061261f565b60405180910390f35b6101996004803603810190610194919061216c565b61056b565b6040516101a6919061259d565b60405180910390f35b6101c960048036038101906101c49190611fcc565b6105f0565b005b6101d3610708565b6040516101e09190612863565b60405180910390f35b61020360048036038101906101fe9190611ec6565b610719565b005b61021f600480360381019061021a9190612088565b610779565b005b61023b60048036038101906102369190611ec6565b6107f2565b005b6102576004803603810190610252919061216c565b610812565b604051610264919061259d565b60405180910390f35b61028760048036038101906102829190611e61565b6108c4565b6040516102949190612863565b60405180910390f35b6102a561097c565b005b6102af610a04565b6040516102bc919061259d565b60405180910390f35b6102cd610a2e565b6040516102da919061261f565b60405180910390f35b6102fd60048036038101906102f89190611f90565b610ac0565b005b61031960048036038101906103149190611f15565b610ad6565b005b61033560048036038101906103309190612008565b610b38565b6040516103429190612863565b60405180910390f35b6103656004803603810190610360919061216c565b610bb6565b604051610372919061261f565b60405180910390f35b61039560048036038101906103909190611e8a565b610c5d565b6040516103a29190612604565b60405180910390f35b6103c560048036038101906103c09190611e61565b610cf1565b005b6103e160048036038101906103dc919061216c565b610de9565b6040516103ee9190612841565b60405180910390f35b60007f80ac58cd000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614806104c257507f5b5e139f000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916145b806104d257506104d182610e8f565b5b9050919050565b6060600080546104e890612acb565b80601f016020809104026020016040519081016040528092919081815260200182805461051490612acb565b80156105615780601f1061053657610100808354040283529160200191610561565b820191906000526020600020905b81548152906001019060200180831161054457829003601f168201915b5050505050905090565b600061057682610ef9565b6105b5576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016105ac906127a1565b60405180910390fd5b6004600083815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050919050565b60006105fb82610812565b90508073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16141561066c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161066390612801565b60405180910390fd5b8073ffffffffffffffffffffffffffffffffffffffff1661068b610f65565b73ffffffffffffffffffffffffffffffffffffffff1614806106ba57506106b9816106b4610f65565b610c5d565b5b6106f9576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016106f090612721565b60405180910390fd5b6107038383610f6d565b505050565b60006107146007611026565b905090565b61072a610724610f65565b82611034565b610769576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161076090612821565b60405180910390fd5b610774838383611112565b505050565b61078285611379565b61079d338787604051806020016040528060008152506113b2565b6107ea858585858580806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f8201169050808301925050505050505061140e565b505050505050565b61080d83838360405180602001604052806000815250610ad6565b505050565b6000806002600084815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156108bb576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016108b290612761565b60405180910390fd5b80915050919050565b60008073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff161415610935576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161092c90612741565b60405180910390fd5b600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b610984610f65565b73ffffffffffffffffffffffffffffffffffffffff166109a2610a04565b73ffffffffffffffffffffffffffffffffffffffff16146109f8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109ef906127c1565b60405180910390fd5b610a026000611476565b565b6000600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b606060018054610a3d90612acb565b80601f0160208091040260200160405190810160405280929190818152602001828054610a6990612acb565b8015610ab65780601f10610a8b57610100808354040283529160200191610ab6565b820191906000526020600020905b815481529060010190602001808311610a9957829003601f168201915b5050505050905090565b610ad2610acb610f65565b838361153c565b5050565b610ae7610ae1610f65565b83611034565b610b26576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b1d90612821565b60405180910390fd5b610b32848484846113b2565b50505050565b6000610b4460076116a9565b6000610b506007611026565b9050610b5c87826116bf565b610ba9818787878780806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f8201169050808301925050505050505061140e565b8091505095945050505050565b6060610bc182610ef9565b610c00576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610bf7906127e1565b60405180910390fd5b6000610c0a6116dd565b90506000815111610c2a5760405180602001604052806000815250610c55565b80610c34846116f4565b604051602001610c45929190612579565b6040516020818303038152906040525b915050919050565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16905092915050565b610cf9610f65565b73ffffffffffffffffffffffffffffffffffffffff16610d17610a04565b73ffffffffffffffffffffffffffffffffffffffff1614610d6d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610d64906127c1565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161415610ddd576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610dd490612661565b60405180910390fd5b610de681611476565b50565b610df1611c9a565b60086000838152602001908152602001600020604051806060016040529081600082015481526020016001820154815260200160028201805480602002602001604051908101604052809291908181526020018280548015610e7257602002820191906000526020600020905b815481526020019060010190808311610e5e575b5050505050815250509050919050565b6000816000018190555050565b60007f01ffc9a7000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916149050919050565b60008073ffffffffffffffffffffffffffffffffffffffff166002600084815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614159050919050565b600033905090565b816004600083815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550808273ffffffffffffffffffffffffffffffffffffffff16610fe083610812565b73ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45050565b600081600001549050919050565b600061103f82610ef9565b61107e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161107590612701565b60405180910390fd5b600061108983610812565b90508073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1614806110cb57506110ca8185610c5d565b5b8061110957508373ffffffffffffffffffffffffffffffffffffffff166110f18461056b565b73ffffffffffffffffffffffffffffffffffffffff16145b91505092915050565b8273ffffffffffffffffffffffffffffffffffffffff1661113282610812565b73ffffffffffffffffffffffffffffffffffffffff1614611188576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161117f90612681565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156111f8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016111ef906126c1565b60405180910390fd5b6112038383836118a1565b61120e600082610f6d565b6001600360008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825461125e91906129d7565b925050819055506001600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282546112b59190612950565b92505081905550816002600083815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550808273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a46113748383836118a6565b505050565b6008600082815260200190815260200160002060008082016000905560018201600090556002820160006113ad9190611cbb565b505050565b6113bd848484611112565b6113c9848484846118ab565b611408576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016113ff90612641565b60405180910390fd5b50505050565b604051806060016040528084815260200183815260200182815250600860008681526020019081526020016000206000820151816000015560208201518160010155604082015181600201908051906020019061146c929190611cdc565b5090505050505050565b6000600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1614156115ab576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016115a2906126e1565b60405180910390fd5b80600560008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c318360405161169c9190612604565b60405180910390a3505050565b6001816000016000828254019250508190555050565b6116d9828260405180602001604052806000815250611a42565b5050565b606060405180602001604052806000815250905090565b6060600082141561173c576040518060400160405280600181526020017f3000000000000000000000000000000000000000000000000000000000000000815250905061189c565b600082905060005b6000821461176e57808061175790612b2e565b915050600a8261176791906129a6565b9150611744565b60008167ffffffffffffffff8111156117b0577f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6040519080825280601f01601f1916602001820160405280156117e25781602001600182028036833780820191505090505b5090505b60008514611895576001826117fb91906129d7565b9150600a8561180a9190612b77565b60306118169190612950565b60f81b818381518110611852577f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350600a8561188e91906129a6565b94506117e6565b8093505050505b919050565b505050565b505050565b60006118cc8473ffffffffffffffffffffffffffffffffffffffff16611a9d565b15611a35578373ffffffffffffffffffffffffffffffffffffffff1663150b7a026118f5610f65565b8786866040518563ffffffff1660e01b815260040161191794939291906125b8565b602060405180830381600087803b15801561193157600080fd5b505af192505050801561196257506040513d601f19601f8201168201806040525081019061195f9190612143565b60015b6119e5573d8060008114611992576040519150601f19603f3d011682016040523d82523d6000602084013e611997565b606091505b506000815114156119dd576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016119d490612641565b60405180910390fd5b805181602001fd5b63150b7a0260e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614915050611a3a565b600190505b949350505050565b611a4c8383611ac0565b611a5960008484846118ab565b611a98576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611a8f90612641565b60405180910390fd5b505050565b6000808273ffffffffffffffffffffffffffffffffffffffff163b119050919050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff161415611b30576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611b2790612781565b60405180910390fd5b611b3981610ef9565b15611b79576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611b70906126a1565b60405180910390fd5b611b85600083836118a1565b6001600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254611bd59190612950565b92505081905550816002600083815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550808273ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a4611c96600083836118a6565b5050565b60405180606001604052806000815260200160008152602001606081525090565b5080546000825590600052602060002090810190611cd99190611d29565b50565b828054828255906000526020600020908101928215611d18579160200282015b82811115611d17578251825591602001919060010190611cfc565b5b509050611d259190611d29565b5090565b5b80821115611d42576000816000905550600101611d2a565b5090565b6000611d59611d54846128a3565b61287e565b905082815260208101848484011115611d7157600080fd5b611d7c848285612a89565b509392505050565b600081359050611d93816130cd565b92915050565b60008083601f840112611dab57600080fd5b8235905067ffffffffffffffff811115611dc457600080fd5b602083019150836020820283011115611ddc57600080fd5b9250929050565b600081359050611df2816130e4565b92915050565b600081359050611e07816130fb565b92915050565b600081519050611e1c816130fb565b92915050565b600082601f830112611e3357600080fd5b8135611e43848260208601611d46565b91505092915050565b600081359050611e5b81613112565b92915050565b600060208284031215611e7357600080fd5b6000611e8184828501611d84565b91505092915050565b60008060408385031215611e9d57600080fd5b6000611eab85828601611d84565b9250506020611ebc85828601611d84565b9150509250929050565b600080600060608486031215611edb57600080fd5b6000611ee986828701611d84565b9350506020611efa86828701611d84565b9250506040611f0b86828701611e4c565b9150509250925092565b60008060008060808587031215611f2b57600080fd5b6000611f3987828801611d84565b9450506020611f4a87828801611d84565b9350506040611f5b87828801611e4c565b925050606085013567ffffffffffffffff811115611f7857600080fd5b611f8487828801611e22565b91505092959194509250565b60008060408385031215611fa357600080fd5b6000611fb185828601611d84565b9250506020611fc285828601611de3565b9150509250929050565b60008060408385031215611fdf57600080fd5b6000611fed85828601611d84565b9250506020611ffe85828601611e4c565b9150509250929050565b60008060008060006080868803121561202057600080fd5b600061202e88828901611d84565b955050602061203f88828901611e4c565b945050604061205088828901611e4c565b935050606086013567ffffffffffffffff81111561206d57600080fd5b61207988828901611d99565b92509250509295509295909350565b60008060008060008060a087890312156120a157600080fd5b60006120af89828a01611d84565b96505060206120c089828a01611e4c565b95505060406120d189828a01611e4c565b94505060606120e289828a01611e4c565b935050608087013567ffffffffffffffff8111156120ff57600080fd5b61210b89828a01611d99565b92509250509295509295509295565b60006020828403121561212c57600080fd5b600061213a84828501611df8565b91505092915050565b60006020828403121561215557600080fd5b600061216384828501611e0d565b91505092915050565b60006020828403121561217e57600080fd5b600061218c84828501611e4c565b91505092915050565b60006121a18383612262565b60208301905092915050565b6121b681612a0b565b82525050565b60006121c7826128e4565b6121d18185612912565b93506121dc836128d4565b8060005b8381101561220d5781516121f48882612195565b97506121ff83612905565b9250506001810190506121e0565b5085935050505092915050565b61222381612a1d565b82525050565b6000612234826128ef565b61223e8185612923565b935061224e818560208601612a98565b61225781612c64565b840191505092915050565b61226b81612a55565b82525050565b600061227c826128fa565b6122868185612934565b9350612296818560208601612a98565b61229f81612c64565b840191505092915050565b60006122b5826128fa565b6122bf8185612945565b93506122cf818560208601612a98565b80840191505092915050565b60006122e8603283612934565b91506122f382612c75565b604082019050919050565b600061230b602683612934565b915061231682612cc4565b604082019050919050565b600061232e602583612934565b915061233982612d13565b604082019050919050565b6000612351601c83612934565b915061235c82612d62565b602082019050919050565b6000612374602483612934565b915061237f82612d8b565b604082019050919050565b6000612397601983612934565b91506123a282612dda565b602082019050919050565b60006123ba602c83612934565b91506123c582612e03565b604082019050919050565b60006123dd603883612934565b91506123e882612e52565b604082019050919050565b6000612400602a83612934565b915061240b82612ea1565b604082019050919050565b6000612423602983612934565b915061242e82612ef0565b604082019050919050565b6000612446602083612934565b915061245182612f3f565b602082019050919050565b6000612469602c83612934565b915061247482612f68565b604082019050919050565b600061248c602083612934565b915061249782612fb7565b602082019050919050565b60006124af602f83612934565b91506124ba82612fe0565b604082019050919050565b60006124d2602183612934565b91506124dd8261302f565b604082019050919050565b60006124f5603183612934565b91506125008261307e565b604082019050919050565b6000606083016000830151612523600086018261255b565b506020830151612536602086018261255b565b506040830151848203604086015261254e82826121bc565b9150508091505092915050565b61256481612a7f565b82525050565b61257381612a7f565b82525050565b600061258582856122aa565b915061259182846122aa565b91508190509392505050565b60006020820190506125b260008301846121ad565b92915050565b60006080820190506125cd60008301876121ad565b6125da60208301866121ad565b6125e7604083018561256a565b81810360608301526125f98184612229565b905095945050505050565b6000602082019050612619600083018461221a565b92915050565b600060208201905081810360008301526126398184612271565b905092915050565b6000602082019050818103600083015261265a816122db565b9050919050565b6000602082019050818103600083015261267a816122fe565b9050919050565b6000602082019050818103600083015261269a81612321565b9050919050565b600060208201905081810360008301526126ba81612344565b9050919050565b600060208201905081810360008301526126da81612367565b9050919050565b600060208201905081810360008301526126fa8161238a565b9050919050565b6000602082019050818103600083015261271a816123ad565b9050919050565b6000602082019050818103600083015261273a816123d0565b9050919050565b6000602082019050818103600083015261275a816123f3565b9050919050565b6000602082019050818103600083015261277a81612416565b9050919050565b6000602082019050818103600083015261279a81612439565b9050919050565b600060208201905081810360008301526127ba8161245c565b9050919050565b600060208201905081810360008301526127da8161247f565b9050919050565b600060208201905081810360008301526127fa816124a2565b9050919050565b6000602082019050818103600083015261281a816124c5565b9050919050565b6000602082019050818103600083015261283a816124e8565b9050919050565b6000602082019050818103600083015261285b818461250b565b905092915050565b6000602082019050612878600083018461256a565b92915050565b6000612888612899565b90506128948282612afd565b919050565b6000604051905090565b600067ffffffffffffffff8211156128be576128bd612c35565b5b6128c782612c64565b9050602081019050919050565b6000819050602082019050919050565b600081519050919050565b600081519050919050565b600081519050919050565b6000602082019050919050565b600082825260208201905092915050565b600082825260208201905092915050565b600082825260208201905092915050565b600081905092915050565b600061295b82612a7f565b915061296683612a7f565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0382111561299b5761299a612ba8565b5b828201905092915050565b60006129b182612a7f565b91506129bc83612a7f565b9250826129cc576129cb612bd7565b5b828204905092915050565b60006129e282612a7f565b91506129ed83612a7f565b925082821015612a00576129ff612ba8565b5b828203905092915050565b6000612a1682612a5f565b9050919050565b60008115159050919050565b60007fffffffff0000000000000000000000000000000000000000000000000000000082169050919050565b6000819050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b82818337600083830152505050565b60005b83811015612ab6578082015181840152602081019050612a9b565b83811115612ac5576000848401525b50505050565b60006002820490506001821680612ae357607f821691505b60208210811415612af757612af6612c06565b5b50919050565b612b0682612c64565b810181811067ffffffffffffffff82111715612b2557612b24612c35565b5b80604052505050565b6000612b3982612a7f565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff821415612b6c57612b6b612ba8565b5b600182019050919050565b6000612b8282612a7f565b9150612b8d83612a7f565b925082612b9d57612b9c612bd7565b5b828206905092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b7f4552433732313a207472616e7366657220746f206e6f6e20455243373231526560008201527f63656976657220696d706c656d656e7465720000000000000000000000000000602082015250565b7f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160008201527f6464726573730000000000000000000000000000000000000000000000000000602082015250565b7f4552433732313a207472616e736665722066726f6d20696e636f72726563742060008201527f6f776e6572000000000000000000000000000000000000000000000000000000602082015250565b7f4552433732313a20746f6b656e20616c7265616479206d696e74656400000000600082015250565b7f4552433732313a207472616e7366657220746f20746865207a65726f2061646460008201527f7265737300000000000000000000000000000000000000000000000000000000602082015250565b7f4552433732313a20617070726f766520746f2063616c6c657200000000000000600082015250565b7f4552433732313a206f70657261746f7220717565727920666f72206e6f6e657860008201527f697374656e7420746f6b656e0000000000000000000000000000000000000000602082015250565b7f4552433732313a20617070726f76652063616c6c6572206973206e6f74206f7760008201527f6e6572206e6f7220617070726f76656420666f7220616c6c0000000000000000602082015250565b7f4552433732313a2062616c616e636520717565727920666f7220746865207a6560008201527f726f206164647265737300000000000000000000000000000000000000000000602082015250565b7f4552433732313a206f776e657220717565727920666f72206e6f6e657869737460008201527f656e7420746f6b656e0000000000000000000000000000000000000000000000602082015250565b7f4552433732313a206d696e7420746f20746865207a65726f2061646472657373600082015250565b7f4552433732313a20617070726f76656420717565727920666f72206e6f6e657860008201527f697374656e7420746f6b656e0000000000000000000000000000000000000000602082015250565b7f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572600082015250565b7f4552433732314d657461646174613a2055524920717565727920666f72206e6f60008201527f6e6578697374656e7420746f6b656e0000000000000000000000000000000000602082015250565b7f4552433732313a20617070726f76616c20746f2063757272656e74206f776e6560008201527f7200000000000000000000000000000000000000000000000000000000000000602082015250565b7f4552433732313a207472616e736665722063616c6c6572206973206e6f74206f60008201527f776e6572206e6f7220617070726f766564000000000000000000000000000000602082015250565b6130d681612a0b565b81146130e157600080fd5b50565b6130ed81612a1d565b81146130f857600080fd5b50565b61310481612a29565b811461310f57600080fd5b50565b61311b81612a7f565b811461312657600080fd5b5056fea264697066735822122081e1b8f3c434047d7e65f6864725d98ee6092d2de2fe0f2326082aa794696c0664736f6c63430008010033",
  "deployedBytecode": "0x608060405234801561001057600080fd5b506004361061012c5760003560e01c8063715018a6116100ad578063bb287ff511610071578063bb287ff51461031b578063c87b56dd1461034b578063e985e9c51461037b578063f2fde38b146103ab578063f9986088146103c75761012c565b8063715018a61461029d5780638da5cb5b146102a757806395d89b41146102c5578063a22cb465146102e3578063b88d4fde146102ff5761012c565b806323b872dd116100f457806323b872dd146101e957806341265c411461020557806342842e0e146102215780636352211e1461023d57806370a082311461026d5761012c565b806301ffc9a71461013157806306fdde0314610161578063081812fc1461017f578063095ea7b3146101af57806312ba91ea146101cb575b600080fd5b61014b6004803603810190610146919061211a565b6103f7565b6040516101589190612604565b60405180910390f35b6101696104d9565b604051610176919061261f565b60405180910390f35b6101996004803603810190610194919061216c565b61056b565b6040516101a6919061259d565b60405180910390f35b6101c960048036038101906101c49190611fcc565b6105f0565b005b6101d3610708565b6040516101e09190612863565b60405180910390f35b61020360048036038101906101fe9190611ec6565b610719565b005b61021f600480360381019061021a9190612088565b610779565b005b61023b60048036038101906102369190611ec6565b6107f2565b005b6102576004803603810190610252919061216c565b610812565b604051610264919061259d565b60405180910390f35b61028760048036038101906102829190611e61565b6108c4565b6040516102949190612863565b60405180910390f35b6102a561097c565b005b6102af610a04565b6040516102bc919061259d565b60405180910390f35b6102cd610a2e565b6040516102da919061261f565b60405180910390f35b6102fd60048036038101906102f89190611f90565b610ac0565b005b61031960048036038101906103149190611f15565b610ad6565b005b61033560048036038101906103309190612008565b610b38565b6040516103429190612863565b60405180910390f35b6103656004803603810190610360919061216c565b610bb6565b604051610372919061261f565b60405180910390f35b61039560048036038101906103909190611e8a565b610c5d565b6040516103a29190612604565b60405180910390f35b6103c560048036038101906103c09190611e61565b610cf1565b005b6103e160048036038101906103dc919061216c565b610de9565b6040516103ee9190612841565b60405180910390f35b60007f80ac58cd000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614806104c257507f5b5e139f000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916145b806104d257506104d182610e8f565b5b9050919050565b6060600080546104e890612acb565b80601f016020809104026020016040519081016040528092919081815260200182805461051490612acb565b80156105615780601f1061053657610100808354040283529160200191610561565b820191906000526020600020905b81548152906001019060200180831161054457829003601f168201915b5050505050905090565b600061057682610ef9565b6105b5576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016105ac906127a1565b60405180910390fd5b6004600083815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050919050565b60006105fb82610812565b90508073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16141561066c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161066390612801565b60405180910390fd5b8073ffffffffffffffffffffffffffffffffffffffff1661068b610f65565b73ffffffffffffffffffffffffffffffffffffffff1614806106ba57506106b9816106b4610f65565b610c5d565b5b6106f9576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016106f090612721565b60405180910390fd5b6107038383610f6d565b505050565b60006107146007611026565b905090565b61072a610724610f65565b82611034565b610769576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161076090612821565b60405180910390fd5b610774838383611112565b505050565b61078285611379565b61079d338787604051806020016040528060008152506113b2565b6107ea858585858580806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f8201169050808301925050505050505061140e565b505050505050565b61080d83838360405180602001604052806000815250610ad6565b505050565b6000806002600084815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156108bb576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016108b290612761565b60405180910390fd5b80915050919050565b60008073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff161415610935576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161092c90612741565b60405180910390fd5b600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b610984610f65565b73ffffffffffffffffffffffffffffffffffffffff166109a2610a04565b73ffffffffffffffffffffffffffffffffffffffff16146109f8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109ef906127c1565b60405180910390fd5b610a026000611476565b565b6000600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b606060018054610a3d90612acb565b80601f0160208091040260200160405190810160405280929190818152602001828054610a6990612acb565b8015610ab65780601f10610a8b57610100808354040283529160200191610ab6565b820191906000526020600020905b815481529060010190602001808311610a9957829003601f168201915b5050505050905090565b610ad2610acb610f65565b838361153c565b5050565b610ae7610ae1610f65565b83611034565b610b26576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b1d90612821565b60405180910390fd5b610b32848484846113b2565b50505050565b6000610b4460076116a9565b6000610b506007611026565b9050610b5c87826116bf565b610ba9818787878780806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f8201169050808301925050505050505061140e565b8091505095945050505050565b6060610bc182610ef9565b610c00576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610bf7906127e1565b60405180910390fd5b6000610c0a6116dd565b90506000815111610c2a5760405180602001604052806000815250610c55565b80610c34846116f4565b604051602001610c45929190612579565b6040516020818303038152906040525b915050919050565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16905092915050565b610cf9610f65565b73ffffffffffffffffffffffffffffffffffffffff16610d17610a04565b73ffffffffffffffffffffffffffffffffffffffff1614610d6d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610d64906127c1565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161415610ddd576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610dd490612661565b60405180910390fd5b610de681611476565b50565b610df1611c9a565b60086000838152602001908152602001600020604051806060016040529081600082015481526020016001820154815260200160028201805480602002602001604051908101604052809291908181526020018280548015610e7257602002820191906000526020600020905b815481526020019060010190808311610e5e575b5050505050815250509050919050565b6000816000018190555050565b60007f01ffc9a7000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916149050919050565b60008073ffffffffffffffffffffffffffffffffffffffff166002600084815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614159050919050565b600033905090565b816004600083815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550808273ffffffffffffffffffffffffffffffffffffffff16610fe083610812565b73ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45050565b600081600001549050919050565b600061103f82610ef9565b61107e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161107590612701565b60405180910390fd5b600061108983610812565b90508073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1614806110cb57506110ca8185610c5d565b5b8061110957508373ffffffffffffffffffffffffffffffffffffffff166110f18461056b565b73ffffffffffffffffffffffffffffffffffffffff16145b91505092915050565b8273ffffffffffffffffffffffffffffffffffffffff1661113282610812565b73ffffffffffffffffffffffffffffffffffffffff1614611188576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161117f90612681565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156111f8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016111ef906126c1565b60405180910390fd5b6112038383836118a1565b61120e600082610f6d565b6001600360008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825461125e91906129d7565b925050819055506001600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282546112b59190612950565b92505081905550816002600083815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550808273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a46113748383836118a6565b505050565b6008600082815260200190815260200160002060008082016000905560018201600090556002820160006113ad9190611cbb565b505050565b6113bd848484611112565b6113c9848484846118ab565b611408576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016113ff90612641565b60405180910390fd5b50505050565b604051806060016040528084815260200183815260200182815250600860008681526020019081526020016000206000820151816000015560208201518160010155604082015181600201908051906020019061146c929190611cdc565b5090505050505050565b6000600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1614156115ab576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016115a2906126e1565b60405180910390fd5b80600560008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c318360405161169c9190612604565b60405180910390a3505050565b6001816000016000828254019250508190555050565b6116d9828260405180602001604052806000815250611a42565b5050565b606060405180602001604052806000815250905090565b6060600082141561173c576040518060400160405280600181526020017f3000000000000000000000000000000000000000000000000000000000000000815250905061189c565b600082905060005b6000821461176e57808061175790612b2e565b915050600a8261176791906129a6565b9150611744565b60008167ffffffffffffffff8111156117b0577f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6040519080825280601f01601f1916602001820160405280156117e25781602001600182028036833780820191505090505b5090505b60008514611895576001826117fb91906129d7565b9150600a8561180a9190612b77565b60306118169190612950565b60f81b818381518110611852577f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350600a8561188e91906129a6565b94506117e6565b8093505050505b919050565b505050565b505050565b60006118cc8473ffffffffffffffffffffffffffffffffffffffff16611a9d565b15611a35578373ffffffffffffffffffffffffffffffffffffffff1663150b7a026118f5610f65565b8786866040518563ffffffff1660e01b815260040161191794939291906125b8565b602060405180830381600087803b15801561193157600080fd5b505af192505050801561196257506040513d601f19601f8201168201806040525081019061195f9190612143565b60015b6119e5573d8060008114611992576040519150601f19603f3d011682016040523d82523d6000602084013e611997565b606091505b506000815114156119dd576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016119d490612641565b60405180910390fd5b805181602001fd5b63150b7a0260e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614915050611a3a565b600190505b949350505050565b611a4c8383611ac0565b611a5960008484846118ab565b611a98576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611a8f90612641565b60405180910390fd5b505050565b6000808273ffffffffffffffffffffffffffffffffffffffff163b119050919050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff161415611b30576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611b2790612781565b60405180910390fd5b611b3981610ef9565b15611b79576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611b70906126a1565b60405180910390fd5b611b85600083836118a1565b6001600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254611bd59190612950565b92505081905550816002600083815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550808273ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a4611c96600083836118a6565b5050565b60405180606001604052806000815260200160008152602001606081525090565b5080546000825590600052602060002090810190611cd99190611d29565b50565b828054828255906000526020600020908101928215611d18579160200282015b82811115611d17578251825591602001919060010190611cfc565b5b509050611d259190611d29565b5090565b5b80821115611d42576000816000905550600101611d2a565b5090565b6000611d59611d54846128a3565b61287e565b905082815260208101848484011115611d7157600080fd5b611d7c848285612a89565b509392505050565b600081359050611d93816130cd565b92915050565b60008083601f840112611dab57600080fd5b8235905067ffffffffffffffff811115611dc457600080fd5b602083019150836020820283011115611ddc57600080fd5b9250929050565b600081359050611df2816130e4565b92915050565b600081359050611e07816130fb565b92915050565b600081519050611e1c816130fb565b92915050565b600082601f830112611e3357600080fd5b8135611e43848260208601611d46565b91505092915050565b600081359050611e5b81613112565b92915050565b600060208284031215611e7357600080fd5b6000611e8184828501611d84565b91505092915050565b60008060408385031215611e9d57600080fd5b6000611eab85828601611d84565b9250506020611ebc85828601611d84565b9150509250929050565b600080600060608486031215611edb57600080fd5b6000611ee986828701611d84565b9350506020611efa86828701611d84565b9250506040611f0b86828701611e4c565b9150509250925092565b60008060008060808587031215611f2b57600080fd5b6000611f3987828801611d84565b9450506020611f4a87828801611d84565b9350506040611f5b87828801611e4c565b925050606085013567ffffffffffffffff811115611f7857600080fd5b611f8487828801611e22565b91505092959194509250565b60008060408385031215611fa357600080fd5b6000611fb185828601611d84565b9250506020611fc285828601611de3565b9150509250929050565b60008060408385031215611fdf57600080fd5b6000611fed85828601611d84565b9250506020611ffe85828601611e4c565b9150509250929050565b60008060008060006080868803121561202057600080fd5b600061202e88828901611d84565b955050602061203f88828901611e4c565b945050604061205088828901611e4c565b935050606086013567ffffffffffffffff81111561206d57600080fd5b61207988828901611d99565b92509250509295509295909350565b60008060008060008060a087890312156120a157600080fd5b60006120af89828a01611d84565b96505060206120c089828a01611e4c565b95505060406120d189828a01611e4c565b94505060606120e289828a01611e4c565b935050608087013567ffffffffffffffff8111156120ff57600080fd5b61210b89828a01611d99565b92509250509295509295509295565b60006020828403121561212c57600080fd5b600061213a84828501611df8565b91505092915050565b60006020828403121561215557600080fd5b600061216384828501611e0d565b91505092915050565b60006020828403121561217e57600080fd5b600061218c84828501611e4c565b91505092915050565b60006121a18383612262565b60208301905092915050565b6121b681612a0b565b82525050565b60006121c7826128e4565b6121d18185612912565b93506121dc836128d4565b8060005b8381101561220d5781516121f48882612195565b97506121ff83612905565b9250506001810190506121e0565b5085935050505092915050565b61222381612a1d565b82525050565b6000612234826128ef565b61223e8185612923565b935061224e818560208601612a98565b61225781612c64565b840191505092915050565b61226b81612a55565b82525050565b600061227c826128fa565b6122868185612934565b9350612296818560208601612a98565b61229f81612c64565b840191505092915050565b60006122b5826128fa565b6122bf8185612945565b93506122cf818560208601612a98565b80840191505092915050565b60006122e8603283612934565b91506122f382612c75565b604082019050919050565b600061230b602683612934565b915061231682612cc4565b604082019050919050565b600061232e602583612934565b915061233982612d13565b604082019050919050565b6000612351601c83612934565b915061235c82612d62565b602082019050919050565b6000612374602483612934565b915061237f82612d8b565b604082019050919050565b6000612397601983612934565b91506123a282612dda565b602082019050919050565b60006123ba602c83612934565b91506123c582612e03565b604082019050919050565b60006123dd603883612934565b91506123e882612e52565b604082019050919050565b6000612400602a83612934565b915061240b82612ea1565b604082019050919050565b6000612423602983612934565b915061242e82612ef0565b604082019050919050565b6000612446602083612934565b915061245182612f3f565b602082019050919050565b6000612469602c83612934565b915061247482612f68565b604082019050919050565b600061248c602083612934565b915061249782612fb7565b602082019050919050565b60006124af602f83612934565b91506124ba82612fe0565b604082019050919050565b60006124d2602183612934565b91506124dd8261302f565b604082019050919050565b60006124f5603183612934565b91506125008261307e565b604082019050919050565b6000606083016000830151612523600086018261255b565b506020830151612536602086018261255b565b506040830151848203604086015261254e82826121bc565b9150508091505092915050565b61256481612a7f565b82525050565b61257381612a7f565b82525050565b600061258582856122aa565b915061259182846122aa565b91508190509392505050565b60006020820190506125b260008301846121ad565b92915050565b60006080820190506125cd60008301876121ad565b6125da60208301866121ad565b6125e7604083018561256a565b81810360608301526125f98184612229565b905095945050505050565b6000602082019050612619600083018461221a565b92915050565b600060208201905081810360008301526126398184612271565b905092915050565b6000602082019050818103600083015261265a816122db565b9050919050565b6000602082019050818103600083015261267a816122fe565b9050919050565b6000602082019050818103600083015261269a81612321565b9050919050565b600060208201905081810360008301526126ba81612344565b9050919050565b600060208201905081810360008301526126da81612367565b9050919050565b600060208201905081810360008301526126fa8161238a565b9050919050565b6000602082019050818103600083015261271a816123ad565b9050919050565b6000602082019050818103600083015261273a816123d0565b9050919050565b6000602082019050818103600083015261275a816123f3565b9050919050565b6000602082019050818103600083015261277a81612416565b9050919050565b6000602082019050818103600083015261279a81612439565b9050919050565b600060208201905081810360008301526127ba8161245c565b9050919050565b600060208201905081810360008301526127da8161247f565b9050919050565b600060208201905081810360008301526127fa816124a2565b9050919050565b6000602082019050818103600083015261281a816124c5565b9050919050565b6000602082019050818103600083015261283a816124e8565b9050919050565b6000602082019050818103600083015261285b818461250b565b905092915050565b6000602082019050612878600083018461256a565b92915050565b6000612888612899565b90506128948282612afd565b919050565b6000604051905090565b600067ffffffffffffffff8211156128be576128bd612c35565b5b6128c782612c64565b9050602081019050919050565b6000819050602082019050919050565b600081519050919050565b600081519050919050565b600081519050919050565b6000602082019050919050565b600082825260208201905092915050565b600082825260208201905092915050565b600082825260208201905092915050565b600081905092915050565b600061295b82612a7f565b915061296683612a7f565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0382111561299b5761299a612ba8565b5b828201905092915050565b60006129b182612a7f565b91506129bc83612a7f565b9250826129cc576129cb612bd7565b5b828204905092915050565b60006129e282612a7f565b91506129ed83612a7f565b925082821015612a00576129ff612ba8565b5b828203905092915050565b6000612a1682612a5f565b9050919050565b60008115159050919050565b60007fffffffff0000000000000000000000000000000000000000000000000000000082169050919050565b6000819050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b82818337600083830152505050565b60005b83811015612ab6578082015181840152602081019050612a9b565b83811115612ac5576000848401525b50505050565b60006002820490506001821680612ae357607f821691505b60208210811415612af757612af6612c06565b5b50919050565b612b0682612c64565b810181811067ffffffffffffffff82111715612b2557612b24612c35565b5b80604052505050565b6000612b3982612a7f565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff821415612b6c57612b6b612ba8565b5b600182019050919050565b6000612b8282612a7f565b9150612b8d83612a7f565b925082612b9d57612b9c612bd7565b5b828206905092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b7f4552433732313a207472616e7366657220746f206e6f6e20455243373231526560008201527f63656976657220696d706c656d656e7465720000000000000000000000000000602082015250565b7f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160008201527f6464726573730000000000000000000000000000000000000000000000000000602082015250565b7f4552433732313a207472616e736665722066726f6d20696e636f72726563742060008201527f6f776e6572000000000000000000000000000000000000000000000000000000602082015250565b7f4552433732313a20746f6b656e20616c7265616479206d696e74656400000000600082015250565b7f4552433732313a207472616e7366657220746f20746865207a65726f2061646460008201527f7265737300000000000000000000000000000000000000000000000000000000602082015250565b7f4552433732313a20617070726f766520746f2063616c6c657200000000000000600082015250565b7f4552433732313a206f70657261746f7220717565727920666f72206e6f6e657860008201527f697374656e7420746f6b656e0000000000000000000000000000000000000000602082015250565b7f4552433732313a20617070726f76652063616c6c6572206973206e6f74206f7760008201527f6e6572206e6f7220617070726f76656420666f7220616c6c0000000000000000602082015250565b7f4552433732313a2062616c616e636520717565727920666f7220746865207a6560008201527f726f206164647265737300000000000000000000000000000000000000000000602082015250565b7f4552433732313a206f776e657220717565727920666f72206e6f6e657869737460008201527f656e7420746f6b656e0000000000000000000000000000000000000000000000602082015250565b7f4552433732313a206d696e7420746f20746865207a65726f2061646472657373600082015250565b7f4552433732313a20617070726f76656420717565727920666f72206e6f6e657860008201527f697374656e7420746f6b656e0000000000000000000000000000000000000000602082015250565b7f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572600082015250565b7f4552433732314d657461646174613a2055524920717565727920666f72206e6f60008201527f6e6578697374656e7420746f6b656e0000000000000000000000000000000000602082015250565b7f4552433732313a20617070726f76616c20746f2063757272656e74206f776e6560008201527f7200000000000000000000000000000000000000000000000000000000000000602082015250565b7f4552433732313a207472616e736665722063616c6c6572206973206e6f74206f60008201527f776e6572206e6f7220617070726f766564000000000000000000000000000000602082015250565b6130d681612a0b565b81146130e157600080fd5b50565b6130ed81612a1d565b81146130f857600080fd5b50565b61310481612a29565b811461310f57600080fd5b50565b61311b81612a7f565b811461312657600080fd5b5056fea264697066735822122081e1b8f3c434047d7e65f6864725d98ee6092d2de2fe0f2326082aa794696c0664736f6c63430008010033",
  "immutableReferences": {},
  "generatedSources": [
    {
      "ast": {
        "nodeType": "YulBlock",
        "src": "0:516:12",
        "statements": [
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "58:269:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "68:22:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "data",
                        "nodeType": "YulIdentifier",
                        "src": "82:4:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "88:1:12",
                        "type": "",
                        "value": "2"
                      }
                    ],
                    "functionName": {
                      "name": "div",
                      "nodeType": "YulIdentifier",
                      "src": "78:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "78:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "length",
                      "nodeType": "YulIdentifier",
                      "src": "68:6:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "99:38:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "data",
                        "nodeType": "YulIdentifier",
                        "src": "129:4:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "135:1:12",
                        "type": "",
                        "value": "1"
                      }
                    ],
                    "functionName": {
                      "name": "and",
                      "nodeType": "YulIdentifier",
                      "src": "125:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "125:12:12"
                  },
                  "variables": [
                    {
                      "name": "outOfPlaceEncoding",
                      "nodeType": "YulTypedName",
                      "src": "103:18:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "176:51:12",
                    "statements": [
                      {
                        "nodeType": "YulAssignment",
                        "src": "190:27:12",
                        "value": {
                          "arguments": [
                            {
                              "name": "length",
                              "nodeType": "YulIdentifier",
                              "src": "204:6:12"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "212:4:12",
                              "type": "",
                              "value": "0x7f"
                            }
                          ],
                          "functionName": {
                            "name": "and",
                            "nodeType": "YulIdentifier",
                            "src": "200:3:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "200:17:12"
                        },
                        "variableNames": [
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "190:6:12"
                          }
                        ]
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "outOfPlaceEncoding",
                        "nodeType": "YulIdentifier",
                        "src": "156:18:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "149:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "149:26:12"
                  },
                  "nodeType": "YulIf",
                  "src": "146:2:12"
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "279:42:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x22",
                            "nodeType": "YulIdentifier",
                            "src": "293:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "293:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "293:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "outOfPlaceEncoding",
                        "nodeType": "YulIdentifier",
                        "src": "243:18:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "266:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "274:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "lt",
                          "nodeType": "YulIdentifier",
                          "src": "263:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "263:14:12"
                      }
                    ],
                    "functionName": {
                      "name": "eq",
                      "nodeType": "YulIdentifier",
                      "src": "240:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "240:38:12"
                  },
                  "nodeType": "YulIf",
                  "src": "237:2:12"
                }
              ]
            },
            "name": "extract_byte_array_length",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "data",
                "nodeType": "YulTypedName",
                "src": "42:4:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "51:6:12",
                "type": ""
              }
            ],
            "src": "7:320:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "361:152:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "378:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "381:77:12",
                        "type": "",
                        "value": "35408467139433450592217433187231851964531694900788300625387963629091585785856"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "371:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "371:88:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "371:88:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "475:1:12",
                        "type": "",
                        "value": "4"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "478:4:12",
                        "type": "",
                        "value": "0x22"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "468:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "468:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "468:15:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "499:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "502:4:12",
                        "type": "",
                        "value": "0x24"
                      }
                    ],
                    "functionName": {
                      "name": "revert",
                      "nodeType": "YulIdentifier",
                      "src": "492:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "492:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "492:15:12"
                }
              ]
            },
            "name": "panic_error_0x22",
            "nodeType": "YulFunctionDefinition",
            "src": "333:180:12"
          }
        ]
      },
      "contents": "{\n\n    function extract_byte_array_length(data) -> length {\n        length := div(data, 2)\n        let outOfPlaceEncoding := and(data, 1)\n        if iszero(outOfPlaceEncoding) {\n            length := and(length, 0x7f)\n        }\n\n        if eq(outOfPlaceEncoding, lt(length, 32)) {\n            panic_error_0x22()\n        }\n    }\n\n    function panic_error_0x22() {\n        mstore(0, 35408467139433450592217433187231851964531694900788300625387963629091585785856)\n        mstore(4, 0x22)\n        revert(0, 0x24)\n    }\n\n}\n",
      "id": 12,
      "language": "Yul",
      "name": "#utility.yul"
    }
  ],
  "deployedGeneratedSources": [
    {
      "ast": {
        "nodeType": "YulBlock",
        "src": "0:35660:12",
        "statements": [
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "90:260:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "100:74:12",
                  "value": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "166:6:12"
                          }
                        ],
                        "functionName": {
                          "name": "array_allocation_size_t_bytes_memory_ptr",
                          "nodeType": "YulIdentifier",
                          "src": "125:40:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "125:48:12"
                      }
                    ],
                    "functionName": {
                      "name": "allocate_memory",
                      "nodeType": "YulIdentifier",
                      "src": "109:15:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "109:65:12"
                  },
                  "variableNames": [
                    {
                      "name": "array",
                      "nodeType": "YulIdentifier",
                      "src": "100:5:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "array",
                        "nodeType": "YulIdentifier",
                        "src": "190:5:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "197:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "183:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "183:21:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "183:21:12"
                },
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "213:27:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "array",
                        "nodeType": "YulIdentifier",
                        "src": "228:5:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "235:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "224:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "224:16:12"
                  },
                  "variables": [
                    {
                      "name": "dst",
                      "nodeType": "YulTypedName",
                      "src": "217:3:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "278:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "287:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "290:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "280:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "280:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "280:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "src",
                            "nodeType": "YulIdentifier",
                            "src": "259:3:12"
                          },
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "264:6:12"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "255:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "255:16:12"
                      },
                      {
                        "name": "end",
                        "nodeType": "YulIdentifier",
                        "src": "273:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "gt",
                      "nodeType": "YulIdentifier",
                      "src": "252:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "252:25:12"
                  },
                  "nodeType": "YulIf",
                  "src": "249:2:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "src",
                        "nodeType": "YulIdentifier",
                        "src": "327:3:12"
                      },
                      {
                        "name": "dst",
                        "nodeType": "YulIdentifier",
                        "src": "332:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "337:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "copy_calldata_to_memory",
                      "nodeType": "YulIdentifier",
                      "src": "303:23:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "303:41:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "303:41:12"
                }
              ]
            },
            "name": "abi_decode_available_length_t_bytes_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "src",
                "nodeType": "YulTypedName",
                "src": "63:3:12",
                "type": ""
              },
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "68:6:12",
                "type": ""
              },
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "76:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "array",
                "nodeType": "YulTypedName",
                "src": "84:5:12",
                "type": ""
              }
            ],
            "src": "7:343:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "408:87:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "418:29:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "offset",
                        "nodeType": "YulIdentifier",
                        "src": "440:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "calldataload",
                      "nodeType": "YulIdentifier",
                      "src": "427:12:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "427:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "value",
                      "nodeType": "YulIdentifier",
                      "src": "418:5:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "483:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "validator_revert_t_address",
                      "nodeType": "YulIdentifier",
                      "src": "456:26:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "456:33:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "456:33:12"
                }
              ]
            },
            "name": "abi_decode_t_address",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "offset",
                "nodeType": "YulTypedName",
                "src": "386:6:12",
                "type": ""
              },
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "394:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "402:5:12",
                "type": ""
              }
            ],
            "src": "356:139:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "606:277:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "655:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "664:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "667:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "657:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "657:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "657:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "634:6:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "642:4:12",
                                "type": "",
                                "value": "0x1f"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "630:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "630:17:12"
                          },
                          {
                            "name": "end",
                            "nodeType": "YulIdentifier",
                            "src": "649:3:12"
                          }
                        ],
                        "functionName": {
                          "name": "slt",
                          "nodeType": "YulIdentifier",
                          "src": "626:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "626:27:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "619:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "619:35:12"
                  },
                  "nodeType": "YulIf",
                  "src": "616:2:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "680:30:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "offset",
                        "nodeType": "YulIdentifier",
                        "src": "703:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "calldataload",
                      "nodeType": "YulIdentifier",
                      "src": "690:12:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "690:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "length",
                      "nodeType": "YulIdentifier",
                      "src": "680:6:12"
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "753:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "762:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "765:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "755:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "755:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "755:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "725:6:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "733:18:12",
                        "type": "",
                        "value": "0xffffffffffffffff"
                      }
                    ],
                    "functionName": {
                      "name": "gt",
                      "nodeType": "YulIdentifier",
                      "src": "722:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "722:30:12"
                  },
                  "nodeType": "YulIf",
                  "src": "719:2:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "778:29:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "offset",
                        "nodeType": "YulIdentifier",
                        "src": "794:6:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "802:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "790:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "790:17:12"
                  },
                  "variableNames": [
                    {
                      "name": "arrayPos",
                      "nodeType": "YulIdentifier",
                      "src": "778:8:12"
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "861:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "870:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "873:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "863:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "863:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "863:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "arrayPos",
                            "nodeType": "YulIdentifier",
                            "src": "826:8:12"
                          },
                          {
                            "arguments": [
                              {
                                "name": "length",
                                "nodeType": "YulIdentifier",
                                "src": "840:6:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "848:4:12",
                                "type": "",
                                "value": "0x20"
                              }
                            ],
                            "functionName": {
                              "name": "mul",
                              "nodeType": "YulIdentifier",
                              "src": "836:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "836:17:12"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "822:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "822:32:12"
                      },
                      {
                        "name": "end",
                        "nodeType": "YulIdentifier",
                        "src": "856:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "gt",
                      "nodeType": "YulIdentifier",
                      "src": "819:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "819:41:12"
                  },
                  "nodeType": "YulIf",
                  "src": "816:2:12"
                }
              ]
            },
            "name": "abi_decode_t_array$_t_int256_$dyn_calldata_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "offset",
                "nodeType": "YulTypedName",
                "src": "573:6:12",
                "type": ""
              },
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "581:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "arrayPos",
                "nodeType": "YulTypedName",
                "src": "589:8:12",
                "type": ""
              },
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "599:6:12",
                "type": ""
              }
            ],
            "src": "517:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "938:84:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "948:29:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "offset",
                        "nodeType": "YulIdentifier",
                        "src": "970:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "calldataload",
                      "nodeType": "YulIdentifier",
                      "src": "957:12:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "957:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "value",
                      "nodeType": "YulIdentifier",
                      "src": "948:5:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "1010:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "validator_revert_t_bool",
                      "nodeType": "YulIdentifier",
                      "src": "986:23:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "986:30:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "986:30:12"
                }
              ]
            },
            "name": "abi_decode_t_bool",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "offset",
                "nodeType": "YulTypedName",
                "src": "916:6:12",
                "type": ""
              },
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "924:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "932:5:12",
                "type": ""
              }
            ],
            "src": "889:133:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "1079:86:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "1089:29:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "offset",
                        "nodeType": "YulIdentifier",
                        "src": "1111:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "calldataload",
                      "nodeType": "YulIdentifier",
                      "src": "1098:12:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1098:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "value",
                      "nodeType": "YulIdentifier",
                      "src": "1089:5:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "1153:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "validator_revert_t_bytes4",
                      "nodeType": "YulIdentifier",
                      "src": "1127:25:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1127:32:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "1127:32:12"
                }
              ]
            },
            "name": "abi_decode_t_bytes4",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "offset",
                "nodeType": "YulTypedName",
                "src": "1057:6:12",
                "type": ""
              },
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "1065:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "1073:5:12",
                "type": ""
              }
            ],
            "src": "1028:137:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "1233:79:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "1243:22:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "offset",
                        "nodeType": "YulIdentifier",
                        "src": "1258:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "mload",
                      "nodeType": "YulIdentifier",
                      "src": "1252:5:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1252:13:12"
                  },
                  "variableNames": [
                    {
                      "name": "value",
                      "nodeType": "YulIdentifier",
                      "src": "1243:5:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "1300:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "validator_revert_t_bytes4",
                      "nodeType": "YulIdentifier",
                      "src": "1274:25:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1274:32:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "1274:32:12"
                }
              ]
            },
            "name": "abi_decode_t_bytes4_fromMemory",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "offset",
                "nodeType": "YulTypedName",
                "src": "1211:6:12",
                "type": ""
              },
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "1219:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "1227:5:12",
                "type": ""
              }
            ],
            "src": "1171:141:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "1392:210:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "1441:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "1450:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "1453:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "1443:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "1443:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "1443:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "1420:6:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "1428:4:12",
                                "type": "",
                                "value": "0x1f"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "1416:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "1416:17:12"
                          },
                          {
                            "name": "end",
                            "nodeType": "YulIdentifier",
                            "src": "1435:3:12"
                          }
                        ],
                        "functionName": {
                          "name": "slt",
                          "nodeType": "YulIdentifier",
                          "src": "1412:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "1412:27:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "1405:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1405:35:12"
                  },
                  "nodeType": "YulIf",
                  "src": "1402:2:12"
                },
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "1466:34:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "offset",
                        "nodeType": "YulIdentifier",
                        "src": "1493:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "calldataload",
                      "nodeType": "YulIdentifier",
                      "src": "1480:12:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1480:20:12"
                  },
                  "variables": [
                    {
                      "name": "length",
                      "nodeType": "YulTypedName",
                      "src": "1470:6:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "1509:87:12",
                  "value": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "offset",
                            "nodeType": "YulIdentifier",
                            "src": "1569:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "1577:4:12",
                            "type": "",
                            "value": "0x20"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "1565:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "1565:17:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "1584:6:12"
                      },
                      {
                        "name": "end",
                        "nodeType": "YulIdentifier",
                        "src": "1592:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_decode_available_length_t_bytes_memory_ptr",
                      "nodeType": "YulIdentifier",
                      "src": "1518:46:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1518:78:12"
                  },
                  "variableNames": [
                    {
                      "name": "array",
                      "nodeType": "YulIdentifier",
                      "src": "1509:5:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_t_bytes_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "offset",
                "nodeType": "YulTypedName",
                "src": "1370:6:12",
                "type": ""
              },
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "1378:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "array",
                "nodeType": "YulTypedName",
                "src": "1386:5:12",
                "type": ""
              }
            ],
            "src": "1331:271:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "1660:87:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "1670:29:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "offset",
                        "nodeType": "YulIdentifier",
                        "src": "1692:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "calldataload",
                      "nodeType": "YulIdentifier",
                      "src": "1679:12:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1679:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "value",
                      "nodeType": "YulIdentifier",
                      "src": "1670:5:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "1735:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "validator_revert_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "1708:26:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1708:33:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "1708:33:12"
                }
              ]
            },
            "name": "abi_decode_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "offset",
                "nodeType": "YulTypedName",
                "src": "1638:6:12",
                "type": ""
              },
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "1646:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "1654:5:12",
                "type": ""
              }
            ],
            "src": "1608:139:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "1819:196:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "1865:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "1874:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "1877:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "1867:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "1867:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "1867:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "1840:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "1849:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "1836:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "1836:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "1861:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "1832:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "1832:32:12"
                  },
                  "nodeType": "YulIf",
                  "src": "1829:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "1891:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "1906:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "1920:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "1910:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "1935:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "1970:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "1981:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "1966:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "1966:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "1990:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "1945:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "1945:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "1935:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_address",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "1789:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "1800:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "1812:6:12",
                "type": ""
              }
            ],
            "src": "1753:262:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "2104:324:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "2150:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "2159:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "2162:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "2152:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "2152:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "2152:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "2125:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "2134:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "2121:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "2121:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "2146:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "2117:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "2117:32:12"
                  },
                  "nodeType": "YulIf",
                  "src": "2114:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "2176:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "2191:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "2205:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "2195:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "2220:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "2255:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "2266:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "2251:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "2251:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "2275:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "2230:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "2230:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "2220:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "2303:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "2318:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "2332:2:12",
                        "type": "",
                        "value": "32"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "2322:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "2348:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "2383:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "2394:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "2379:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "2379:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "2403:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "2358:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "2358:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value1",
                          "nodeType": "YulIdentifier",
                          "src": "2348:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_addresst_address",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "2066:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "2077:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "2089:6:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "2097:6:12",
                "type": ""
              }
            ],
            "src": "2021:407:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "2534:452:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "2580:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "2589:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "2592:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "2582:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "2582:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "2582:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "2555:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "2564:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "2551:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "2551:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "2576:2:12",
                        "type": "",
                        "value": "96"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "2547:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "2547:32:12"
                  },
                  "nodeType": "YulIf",
                  "src": "2544:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "2606:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "2621:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "2635:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "2625:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "2650:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "2685:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "2696:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "2681:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "2681:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "2705:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "2660:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "2660:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "2650:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "2733:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "2748:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "2762:2:12",
                        "type": "",
                        "value": "32"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "2752:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "2778:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "2813:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "2824:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "2809:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "2809:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "2833:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "2788:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "2788:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value1",
                          "nodeType": "YulIdentifier",
                          "src": "2778:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "2861:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "2876:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "2890:2:12",
                        "type": "",
                        "value": "64"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "2880:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "2906:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "2941:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "2952:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "2937:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "2937:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "2961:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "2916:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "2916:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value2",
                          "nodeType": "YulIdentifier",
                          "src": "2906:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_addresst_addresst_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "2488:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "2499:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "2511:6:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "2519:6:12",
                "type": ""
              },
              {
                "name": "value2",
                "nodeType": "YulTypedName",
                "src": "2527:6:12",
                "type": ""
              }
            ],
            "src": "2434:552:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "3118:683:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "3165:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "3174:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "3177:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "3167:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "3167:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "3167:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "3139:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "3148:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "3135:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "3135:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "3160:3:12",
                        "type": "",
                        "value": "128"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "3131:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "3131:33:12"
                  },
                  "nodeType": "YulIf",
                  "src": "3128:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "3191:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "3206:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "3220:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "3210:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "3235:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "3270:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "3281:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "3266:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "3266:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "3290:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "3245:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "3245:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "3235:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "3318:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "3333:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "3347:2:12",
                        "type": "",
                        "value": "32"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "3337:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "3363:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "3398:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "3409:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "3394:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "3394:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "3418:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "3373:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "3373:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value1",
                          "nodeType": "YulIdentifier",
                          "src": "3363:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "3446:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "3461:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "3475:2:12",
                        "type": "",
                        "value": "64"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "3465:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "3491:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "3526:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "3537:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "3522:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "3522:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "3546:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "3501:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "3501:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value2",
                          "nodeType": "YulIdentifier",
                          "src": "3491:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "3574:220:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "3589:46:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "3620:9:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "3631:2:12",
                                "type": "",
                                "value": "96"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "3616:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "3616:18:12"
                          }
                        ],
                        "functionName": {
                          "name": "calldataload",
                          "nodeType": "YulIdentifier",
                          "src": "3603:12:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "3603:32:12"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "3593:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "body": {
                        "nodeType": "YulBlock",
                        "src": "3682:16:12",
                        "statements": [
                          {
                            "expression": {
                              "arguments": [
                                {
                                  "kind": "number",
                                  "nodeType": "YulLiteral",
                                  "src": "3691:1:12",
                                  "type": "",
                                  "value": "0"
                                },
                                {
                                  "kind": "number",
                                  "nodeType": "YulLiteral",
                                  "src": "3694:1:12",
                                  "type": "",
                                  "value": "0"
                                }
                              ],
                              "functionName": {
                                "name": "revert",
                                "nodeType": "YulIdentifier",
                                "src": "3684:6:12"
                              },
                              "nodeType": "YulFunctionCall",
                              "src": "3684:12:12"
                            },
                            "nodeType": "YulExpressionStatement",
                            "src": "3684:12:12"
                          }
                        ]
                      },
                      "condition": {
                        "arguments": [
                          {
                            "name": "offset",
                            "nodeType": "YulIdentifier",
                            "src": "3654:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "3662:18:12",
                            "type": "",
                            "value": "0xffffffffffffffff"
                          }
                        ],
                        "functionName": {
                          "name": "gt",
                          "nodeType": "YulIdentifier",
                          "src": "3651:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "3651:30:12"
                      },
                      "nodeType": "YulIf",
                      "src": "3648:2:12"
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "3712:72:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "3756:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "3767:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "3752:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "3752:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "3776:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_bytes_memory_ptr",
                          "nodeType": "YulIdentifier",
                          "src": "3722:29:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "3722:62:12"
                      },
                      "variableNames": [
                        {
                          "name": "value3",
                          "nodeType": "YulIdentifier",
                          "src": "3712:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_addresst_addresst_uint256t_bytes_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "3064:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "3075:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "3087:6:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "3095:6:12",
                "type": ""
              },
              {
                "name": "value2",
                "nodeType": "YulTypedName",
                "src": "3103:6:12",
                "type": ""
              },
              {
                "name": "value3",
                "nodeType": "YulTypedName",
                "src": "3111:6:12",
                "type": ""
              }
            ],
            "src": "2992:809:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "3887:321:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "3933:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "3942:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "3945:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "3935:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "3935:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "3935:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "3908:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "3917:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "3904:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "3904:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "3929:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "3900:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "3900:32:12"
                  },
                  "nodeType": "YulIf",
                  "src": "3897:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "3959:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "3974:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "3988:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "3978:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "4003:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "4038:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "4049:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "4034:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "4034:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "4058:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "4013:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "4013:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "4003:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "4086:115:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "4101:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "4115:2:12",
                        "type": "",
                        "value": "32"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "4105:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "4131:60:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "4163:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "4174:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "4159:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "4159:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "4183:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_bool",
                          "nodeType": "YulIdentifier",
                          "src": "4141:17:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "4141:50:12"
                      },
                      "variableNames": [
                        {
                          "name": "value1",
                          "nodeType": "YulIdentifier",
                          "src": "4131:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_addresst_bool",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "3849:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "3860:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "3872:6:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "3880:6:12",
                "type": ""
              }
            ],
            "src": "3807:401:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "4297:324:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "4343:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "4352:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "4355:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "4345:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "4345:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "4345:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "4318:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "4327:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "4314:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "4314:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "4339:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "4310:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "4310:32:12"
                  },
                  "nodeType": "YulIf",
                  "src": "4307:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "4369:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "4384:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "4398:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "4388:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "4413:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "4448:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "4459:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "4444:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "4444:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "4468:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "4423:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "4423:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "4413:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "4496:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "4511:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "4525:2:12",
                        "type": "",
                        "value": "32"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "4515:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "4541:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "4576:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "4587:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "4572:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "4572:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "4596:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "4551:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "4551:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value1",
                          "nodeType": "YulIdentifier",
                          "src": "4541:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_addresst_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "4259:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "4270:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "4282:6:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "4290:6:12",
                "type": ""
              }
            ],
            "src": "4214:407:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "4778:708:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "4825:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "4834:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "4837:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "4827:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "4827:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "4827:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "4799:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "4808:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "4795:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "4795:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "4820:3:12",
                        "type": "",
                        "value": "128"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "4791:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "4791:33:12"
                  },
                  "nodeType": "YulIf",
                  "src": "4788:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "4851:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "4866:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "4880:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "4870:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "4895:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "4930:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "4941:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "4926:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "4926:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "4950:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "4905:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "4905:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "4895:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "4978:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "4993:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "5007:2:12",
                        "type": "",
                        "value": "32"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "4997:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "5023:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "5058:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "5069:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "5054:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "5054:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "5078:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "5033:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "5033:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value1",
                          "nodeType": "YulIdentifier",
                          "src": "5023:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "5106:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "5121:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "5135:2:12",
                        "type": "",
                        "value": "64"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "5125:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "5151:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "5186:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "5197:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "5182:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "5182:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "5206:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "5161:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "5161:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value2",
                          "nodeType": "YulIdentifier",
                          "src": "5151:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "5234:245:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "5249:46:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "5280:9:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "5291:2:12",
                                "type": "",
                                "value": "96"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "5276:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "5276:18:12"
                          }
                        ],
                        "functionName": {
                          "name": "calldataload",
                          "nodeType": "YulIdentifier",
                          "src": "5263:12:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "5263:32:12"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "5253:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "body": {
                        "nodeType": "YulBlock",
                        "src": "5342:16:12",
                        "statements": [
                          {
                            "expression": {
                              "arguments": [
                                {
                                  "kind": "number",
                                  "nodeType": "YulLiteral",
                                  "src": "5351:1:12",
                                  "type": "",
                                  "value": "0"
                                },
                                {
                                  "kind": "number",
                                  "nodeType": "YulLiteral",
                                  "src": "5354:1:12",
                                  "type": "",
                                  "value": "0"
                                }
                              ],
                              "functionName": {
                                "name": "revert",
                                "nodeType": "YulIdentifier",
                                "src": "5344:6:12"
                              },
                              "nodeType": "YulFunctionCall",
                              "src": "5344:12:12"
                            },
                            "nodeType": "YulExpressionStatement",
                            "src": "5344:12:12"
                          }
                        ]
                      },
                      "condition": {
                        "arguments": [
                          {
                            "name": "offset",
                            "nodeType": "YulIdentifier",
                            "src": "5314:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "5322:18:12",
                            "type": "",
                            "value": "0xffffffffffffffff"
                          }
                        ],
                        "functionName": {
                          "name": "gt",
                          "nodeType": "YulIdentifier",
                          "src": "5311:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "5311:30:12"
                      },
                      "nodeType": "YulIf",
                      "src": "5308:2:12"
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "5372:97:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "5441:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "5452:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "5437:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "5437:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "5461:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_array$_t_int256_$dyn_calldata_ptr",
                          "nodeType": "YulIdentifier",
                          "src": "5390:46:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "5390:79:12"
                      },
                      "variableNames": [
                        {
                          "name": "value3",
                          "nodeType": "YulIdentifier",
                          "src": "5372:6:12"
                        },
                        {
                          "name": "value4",
                          "nodeType": "YulIdentifier",
                          "src": "5380:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_addresst_uint256t_uint256t_array$_t_int256_$dyn_calldata_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "4716:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "4727:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "4739:6:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "4747:6:12",
                "type": ""
              },
              {
                "name": "value2",
                "nodeType": "YulTypedName",
                "src": "4755:6:12",
                "type": ""
              },
              {
                "name": "value3",
                "nodeType": "YulTypedName",
                "src": "4763:6:12",
                "type": ""
              },
              {
                "name": "value4",
                "nodeType": "YulTypedName",
                "src": "4771:6:12",
                "type": ""
              }
            ],
            "src": "4627:859:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "5660:837:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "5707:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "5716:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "5719:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "5709:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "5709:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "5709:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "5681:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "5690:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "5677:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "5677:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "5702:3:12",
                        "type": "",
                        "value": "160"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "5673:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "5673:33:12"
                  },
                  "nodeType": "YulIf",
                  "src": "5670:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "5733:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "5748:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "5762:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "5752:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "5777:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "5812:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "5823:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "5808:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "5808:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "5832:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "5787:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "5787:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "5777:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "5860:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "5875:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "5889:2:12",
                        "type": "",
                        "value": "32"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "5879:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "5905:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "5940:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "5951:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "5936:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "5936:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "5960:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "5915:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "5915:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value1",
                          "nodeType": "YulIdentifier",
                          "src": "5905:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "5988:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "6003:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "6017:2:12",
                        "type": "",
                        "value": "64"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "6007:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "6033:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "6068:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "6079:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "6064:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "6064:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "6088:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "6043:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6043:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value2",
                          "nodeType": "YulIdentifier",
                          "src": "6033:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "6116:118:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "6131:16:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "6145:2:12",
                        "type": "",
                        "value": "96"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "6135:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "6161:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "6196:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "6207:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "6192:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "6192:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "6216:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "6171:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6171:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value3",
                          "nodeType": "YulIdentifier",
                          "src": "6161:6:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "6244:246:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "6259:47:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "6290:9:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "6301:3:12",
                                "type": "",
                                "value": "128"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "6286:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "6286:19:12"
                          }
                        ],
                        "functionName": {
                          "name": "calldataload",
                          "nodeType": "YulIdentifier",
                          "src": "6273:12:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6273:33:12"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "6263:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "body": {
                        "nodeType": "YulBlock",
                        "src": "6353:16:12",
                        "statements": [
                          {
                            "expression": {
                              "arguments": [
                                {
                                  "kind": "number",
                                  "nodeType": "YulLiteral",
                                  "src": "6362:1:12",
                                  "type": "",
                                  "value": "0"
                                },
                                {
                                  "kind": "number",
                                  "nodeType": "YulLiteral",
                                  "src": "6365:1:12",
                                  "type": "",
                                  "value": "0"
                                }
                              ],
                              "functionName": {
                                "name": "revert",
                                "nodeType": "YulIdentifier",
                                "src": "6355:6:12"
                              },
                              "nodeType": "YulFunctionCall",
                              "src": "6355:12:12"
                            },
                            "nodeType": "YulExpressionStatement",
                            "src": "6355:12:12"
                          }
                        ]
                      },
                      "condition": {
                        "arguments": [
                          {
                            "name": "offset",
                            "nodeType": "YulIdentifier",
                            "src": "6325:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "6333:18:12",
                            "type": "",
                            "value": "0xffffffffffffffff"
                          }
                        ],
                        "functionName": {
                          "name": "gt",
                          "nodeType": "YulIdentifier",
                          "src": "6322:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6322:30:12"
                      },
                      "nodeType": "YulIf",
                      "src": "6319:2:12"
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "6383:97:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "6452:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "6463:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "6448:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "6448:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "6472:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_array$_t_int256_$dyn_calldata_ptr",
                          "nodeType": "YulIdentifier",
                          "src": "6401:46:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6401:79:12"
                      },
                      "variableNames": [
                        {
                          "name": "value4",
                          "nodeType": "YulIdentifier",
                          "src": "6383:6:12"
                        },
                        {
                          "name": "value5",
                          "nodeType": "YulIdentifier",
                          "src": "6391:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_addresst_uint256t_uint256t_uint256t_array$_t_int256_$dyn_calldata_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "5590:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "5601:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "5613:6:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "5621:6:12",
                "type": ""
              },
              {
                "name": "value2",
                "nodeType": "YulTypedName",
                "src": "5629:6:12",
                "type": ""
              },
              {
                "name": "value3",
                "nodeType": "YulTypedName",
                "src": "5637:6:12",
                "type": ""
              },
              {
                "name": "value4",
                "nodeType": "YulTypedName",
                "src": "5645:6:12",
                "type": ""
              },
              {
                "name": "value5",
                "nodeType": "YulTypedName",
                "src": "5653:6:12",
                "type": ""
              }
            ],
            "src": "5492:1005:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "6568:195:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "6614:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "6623:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "6626:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "6616:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "6616:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "6616:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "6589:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "6598:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "6585:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6585:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "6610:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "6581:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "6581:32:12"
                  },
                  "nodeType": "YulIf",
                  "src": "6578:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "6640:116:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "6655:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "6669:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "6659:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "6684:62:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "6718:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "6729:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "6714:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "6714:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "6738:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_bytes4",
                          "nodeType": "YulIdentifier",
                          "src": "6694:19:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6694:52:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "6684:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_bytes4",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "6538:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "6549:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "6561:6:12",
                "type": ""
              }
            ],
            "src": "6503:260:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "6845:206:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "6891:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "6900:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "6903:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "6893:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "6893:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "6893:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "6866:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "6875:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "6862:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6862:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "6887:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "6858:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "6858:32:12"
                  },
                  "nodeType": "YulIf",
                  "src": "6855:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "6917:127:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "6932:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "6946:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "6936:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "6961:73:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "7006:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "7017:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "7002:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "7002:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "7026:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_bytes4_fromMemory",
                          "nodeType": "YulIdentifier",
                          "src": "6971:30:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "6971:63:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "6961:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_bytes4_fromMemory",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "6815:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "6826:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "6838:6:12",
                "type": ""
              }
            ],
            "src": "6769:282:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "7123:196:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "7169:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "7178:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "7181:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "7171:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "7171:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "7171:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "7144:7:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "7153:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "7140:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "7140:23:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "7165:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "slt",
                      "nodeType": "YulIdentifier",
                      "src": "7136:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "7136:32:12"
                  },
                  "nodeType": "YulIf",
                  "src": "7133:2:12"
                },
                {
                  "nodeType": "YulBlock",
                  "src": "7195:117:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "7210:15:12",
                      "value": {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "7224:1:12",
                        "type": "",
                        "value": "0"
                      },
                      "variables": [
                        {
                          "name": "offset",
                          "nodeType": "YulTypedName",
                          "src": "7214:6:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "7239:63:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "headStart",
                                "nodeType": "YulIdentifier",
                                "src": "7274:9:12"
                              },
                              {
                                "name": "offset",
                                "nodeType": "YulIdentifier",
                                "src": "7285:6:12"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "7270:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "7270:22:12"
                          },
                          {
                            "name": "dataEnd",
                            "nodeType": "YulIdentifier",
                            "src": "7294:7:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_decode_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "7249:20:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "7249:53:12"
                      },
                      "variableNames": [
                        {
                          "name": "value0",
                          "nodeType": "YulIdentifier",
                          "src": "7239:6:12"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "name": "abi_decode_tuple_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "7093:9:12",
                "type": ""
              },
              {
                "name": "dataEnd",
                "nodeType": "YulTypedName",
                "src": "7104:7:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "7116:6:12",
                "type": ""
              }
            ],
            "src": "7057:262:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "7403:97:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value0",
                        "nodeType": "YulIdentifier",
                        "src": "7445:6:12"
                      },
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "7453:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_int256_to_t_int256",
                      "nodeType": "YulIdentifier",
                      "src": "7413:31:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "7413:44:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "7413:44:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "7466:28:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "7484:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "7489:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "7480:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "7480:14:12"
                  },
                  "variableNames": [
                    {
                      "name": "updatedPos",
                      "nodeType": "YulIdentifier",
                      "src": "7466:10:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encodeUpdatedPos_t_int256_to_t_int256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "7376:6:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "7384:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "updatedPos",
                "nodeType": "YulTypedName",
                "src": "7392:10:12",
                "type": ""
              }
            ],
            "src": "7325:175:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "7571:53:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "7588:3:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "7611:5:12"
                          }
                        ],
                        "functionName": {
                          "name": "cleanup_t_address",
                          "nodeType": "YulIdentifier",
                          "src": "7593:17:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "7593:24:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "7581:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "7581:37:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "7581:37:12"
                }
              ]
            },
            "name": "abi_encode_t_address_to_t_address_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "7559:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "7566:3:12",
                "type": ""
              }
            ],
            "src": "7506:118:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "7770:592:12",
              "statements": [
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "7780:67:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "7841:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_length_t_array$_t_int256_$dyn_memory_ptr",
                      "nodeType": "YulIdentifier",
                      "src": "7794:46:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "7794:53:12"
                  },
                  "variables": [
                    {
                      "name": "length",
                      "nodeType": "YulTypedName",
                      "src": "7784:6:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "7856:82:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "7926:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "7931:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_array$_t_int256_$dyn_memory_ptr",
                      "nodeType": "YulIdentifier",
                      "src": "7863:62:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "7863:75:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "7856:3:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "7947:70:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "8011:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_dataslot_t_array$_t_int256_$dyn_memory_ptr",
                      "nodeType": "YulIdentifier",
                      "src": "7962:48:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "7962:55:12"
                  },
                  "variables": [
                    {
                      "name": "baseRef",
                      "nodeType": "YulTypedName",
                      "src": "7951:7:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "8026:21:12",
                  "value": {
                    "name": "baseRef",
                    "nodeType": "YulIdentifier",
                    "src": "8040:7:12"
                  },
                  "variables": [
                    {
                      "name": "srcPtr",
                      "nodeType": "YulTypedName",
                      "src": "8030:6:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "8116:221:12",
                    "statements": [
                      {
                        "nodeType": "YulVariableDeclaration",
                        "src": "8130:34:12",
                        "value": {
                          "arguments": [
                            {
                              "name": "srcPtr",
                              "nodeType": "YulIdentifier",
                              "src": "8157:6:12"
                            }
                          ],
                          "functionName": {
                            "name": "mload",
                            "nodeType": "YulIdentifier",
                            "src": "8151:5:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "8151:13:12"
                        },
                        "variables": [
                          {
                            "name": "elementValue0",
                            "nodeType": "YulTypedName",
                            "src": "8134:13:12",
                            "type": ""
                          }
                        ]
                      },
                      {
                        "nodeType": "YulAssignment",
                        "src": "8177:68:12",
                        "value": {
                          "arguments": [
                            {
                              "name": "elementValue0",
                              "nodeType": "YulIdentifier",
                              "src": "8226:13:12"
                            },
                            {
                              "name": "pos",
                              "nodeType": "YulIdentifier",
                              "src": "8241:3:12"
                            }
                          ],
                          "functionName": {
                            "name": "abi_encodeUpdatedPos_t_int256_to_t_int256",
                            "nodeType": "YulIdentifier",
                            "src": "8184:41:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "8184:61:12"
                        },
                        "variableNames": [
                          {
                            "name": "pos",
                            "nodeType": "YulIdentifier",
                            "src": "8177:3:12"
                          }
                        ]
                      },
                      {
                        "nodeType": "YulAssignment",
                        "src": "8258:69:12",
                        "value": {
                          "arguments": [
                            {
                              "name": "srcPtr",
                              "nodeType": "YulIdentifier",
                              "src": "8320:6:12"
                            }
                          ],
                          "functionName": {
                            "name": "array_nextElement_t_array$_t_int256_$dyn_memory_ptr",
                            "nodeType": "YulIdentifier",
                            "src": "8268:51:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "8268:59:12"
                        },
                        "variableNames": [
                          {
                            "name": "srcPtr",
                            "nodeType": "YulIdentifier",
                            "src": "8258:6:12"
                          }
                        ]
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "i",
                        "nodeType": "YulIdentifier",
                        "src": "8078:1:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "8081:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "lt",
                      "nodeType": "YulIdentifier",
                      "src": "8075:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "8075:13:12"
                  },
                  "nodeType": "YulForLoop",
                  "post": {
                    "nodeType": "YulBlock",
                    "src": "8089:18:12",
                    "statements": [
                      {
                        "nodeType": "YulAssignment",
                        "src": "8091:14:12",
                        "value": {
                          "arguments": [
                            {
                              "name": "i",
                              "nodeType": "YulIdentifier",
                              "src": "8100:1:12"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "8103:1:12",
                              "type": "",
                              "value": "1"
                            }
                          ],
                          "functionName": {
                            "name": "add",
                            "nodeType": "YulIdentifier",
                            "src": "8096:3:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "8096:9:12"
                        },
                        "variableNames": [
                          {
                            "name": "i",
                            "nodeType": "YulIdentifier",
                            "src": "8091:1:12"
                          }
                        ]
                      }
                    ]
                  },
                  "pre": {
                    "nodeType": "YulBlock",
                    "src": "8060:14:12",
                    "statements": [
                      {
                        "nodeType": "YulVariableDeclaration",
                        "src": "8062:10:12",
                        "value": {
                          "kind": "number",
                          "nodeType": "YulLiteral",
                          "src": "8071:1:12",
                          "type": "",
                          "value": "0"
                        },
                        "variables": [
                          {
                            "name": "i",
                            "nodeType": "YulTypedName",
                            "src": "8066:1:12",
                            "type": ""
                          }
                        ]
                      }
                    ]
                  },
                  "src": "8056:281:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "8346:10:12",
                  "value": {
                    "name": "pos",
                    "nodeType": "YulIdentifier",
                    "src": "8353:3:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "8346:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_array$_t_int256_$dyn_memory_ptr_to_t_array$_t_int256_$dyn_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "7749:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "7756:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "7765:3:12",
                "type": ""
              }
            ],
            "src": "7658:704:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "8427:50:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "8444:3:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "8464:5:12"
                          }
                        ],
                        "functionName": {
                          "name": "cleanup_t_bool",
                          "nodeType": "YulIdentifier",
                          "src": "8449:14:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "8449:21:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "8437:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "8437:34:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "8437:34:12"
                }
              ]
            },
            "name": "abi_encode_t_bool_to_t_bool_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "8415:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "8422:3:12",
                "type": ""
              }
            ],
            "src": "8368:109:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "8573:270:12",
              "statements": [
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "8583:52:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "8629:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_length_t_bytes_memory_ptr",
                      "nodeType": "YulIdentifier",
                      "src": "8597:31:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "8597:38:12"
                  },
                  "variables": [
                    {
                      "name": "length",
                      "nodeType": "YulTypedName",
                      "src": "8587:6:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "8644:77:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "8709:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "8714:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_bytes_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "8651:57:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "8651:70:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "8644:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "8756:5:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "8763:4:12",
                            "type": "",
                            "value": "0x20"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "8752:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "8752:16:12"
                      },
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "8770:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "8775:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "copy_memory_to_memory",
                      "nodeType": "YulIdentifier",
                      "src": "8730:21:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "8730:52:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "8730:52:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "8791:46:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "8802:3:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "8829:6:12"
                          }
                        ],
                        "functionName": {
                          "name": "round_up_to_mul_of_32",
                          "nodeType": "YulIdentifier",
                          "src": "8807:21:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "8807:29:12"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "8798:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "8798:39:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "8791:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_bytes_memory_ptr_to_t_bytes_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "8554:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "8561:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "8569:3:12",
                "type": ""
              }
            ],
            "src": "8483:360:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "8902:52:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "8919:3:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "8941:5:12"
                          }
                        ],
                        "functionName": {
                          "name": "cleanup_t_int256",
                          "nodeType": "YulIdentifier",
                          "src": "8924:16:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "8924:23:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "8912:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "8912:36:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "8912:36:12"
                }
              ]
            },
            "name": "abi_encode_t_int256_to_t_int256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "8890:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "8897:3:12",
                "type": ""
              }
            ],
            "src": "8849:105:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "9052:272:12",
              "statements": [
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "9062:53:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "9109:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_length_t_string_memory_ptr",
                      "nodeType": "YulIdentifier",
                      "src": "9076:32:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9076:39:12"
                  },
                  "variables": [
                    {
                      "name": "length",
                      "nodeType": "YulTypedName",
                      "src": "9066:6:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "9124:78:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "9190:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "9195:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "9131:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9131:71:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "9124:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "9237:5:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "9244:4:12",
                            "type": "",
                            "value": "0x20"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "9233:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "9233:16:12"
                      },
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "9251:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "9256:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "copy_memory_to_memory",
                      "nodeType": "YulIdentifier",
                      "src": "9211:21:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9211:52:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "9211:52:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "9272:46:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "9283:3:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "9310:6:12"
                          }
                        ],
                        "functionName": {
                          "name": "round_up_to_mul_of_32",
                          "nodeType": "YulIdentifier",
                          "src": "9288:21:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "9288:29:12"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "9279:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9279:39:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "9272:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "9033:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "9040:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "9048:3:12",
                "type": ""
              }
            ],
            "src": "8960:364:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "9440:267:12",
              "statements": [
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "9450:53:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "9497:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_length_t_string_memory_ptr",
                      "nodeType": "YulIdentifier",
                      "src": "9464:32:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9464:39:12"
                  },
                  "variables": [
                    {
                      "name": "length",
                      "nodeType": "YulTypedName",
                      "src": "9454:6:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "9512:96:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "9596:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "9601:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_nonPadded_inplace_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "9519:76:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9519:89:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "9512:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "9643:5:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "9650:4:12",
                            "type": "",
                            "value": "0x20"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "9639:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "9639:16:12"
                      },
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "9657:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "9662:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "copy_memory_to_memory",
                      "nodeType": "YulIdentifier",
                      "src": "9617:21:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9617:52:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "9617:52:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "9678:23:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "9689:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "9694:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "9685:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9685:16:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "9678:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "9421:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "9428:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "9436:3:12",
                "type": ""
              }
            ],
            "src": "9330:377:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "9859:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "9869:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "9935:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "9940:2:12",
                        "type": "",
                        "value": "50"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "9876:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9876:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "9869:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "10041:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e",
                      "nodeType": "YulIdentifier",
                      "src": "9952:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "9952:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "9952:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "10054:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "10065:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "10070:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "10061:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "10061:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "10054:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "9847:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "9855:3:12",
                "type": ""
              }
            ],
            "src": "9713:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "10231:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "10241:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "10307:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "10312:2:12",
                        "type": "",
                        "value": "38"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "10248:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "10248:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "10241:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "10413:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe",
                      "nodeType": "YulIdentifier",
                      "src": "10324:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "10324:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "10324:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "10426:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "10437:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "10442:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "10433:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "10433:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "10426:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "10219:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "10227:3:12",
                "type": ""
              }
            ],
            "src": "10085:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "10603:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "10613:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "10679:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "10684:2:12",
                        "type": "",
                        "value": "37"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "10620:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "10620:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "10613:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "10785:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48",
                      "nodeType": "YulIdentifier",
                      "src": "10696:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "10696:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "10696:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "10798:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "10809:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "10814:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "10805:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "10805:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "10798:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "10591:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "10599:3:12",
                "type": ""
              }
            ],
            "src": "10457:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "10975:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "10985:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11051:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "11056:2:12",
                        "type": "",
                        "value": "28"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "10992:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "10992:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "10985:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11157:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57",
                      "nodeType": "YulIdentifier",
                      "src": "11068:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "11068:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "11068:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "11170:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11181:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "11186:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "11177:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "11177:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "11170:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "10963:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "10971:3:12",
                "type": ""
              }
            ],
            "src": "10829:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "11347:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "11357:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11423:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "11428:2:12",
                        "type": "",
                        "value": "36"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "11364:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "11364:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "11357:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11529:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4",
                      "nodeType": "YulIdentifier",
                      "src": "11440:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "11440:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "11440:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "11542:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11553:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "11558:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "11549:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "11549:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "11542:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "11335:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "11343:3:12",
                "type": ""
              }
            ],
            "src": "11201:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "11719:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "11729:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11795:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "11800:2:12",
                        "type": "",
                        "value": "25"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "11736:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "11736:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "11729:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11901:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05",
                      "nodeType": "YulIdentifier",
                      "src": "11812:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "11812:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "11812:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "11914:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "11925:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "11930:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "11921:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "11921:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "11914:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "11707:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "11715:3:12",
                "type": ""
              }
            ],
            "src": "11573:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "12091:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "12101:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "12167:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "12172:2:12",
                        "type": "",
                        "value": "44"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "12108:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "12108:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "12101:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "12273:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c",
                      "nodeType": "YulIdentifier",
                      "src": "12184:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "12184:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "12184:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "12286:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "12297:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "12302:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "12293:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "12293:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "12286:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "12079:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "12087:3:12",
                "type": ""
              }
            ],
            "src": "11945:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "12463:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "12473:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "12539:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "12544:2:12",
                        "type": "",
                        "value": "56"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "12480:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "12480:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "12473:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "12645:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d",
                      "nodeType": "YulIdentifier",
                      "src": "12556:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "12556:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "12556:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "12658:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "12669:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "12674:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "12665:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "12665:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "12658:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "12451:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "12459:3:12",
                "type": ""
              }
            ],
            "src": "12317:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "12835:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "12845:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "12911:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "12916:2:12",
                        "type": "",
                        "value": "42"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "12852:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "12852:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "12845:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "13017:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba",
                      "nodeType": "YulIdentifier",
                      "src": "12928:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "12928:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "12928:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "13030:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "13041:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "13046:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "13037:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "13037:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "13030:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "12823:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "12831:3:12",
                "type": ""
              }
            ],
            "src": "12689:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "13207:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "13217:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "13283:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "13288:2:12",
                        "type": "",
                        "value": "41"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "13224:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "13224:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "13217:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "13389:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397",
                      "nodeType": "YulIdentifier",
                      "src": "13300:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "13300:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "13300:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "13402:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "13413:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "13418:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "13409:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "13409:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "13402:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "13195:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "13203:3:12",
                "type": ""
              }
            ],
            "src": "13061:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "13579:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "13589:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "13655:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "13660:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "13596:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "13596:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "13589:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "13761:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6",
                      "nodeType": "YulIdentifier",
                      "src": "13672:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "13672:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "13672:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "13774:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "13785:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "13790:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "13781:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "13781:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "13774:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "13567:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "13575:3:12",
                "type": ""
              }
            ],
            "src": "13433:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "13951:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "13961:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14027:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "14032:2:12",
                        "type": "",
                        "value": "44"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "13968:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "13968:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "13961:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14133:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d",
                      "nodeType": "YulIdentifier",
                      "src": "14044:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "14044:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "14044:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "14146:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14157:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "14162:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "14153:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "14153:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "14146:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "13939:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "13947:3:12",
                "type": ""
              }
            ],
            "src": "13805:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "14323:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "14333:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14399:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "14404:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "14340:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "14340:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "14333:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14505:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe",
                      "nodeType": "YulIdentifier",
                      "src": "14416:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "14416:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "14416:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "14518:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14529:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "14534:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "14525:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "14525:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "14518:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "14311:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "14319:3:12",
                "type": ""
              }
            ],
            "src": "14177:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "14695:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "14705:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14771:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "14776:2:12",
                        "type": "",
                        "value": "47"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "14712:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "14712:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "14705:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14877:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb",
                      "nodeType": "YulIdentifier",
                      "src": "14788:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "14788:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "14788:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "14890:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "14901:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "14906:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "14897:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "14897:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "14890:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "14683:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "14691:3:12",
                "type": ""
              }
            ],
            "src": "14549:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "15067:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "15077:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "15143:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "15148:2:12",
                        "type": "",
                        "value": "33"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "15084:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "15084:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "15077:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "15249:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942",
                      "nodeType": "YulIdentifier",
                      "src": "15160:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "15160:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "15160:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "15262:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "15273:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "15278:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "15269:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "15269:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "15262:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "15055:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "15063:3:12",
                "type": ""
              }
            ],
            "src": "14921:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "15439:220:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "15449:74:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "15515:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "15520:2:12",
                        "type": "",
                        "value": "49"
                      }
                    ],
                    "functionName": {
                      "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "15456:58:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "15456:67:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "15449:3:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "15621:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "store_literal_in_memory_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2",
                      "nodeType": "YulIdentifier",
                      "src": "15532:88:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "15532:93:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "15532:93:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "15634:19:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "15645:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "15650:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "15641:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "15641:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "15634:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_stringliteral_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2_to_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "15427:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "15435:3:12",
                "type": ""
              }
            ],
            "src": "15293:366:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "15877:685:12",
              "statements": [
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "15887:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "15903:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "15908:4:12",
                        "type": "",
                        "value": "0x60"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "15899:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "15899:14:12"
                  },
                  "variables": [
                    {
                      "name": "tail",
                      "nodeType": "YulTypedName",
                      "src": "15891:4:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "15923:161:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "15955:43:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "value",
                                "nodeType": "YulIdentifier",
                                "src": "15985:5:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "15992:4:12",
                                "type": "",
                                "value": "0x00"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "15981:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "15981:16:12"
                          }
                        ],
                        "functionName": {
                          "name": "mload",
                          "nodeType": "YulIdentifier",
                          "src": "15975:5:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "15975:23:12"
                      },
                      "variables": [
                        {
                          "name": "memberValue0",
                          "nodeType": "YulTypedName",
                          "src": "15959:12:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "expression": {
                        "arguments": [
                          {
                            "name": "memberValue0",
                            "nodeType": "YulIdentifier",
                            "src": "16045:12:12"
                          },
                          {
                            "arguments": [
                              {
                                "name": "pos",
                                "nodeType": "YulIdentifier",
                                "src": "16063:3:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "16068:4:12",
                                "type": "",
                                "value": "0x00"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "16059:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "16059:14:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_encode_t_uint256_to_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "16011:33:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "16011:63:12"
                      },
                      "nodeType": "YulExpressionStatement",
                      "src": "16011:63:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "16094:161:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "16126:43:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "value",
                                "nodeType": "YulIdentifier",
                                "src": "16156:5:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "16163:4:12",
                                "type": "",
                                "value": "0x20"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "16152:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "16152:16:12"
                          }
                        ],
                        "functionName": {
                          "name": "mload",
                          "nodeType": "YulIdentifier",
                          "src": "16146:5:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "16146:23:12"
                      },
                      "variables": [
                        {
                          "name": "memberValue0",
                          "nodeType": "YulTypedName",
                          "src": "16130:12:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "expression": {
                        "arguments": [
                          {
                            "name": "memberValue0",
                            "nodeType": "YulIdentifier",
                            "src": "16216:12:12"
                          },
                          {
                            "arguments": [
                              {
                                "name": "pos",
                                "nodeType": "YulIdentifier",
                                "src": "16234:3:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "16239:4:12",
                                "type": "",
                                "value": "0x20"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "16230:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "16230:14:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_encode_t_uint256_to_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "16182:33:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "16182:63:12"
                      },
                      "nodeType": "YulExpressionStatement",
                      "src": "16182:63:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulBlock",
                  "src": "16265:270:12",
                  "statements": [
                    {
                      "nodeType": "YulVariableDeclaration",
                      "src": "16307:43:12",
                      "value": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "value",
                                "nodeType": "YulIdentifier",
                                "src": "16337:5:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "16344:4:12",
                                "type": "",
                                "value": "0x40"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "16333:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "16333:16:12"
                          }
                        ],
                        "functionName": {
                          "name": "mload",
                          "nodeType": "YulIdentifier",
                          "src": "16327:5:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "16327:23:12"
                      },
                      "variables": [
                        {
                          "name": "memberValue0",
                          "nodeType": "YulTypedName",
                          "src": "16311:12:12",
                          "type": ""
                        }
                      ]
                    },
                    {
                      "expression": {
                        "arguments": [
                          {
                            "arguments": [
                              {
                                "name": "pos",
                                "nodeType": "YulIdentifier",
                                "src": "16375:3:12"
                              },
                              {
                                "kind": "number",
                                "nodeType": "YulLiteral",
                                "src": "16380:4:12",
                                "type": "",
                                "value": "0x40"
                              }
                            ],
                            "functionName": {
                              "name": "add",
                              "nodeType": "YulIdentifier",
                              "src": "16371:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "16371:14:12"
                          },
                          {
                            "arguments": [
                              {
                                "name": "tail",
                                "nodeType": "YulIdentifier",
                                "src": "16391:4:12"
                              },
                              {
                                "name": "pos",
                                "nodeType": "YulIdentifier",
                                "src": "16397:3:12"
                              }
                            ],
                            "functionName": {
                              "name": "sub",
                              "nodeType": "YulIdentifier",
                              "src": "16387:3:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "16387:14:12"
                          }
                        ],
                        "functionName": {
                          "name": "mstore",
                          "nodeType": "YulIdentifier",
                          "src": "16364:6:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "16364:38:12"
                      },
                      "nodeType": "YulExpressionStatement",
                      "src": "16364:38:12"
                    },
                    {
                      "nodeType": "YulAssignment",
                      "src": "16415:109:12",
                      "value": {
                        "arguments": [
                          {
                            "name": "memberValue0",
                            "nodeType": "YulIdentifier",
                            "src": "16505:12:12"
                          },
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "16519:4:12"
                          }
                        ],
                        "functionName": {
                          "name": "abi_encode_t_array$_t_int256_$dyn_memory_ptr_to_t_array$_t_int256_$dyn_memory_ptr",
                          "nodeType": "YulIdentifier",
                          "src": "16423:81:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "16423:101:12"
                      },
                      "variableNames": [
                        {
                          "name": "tail",
                          "nodeType": "YulIdentifier",
                          "src": "16415:4:12"
                        }
                      ]
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "16545:11:12",
                  "value": {
                    "name": "tail",
                    "nodeType": "YulIdentifier",
                    "src": "16552:4:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "16545:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_t_struct$_IdentityData_$1782_memory_ptr_to_t_struct$_IdentityData_$1782_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "15856:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "15863:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "15872:3:12",
                "type": ""
              }
            ],
            "src": "15743:819:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "16623:53:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "16640:3:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "16663:5:12"
                          }
                        ],
                        "functionName": {
                          "name": "cleanup_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "16645:17:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "16645:24:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "16633:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "16633:37:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "16633:37:12"
                }
              ]
            },
            "name": "abi_encode_t_uint256_to_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "16611:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "16618:3:12",
                "type": ""
              }
            ],
            "src": "16568:108:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "16747:53:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "16764:3:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "16787:5:12"
                          }
                        ],
                        "functionName": {
                          "name": "cleanup_t_uint256",
                          "nodeType": "YulIdentifier",
                          "src": "16769:17:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "16769:24:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "16757:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "16757:37:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "16757:37:12"
                }
              ]
            },
            "name": "abi_encode_t_uint256_to_t_uint256_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "16735:5:12",
                "type": ""
              },
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "16742:3:12",
                "type": ""
              }
            ],
            "src": "16682:118:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "16990:251:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "17001:102:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value0",
                        "nodeType": "YulIdentifier",
                        "src": "17090:6:12"
                      },
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "17099:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "17008:81:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17008:95:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "17001:3:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "17113:102:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value1",
                        "nodeType": "YulIdentifier",
                        "src": "17202:6:12"
                      },
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "17211:3:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "17120:81:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17120:95:12"
                  },
                  "variableNames": [
                    {
                      "name": "pos",
                      "nodeType": "YulIdentifier",
                      "src": "17113:3:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "17225:10:12",
                  "value": {
                    "name": "pos",
                    "nodeType": "YulIdentifier",
                    "src": "17232:3:12"
                  },
                  "variableNames": [
                    {
                      "name": "end",
                      "nodeType": "YulIdentifier",
                      "src": "17225:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_packed_t_string_memory_ptr_t_string_memory_ptr__to_t_string_memory_ptr_t_string_memory_ptr__nonPadded_inplace_fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "16961:3:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "16967:6:12",
                "type": ""
              },
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "16975:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "end",
                "nodeType": "YulTypedName",
                "src": "16986:3:12",
                "type": ""
              }
            ],
            "src": "16806:435:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "17345:124:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "17355:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "17367:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "17378:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "17363:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17363:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "17355:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value0",
                        "nodeType": "YulIdentifier",
                        "src": "17435:6:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "17448:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "17459:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "17444:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "17444:17:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_address_to_t_address_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "17391:43:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17391:71:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "17391:71:12"
                }
              ]
            },
            "name": "abi_encode_tuple_t_address__to_t_address__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "17317:9:12",
                "type": ""
              },
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "17329:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "17340:4:12",
                "type": ""
              }
            ],
            "src": "17247:222:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "17675:440:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "17685:27:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "17697:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "17708:3:12",
                        "type": "",
                        "value": "128"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "17693:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17693:19:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "17685:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value0",
                        "nodeType": "YulIdentifier",
                        "src": "17766:6:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "17779:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "17790:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "17775:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "17775:17:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_address_to_t_address_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "17722:43:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17722:71:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "17722:71:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value1",
                        "nodeType": "YulIdentifier",
                        "src": "17847:6:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "17860:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "17871:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "17856:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "17856:18:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_address_to_t_address_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "17803:43:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17803:72:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "17803:72:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value2",
                        "nodeType": "YulIdentifier",
                        "src": "17929:6:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "17942:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "17953:2:12",
                            "type": "",
                            "value": "64"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "17938:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "17938:18:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_uint256_to_t_uint256_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "17885:43:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17885:72:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "17885:72:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "17978:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "17989:2:12",
                            "type": "",
                            "value": "96"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "17974:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "17974:18:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "17998:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "18004:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "17994:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "17994:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "17967:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "17967:48:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "17967:48:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "18024:84:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value3",
                        "nodeType": "YulIdentifier",
                        "src": "18094:6:12"
                      },
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "18103:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_bytes_memory_ptr_to_t_bytes_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "18032:61:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18032:76:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "18024:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_address_t_address_t_uint256_t_bytes_memory_ptr__to_t_address_t_address_t_uint256_t_bytes_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "17623:9:12",
                "type": ""
              },
              {
                "name": "value3",
                "nodeType": "YulTypedName",
                "src": "17635:6:12",
                "type": ""
              },
              {
                "name": "value2",
                "nodeType": "YulTypedName",
                "src": "17643:6:12",
                "type": ""
              },
              {
                "name": "value1",
                "nodeType": "YulTypedName",
                "src": "17651:6:12",
                "type": ""
              },
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "17659:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "17670:4:12",
                "type": ""
              }
            ],
            "src": "17475:640:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "18213:118:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "18223:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "18235:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "18246:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "18231:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18231:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "18223:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value0",
                        "nodeType": "YulIdentifier",
                        "src": "18297:6:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "18310:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "18321:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "18306:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "18306:17:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_bool_to_t_bool_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "18259:37:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18259:65:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "18259:65:12"
                }
              ]
            },
            "name": "abi_encode_tuple_t_bool__to_t_bool__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "18185:9:12",
                "type": ""
              },
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "18197:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "18208:4:12",
                "type": ""
              }
            ],
            "src": "18121:210:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "18455:195:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "18465:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "18477:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "18488:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "18473:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18473:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "18465:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "18512:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "18523:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "18508:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "18508:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "18531:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "18537:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "18527:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "18527:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "18501:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18501:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "18501:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "18557:86:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value0",
                        "nodeType": "YulIdentifier",
                        "src": "18629:6:12"
                      },
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "18638:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "18565:63:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18565:78:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "18557:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_string_memory_ptr__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "18427:9:12",
                "type": ""
              },
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "18439:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "18450:4:12",
                "type": ""
              }
            ],
            "src": "18337:313:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "18827:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "18837:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "18849:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "18860:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "18845:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18845:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "18837:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "18884:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "18895:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "18880:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "18880:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "18903:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "18909:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "18899:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "18899:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "18873:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18873:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "18873:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "18929:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "19063:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "18937:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "18937:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "18929:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "18807:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "18822:4:12",
                "type": ""
              }
            ],
            "src": "18656:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "19252:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "19262:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "19274:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "19285:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "19270:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "19270:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "19262:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "19309:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "19320:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "19305:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "19305:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "19328:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "19334:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "19324:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "19324:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "19298:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "19298:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "19298:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "19354:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "19488:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "19362:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "19362:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "19354:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "19232:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "19247:4:12",
                "type": ""
              }
            ],
            "src": "19081:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "19677:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "19687:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "19699:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "19710:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "19695:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "19695:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "19687:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "19734:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "19745:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "19730:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "19730:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "19753:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "19759:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "19749:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "19749:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "19723:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "19723:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "19723:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "19779:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "19913:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "19787:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "19787:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "19779:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "19657:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "19672:4:12",
                "type": ""
              }
            ],
            "src": "19506:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "20102:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "20112:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "20124:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "20135:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "20120:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "20120:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "20112:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "20159:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "20170:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "20155:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "20155:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "20178:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "20184:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "20174:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "20174:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "20148:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "20148:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "20148:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "20204:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "20338:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "20212:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "20212:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "20204:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "20082:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "20097:4:12",
                "type": ""
              }
            ],
            "src": "19931:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "20527:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "20537:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "20549:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "20560:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "20545:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "20545:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "20537:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "20584:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "20595:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "20580:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "20580:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "20603:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "20609:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "20599:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "20599:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "20573:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "20573:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "20573:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "20629:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "20763:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "20637:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "20637:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "20629:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "20507:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "20522:4:12",
                "type": ""
              }
            ],
            "src": "20356:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "20952:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "20962:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "20974:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "20985:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "20970:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "20970:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "20962:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "21009:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "21020:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "21005:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "21005:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "21028:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "21034:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "21024:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "21024:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "20998:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "20998:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "20998:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "21054:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "21188:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "21062:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "21062:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "21054:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "20932:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "20947:4:12",
                "type": ""
              }
            ],
            "src": "20781:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "21377:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "21387:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "21399:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "21410:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "21395:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "21395:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "21387:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "21434:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "21445:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "21430:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "21430:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "21453:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "21459:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "21449:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "21449:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "21423:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "21423:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "21423:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "21479:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "21613:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "21487:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "21487:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "21479:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "21357:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "21372:4:12",
                "type": ""
              }
            ],
            "src": "21206:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "21802:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "21812:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "21824:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "21835:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "21820:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "21820:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "21812:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "21859:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "21870:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "21855:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "21855:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "21878:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "21884:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "21874:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "21874:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "21848:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "21848:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "21848:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "21904:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "22038:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "21912:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "21912:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "21904:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "21782:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "21797:4:12",
                "type": ""
              }
            ],
            "src": "21631:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "22227:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "22237:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "22249:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "22260:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "22245:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "22245:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "22237:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "22284:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "22295:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "22280:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "22280:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "22303:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "22309:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "22299:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "22299:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "22273:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "22273:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "22273:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "22329:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "22463:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "22337:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "22337:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "22329:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "22207:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "22222:4:12",
                "type": ""
              }
            ],
            "src": "22056:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "22652:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "22662:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "22674:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "22685:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "22670:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "22670:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "22662:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "22709:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "22720:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "22705:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "22705:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "22728:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "22734:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "22724:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "22724:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "22698:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "22698:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "22698:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "22754:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "22888:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "22762:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "22762:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "22754:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "22632:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "22647:4:12",
                "type": ""
              }
            ],
            "src": "22481:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "23077:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "23087:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "23099:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "23110:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "23095:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "23095:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "23087:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "23134:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "23145:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "23130:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "23130:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "23153:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "23159:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "23149:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "23149:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "23123:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "23123:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "23123:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "23179:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "23313:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "23187:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "23187:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "23179:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "23057:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "23072:4:12",
                "type": ""
              }
            ],
            "src": "22906:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "23502:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "23512:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "23524:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "23535:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "23520:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "23520:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "23512:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "23559:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "23570:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "23555:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "23555:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "23578:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "23584:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "23574:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "23574:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "23548:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "23548:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "23548:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "23604:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "23738:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "23612:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "23612:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "23604:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "23482:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "23497:4:12",
                "type": ""
              }
            ],
            "src": "23331:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "23927:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "23937:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "23949:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "23960:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "23945:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "23945:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "23937:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "23984:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "23995:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "23980:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "23980:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "24003:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "24009:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "23999:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "23999:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "23973:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "23973:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "23973:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "24029:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "24163:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "24037:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "24037:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "24029:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "23907:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "23922:4:12",
                "type": ""
              }
            ],
            "src": "23756:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "24352:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "24362:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "24374:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "24385:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "24370:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "24370:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "24362:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "24409:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "24420:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "24405:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "24405:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "24428:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "24434:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "24424:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "24424:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "24398:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "24398:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "24398:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "24454:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "24588:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "24462:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "24462:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "24454:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "24332:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "24347:4:12",
                "type": ""
              }
            ],
            "src": "24181:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "24777:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "24787:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "24799:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "24810:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "24795:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "24795:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "24787:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "24834:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "24845:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "24830:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "24830:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "24853:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "24859:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "24849:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "24849:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "24823:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "24823:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "24823:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "24879:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "25013:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "24887:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "24887:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "24879:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "24757:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "24772:4:12",
                "type": ""
              }
            ],
            "src": "24606:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "25202:248:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "25212:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "25224:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "25235:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "25220:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "25220:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "25212:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "25259:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "25270:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "25255:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "25255:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "25278:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "25284:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "25274:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "25274:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "25248:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "25248:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "25248:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "25304:139:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "25438:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_stringliteral_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2_to_t_string_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "25312:124:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "25312:131:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "25304:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_stringliteral_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2__to_t_string_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "25182:9:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "25197:4:12",
                "type": ""
              }
            ],
            "src": "25031:419:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "25614:235:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "25624:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "25636:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "25647:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "25632:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "25632:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "25624:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "25671:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "25682:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "25667:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "25667:17:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "tail",
                            "nodeType": "YulIdentifier",
                            "src": "25690:4:12"
                          },
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "25696:9:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "25686:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "25686:20:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "25660:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "25660:47:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "25660:47:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "25716:126:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value0",
                        "nodeType": "YulIdentifier",
                        "src": "25828:6:12"
                      },
                      {
                        "name": "tail",
                        "nodeType": "YulIdentifier",
                        "src": "25837:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_struct$_IdentityData_$1782_memory_ptr_to_t_struct$_IdentityData_$1782_memory_ptr_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "25724:103:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "25724:118:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "25716:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "abi_encode_tuple_t_struct$_IdentityData_$1782_memory_ptr__to_t_struct$_IdentityData_$1782_memory_ptr__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "25586:9:12",
                "type": ""
              },
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "25598:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "25609:4:12",
                "type": ""
              }
            ],
            "src": "25456:393:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "25953:124:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "25963:26:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "headStart",
                        "nodeType": "YulIdentifier",
                        "src": "25975:9:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "25986:2:12",
                        "type": "",
                        "value": "32"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "25971:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "25971:18:12"
                  },
                  "variableNames": [
                    {
                      "name": "tail",
                      "nodeType": "YulIdentifier",
                      "src": "25963:4:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "value0",
                        "nodeType": "YulIdentifier",
                        "src": "26043:6:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "headStart",
                            "nodeType": "YulIdentifier",
                            "src": "26056:9:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "26067:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "26052:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "26052:17:12"
                      }
                    ],
                    "functionName": {
                      "name": "abi_encode_t_uint256_to_t_uint256_fromStack",
                      "nodeType": "YulIdentifier",
                      "src": "25999:43:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "25999:71:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "25999:71:12"
                }
              ]
            },
            "name": "abi_encode_tuple_t_uint256__to_t_uint256__fromStack_reversed",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "headStart",
                "nodeType": "YulTypedName",
                "src": "25925:9:12",
                "type": ""
              },
              {
                "name": "value0",
                "nodeType": "YulTypedName",
                "src": "25937:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "tail",
                "nodeType": "YulTypedName",
                "src": "25948:4:12",
                "type": ""
              }
            ],
            "src": "25855:222:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "26124:88:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "26134:30:12",
                  "value": {
                    "arguments": [],
                    "functionName": {
                      "name": "allocate_unbounded",
                      "nodeType": "YulIdentifier",
                      "src": "26144:18:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26144:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "memPtr",
                      "nodeType": "YulIdentifier",
                      "src": "26134:6:12"
                    }
                  ]
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "memPtr",
                        "nodeType": "YulIdentifier",
                        "src": "26193:6:12"
                      },
                      {
                        "name": "size",
                        "nodeType": "YulIdentifier",
                        "src": "26201:4:12"
                      }
                    ],
                    "functionName": {
                      "name": "finalize_allocation",
                      "nodeType": "YulIdentifier",
                      "src": "26173:19:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26173:33:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "26173:33:12"
                }
              ]
            },
            "name": "allocate_memory",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "size",
                "nodeType": "YulTypedName",
                "src": "26108:4:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "26117:6:12",
                "type": ""
              }
            ],
            "src": "26083:129:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "26258:35:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "26268:19:12",
                  "value": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "26284:2:12",
                        "type": "",
                        "value": "64"
                      }
                    ],
                    "functionName": {
                      "name": "mload",
                      "nodeType": "YulIdentifier",
                      "src": "26278:5:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26278:9:12"
                  },
                  "variableNames": [
                    {
                      "name": "memPtr",
                      "nodeType": "YulIdentifier",
                      "src": "26268:6:12"
                    }
                  ]
                }
              ]
            },
            "name": "allocate_unbounded",
            "nodeType": "YulFunctionDefinition",
            "returnVariables": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "26251:6:12",
                "type": ""
              }
            ],
            "src": "26218:75:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "26365:241:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "26470:22:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x41",
                            "nodeType": "YulIdentifier",
                            "src": "26472:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "26472:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "26472:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "26442:6:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "26450:18:12",
                        "type": "",
                        "value": "0xffffffffffffffff"
                      }
                    ],
                    "functionName": {
                      "name": "gt",
                      "nodeType": "YulIdentifier",
                      "src": "26439:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26439:30:12"
                  },
                  "nodeType": "YulIf",
                  "src": "26436:2:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "26502:37:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "26532:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "round_up_to_mul_of_32",
                      "nodeType": "YulIdentifier",
                      "src": "26510:21:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26510:29:12"
                  },
                  "variableNames": [
                    {
                      "name": "size",
                      "nodeType": "YulIdentifier",
                      "src": "26502:4:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "26576:23:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "size",
                        "nodeType": "YulIdentifier",
                        "src": "26588:4:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "26594:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "26584:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26584:15:12"
                  },
                  "variableNames": [
                    {
                      "name": "size",
                      "nodeType": "YulIdentifier",
                      "src": "26576:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_allocation_size_t_bytes_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "26349:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "size",
                "nodeType": "YulTypedName",
                "src": "26360:4:12",
                "type": ""
              }
            ],
            "src": "26299:307:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "26683:60:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "26693:11:12",
                  "value": {
                    "name": "ptr",
                    "nodeType": "YulIdentifier",
                    "src": "26701:3:12"
                  },
                  "variableNames": [
                    {
                      "name": "data",
                      "nodeType": "YulIdentifier",
                      "src": "26693:4:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "26714:22:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "ptr",
                        "nodeType": "YulIdentifier",
                        "src": "26726:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "26731:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "26722:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26722:14:12"
                  },
                  "variableNames": [
                    {
                      "name": "data",
                      "nodeType": "YulIdentifier",
                      "src": "26714:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_dataslot_t_array$_t_int256_$dyn_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "ptr",
                "nodeType": "YulTypedName",
                "src": "26670:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "data",
                "nodeType": "YulTypedName",
                "src": "26678:4:12",
                "type": ""
              }
            ],
            "src": "26612:131:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "26822:40:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "26833:22:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "26849:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "mload",
                      "nodeType": "YulIdentifier",
                      "src": "26843:5:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26843:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "length",
                      "nodeType": "YulIdentifier",
                      "src": "26833:6:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_length_t_array$_t_int256_$dyn_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "26805:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "26815:6:12",
                "type": ""
              }
            ],
            "src": "26749:113:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "26926:40:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "26937:22:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "26953:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "mload",
                      "nodeType": "YulIdentifier",
                      "src": "26947:5:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "26947:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "length",
                      "nodeType": "YulIdentifier",
                      "src": "26937:6:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_length_t_bytes_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "26909:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "26919:6:12",
                "type": ""
              }
            ],
            "src": "26868:98:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "27031:40:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "27042:22:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "27058:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "mload",
                      "nodeType": "YulIdentifier",
                      "src": "27052:5:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27052:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "length",
                      "nodeType": "YulIdentifier",
                      "src": "27042:6:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_length_t_string_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "27014:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "27024:6:12",
                "type": ""
              }
            ],
            "src": "26972:99:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "27151:38:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "27161:22:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "ptr",
                        "nodeType": "YulIdentifier",
                        "src": "27173:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "27178:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "27169:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27169:14:12"
                  },
                  "variableNames": [
                    {
                      "name": "next",
                      "nodeType": "YulIdentifier",
                      "src": "27161:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_nextElement_t_array$_t_int256_$dyn_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "ptr",
                "nodeType": "YulTypedName",
                "src": "27138:3:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "next",
                "nodeType": "YulTypedName",
                "src": "27146:4:12",
                "type": ""
              }
            ],
            "src": "27077:112:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "27295:73:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "27312:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "27317:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "27305:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27305:19:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "27305:19:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "27333:29:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "27352:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "27357:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "27348:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27348:14:12"
                  },
                  "variableNames": [
                    {
                      "name": "updated_pos",
                      "nodeType": "YulIdentifier",
                      "src": "27333:11:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_storeLengthForEncoding_t_array$_t_int256_$dyn_memory_ptr",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "27267:3:12",
                "type": ""
              },
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "27272:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "updated_pos",
                "nodeType": "YulTypedName",
                "src": "27283:11:12",
                "type": ""
              }
            ],
            "src": "27195:173:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "27469:73:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "27486:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "27491:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "27479:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27479:19:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "27479:19:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "27507:29:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "27526:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "27531:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "27522:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27522:14:12"
                  },
                  "variableNames": [
                    {
                      "name": "updated_pos",
                      "nodeType": "YulIdentifier",
                      "src": "27507:11:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_storeLengthForEncoding_t_bytes_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "27441:3:12",
                "type": ""
              },
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "27446:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "updated_pos",
                "nodeType": "YulTypedName",
                "src": "27457:11:12",
                "type": ""
              }
            ],
            "src": "27374:168:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "27644:73:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "27661:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "27666:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "27654:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27654:19:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "27654:19:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "27682:29:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "pos",
                        "nodeType": "YulIdentifier",
                        "src": "27701:3:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "27706:4:12",
                        "type": "",
                        "value": "0x20"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "27697:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27697:14:12"
                  },
                  "variableNames": [
                    {
                      "name": "updated_pos",
                      "nodeType": "YulIdentifier",
                      "src": "27682:11:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_storeLengthForEncoding_t_string_memory_ptr_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "27616:3:12",
                "type": ""
              },
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "27621:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "updated_pos",
                "nodeType": "YulTypedName",
                "src": "27632:11:12",
                "type": ""
              }
            ],
            "src": "27548:169:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "27837:34:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "27847:18:12",
                  "value": {
                    "name": "pos",
                    "nodeType": "YulIdentifier",
                    "src": "27862:3:12"
                  },
                  "variableNames": [
                    {
                      "name": "updated_pos",
                      "nodeType": "YulIdentifier",
                      "src": "27847:11:12"
                    }
                  ]
                }
              ]
            },
            "name": "array_storeLengthForEncoding_t_string_memory_ptr_nonPadded_inplace_fromStack",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "pos",
                "nodeType": "YulTypedName",
                "src": "27809:3:12",
                "type": ""
              },
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "27814:6:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "updated_pos",
                "nodeType": "YulTypedName",
                "src": "27825:11:12",
                "type": ""
              }
            ],
            "src": "27723:148:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "27921:261:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "27931:25:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "27954:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "27936:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27936:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "x",
                      "nodeType": "YulIdentifier",
                      "src": "27931:1:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "27965:25:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "27988:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "27970:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "27970:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "y",
                      "nodeType": "YulIdentifier",
                      "src": "27965:1:12"
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "28128:22:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x11",
                            "nodeType": "YulIdentifier",
                            "src": "28130:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "28130:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "28130:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "28049:1:12"
                      },
                      {
                        "arguments": [
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "28056:66:12",
                            "type": "",
                            "value": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                          },
                          {
                            "name": "y",
                            "nodeType": "YulIdentifier",
                            "src": "28124:1:12"
                          }
                        ],
                        "functionName": {
                          "name": "sub",
                          "nodeType": "YulIdentifier",
                          "src": "28052:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "28052:74:12"
                      }
                    ],
                    "functionName": {
                      "name": "gt",
                      "nodeType": "YulIdentifier",
                      "src": "28046:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28046:81:12"
                  },
                  "nodeType": "YulIf",
                  "src": "28043:2:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "28160:16:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "28171:1:12"
                      },
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "28174:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "28167:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28167:9:12"
                  },
                  "variableNames": [
                    {
                      "name": "sum",
                      "nodeType": "YulIdentifier",
                      "src": "28160:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "checked_add_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "x",
                "nodeType": "YulTypedName",
                "src": "27908:1:12",
                "type": ""
              },
              {
                "name": "y",
                "nodeType": "YulTypedName",
                "src": "27911:1:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "sum",
                "nodeType": "YulTypedName",
                "src": "27917:3:12",
                "type": ""
              }
            ],
            "src": "27877:305:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "28230:143:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "28240:25:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "28263:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "28245:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28245:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "x",
                      "nodeType": "YulIdentifier",
                      "src": "28240:1:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "28274:25:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "28297:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "28279:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28279:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "y",
                      "nodeType": "YulIdentifier",
                      "src": "28274:1:12"
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "28321:22:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x12",
                            "nodeType": "YulIdentifier",
                            "src": "28323:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "28323:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "28323:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "28318:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "28311:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28311:9:12"
                  },
                  "nodeType": "YulIf",
                  "src": "28308:2:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "28353:14:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "28362:1:12"
                      },
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "28365:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "div",
                      "nodeType": "YulIdentifier",
                      "src": "28358:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28358:9:12"
                  },
                  "variableNames": [
                    {
                      "name": "r",
                      "nodeType": "YulIdentifier",
                      "src": "28353:1:12"
                    }
                  ]
                }
              ]
            },
            "name": "checked_div_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "x",
                "nodeType": "YulTypedName",
                "src": "28219:1:12",
                "type": ""
              },
              {
                "name": "y",
                "nodeType": "YulTypedName",
                "src": "28222:1:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "r",
                "nodeType": "YulTypedName",
                "src": "28228:1:12",
                "type": ""
              }
            ],
            "src": "28188:185:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "28424:146:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "28434:25:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "28457:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "28439:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28439:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "x",
                      "nodeType": "YulIdentifier",
                      "src": "28434:1:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "28468:25:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "28491:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "28473:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28473:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "y",
                      "nodeType": "YulIdentifier",
                      "src": "28468:1:12"
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "28515:22:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x11",
                            "nodeType": "YulIdentifier",
                            "src": "28517:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "28517:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "28517:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "28509:1:12"
                      },
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "28512:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "lt",
                      "nodeType": "YulIdentifier",
                      "src": "28506:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28506:8:12"
                  },
                  "nodeType": "YulIf",
                  "src": "28503:2:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "28547:17:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "28559:1:12"
                      },
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "28562:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "sub",
                      "nodeType": "YulIdentifier",
                      "src": "28555:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28555:9:12"
                  },
                  "variableNames": [
                    {
                      "name": "diff",
                      "nodeType": "YulIdentifier",
                      "src": "28547:4:12"
                    }
                  ]
                }
              ]
            },
            "name": "checked_sub_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "x",
                "nodeType": "YulTypedName",
                "src": "28410:1:12",
                "type": ""
              },
              {
                "name": "y",
                "nodeType": "YulTypedName",
                "src": "28413:1:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "diff",
                "nodeType": "YulTypedName",
                "src": "28419:4:12",
                "type": ""
              }
            ],
            "src": "28379:191:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "28621:51:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "28631:35:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "28660:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint160",
                      "nodeType": "YulIdentifier",
                      "src": "28642:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28642:24:12"
                  },
                  "variableNames": [
                    {
                      "name": "cleaned",
                      "nodeType": "YulIdentifier",
                      "src": "28631:7:12"
                    }
                  ]
                }
              ]
            },
            "name": "cleanup_t_address",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "28603:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "cleaned",
                "nodeType": "YulTypedName",
                "src": "28613:7:12",
                "type": ""
              }
            ],
            "src": "28576:96:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "28720:48:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "28730:32:12",
                  "value": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "28755:5:12"
                          }
                        ],
                        "functionName": {
                          "name": "iszero",
                          "nodeType": "YulIdentifier",
                          "src": "28748:6:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "28748:13:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "28741:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28741:21:12"
                  },
                  "variableNames": [
                    {
                      "name": "cleaned",
                      "nodeType": "YulIdentifier",
                      "src": "28730:7:12"
                    }
                  ]
                }
              ]
            },
            "name": "cleanup_t_bool",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "28702:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "cleaned",
                "nodeType": "YulTypedName",
                "src": "28712:7:12",
                "type": ""
              }
            ],
            "src": "28678:90:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "28818:105:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "28828:89:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "28843:5:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "28850:66:12",
                        "type": "",
                        "value": "0xffffffff00000000000000000000000000000000000000000000000000000000"
                      }
                    ],
                    "functionName": {
                      "name": "and",
                      "nodeType": "YulIdentifier",
                      "src": "28839:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "28839:78:12"
                  },
                  "variableNames": [
                    {
                      "name": "cleaned",
                      "nodeType": "YulIdentifier",
                      "src": "28828:7:12"
                    }
                  ]
                }
              ]
            },
            "name": "cleanup_t_bytes4",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "28800:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "cleaned",
                "nodeType": "YulTypedName",
                "src": "28810:7:12",
                "type": ""
              }
            ],
            "src": "28774:149:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "28973:32:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "28983:16:12",
                  "value": {
                    "name": "value",
                    "nodeType": "YulIdentifier",
                    "src": "28994:5:12"
                  },
                  "variableNames": [
                    {
                      "name": "cleaned",
                      "nodeType": "YulIdentifier",
                      "src": "28983:7:12"
                    }
                  ]
                }
              ]
            },
            "name": "cleanup_t_int256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "28955:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "cleaned",
                "nodeType": "YulTypedName",
                "src": "28965:7:12",
                "type": ""
              }
            ],
            "src": "28929:76:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "29056:81:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "29066:65:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "29081:5:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "29088:42:12",
                        "type": "",
                        "value": "0xffffffffffffffffffffffffffffffffffffffff"
                      }
                    ],
                    "functionName": {
                      "name": "and",
                      "nodeType": "YulIdentifier",
                      "src": "29077:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29077:54:12"
                  },
                  "variableNames": [
                    {
                      "name": "cleaned",
                      "nodeType": "YulIdentifier",
                      "src": "29066:7:12"
                    }
                  ]
                }
              ]
            },
            "name": "cleanup_t_uint160",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "29038:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "cleaned",
                "nodeType": "YulTypedName",
                "src": "29048:7:12",
                "type": ""
              }
            ],
            "src": "29011:126:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "29188:32:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "29198:16:12",
                  "value": {
                    "name": "value",
                    "nodeType": "YulIdentifier",
                    "src": "29209:5:12"
                  },
                  "variableNames": [
                    {
                      "name": "cleaned",
                      "nodeType": "YulIdentifier",
                      "src": "29198:7:12"
                    }
                  ]
                }
              ]
            },
            "name": "cleanup_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "29170:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "cleaned",
                "nodeType": "YulTypedName",
                "src": "29180:7:12",
                "type": ""
              }
            ],
            "src": "29143:77:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "29277:103:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "name": "dst",
                        "nodeType": "YulIdentifier",
                        "src": "29300:3:12"
                      },
                      {
                        "name": "src",
                        "nodeType": "YulIdentifier",
                        "src": "29305:3:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "29310:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "calldatacopy",
                      "nodeType": "YulIdentifier",
                      "src": "29287:12:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29287:30:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "29287:30:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "dst",
                            "nodeType": "YulIdentifier",
                            "src": "29358:3:12"
                          },
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "29363:6:12"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "29354:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "29354:16:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "29372:1:12",
                        "type": "",
                        "value": "0"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "29347:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29347:27:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "29347:27:12"
                }
              ]
            },
            "name": "copy_calldata_to_memory",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "src",
                "nodeType": "YulTypedName",
                "src": "29259:3:12",
                "type": ""
              },
              {
                "name": "dst",
                "nodeType": "YulTypedName",
                "src": "29264:3:12",
                "type": ""
              },
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "29269:6:12",
                "type": ""
              }
            ],
            "src": "29226:154:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "29435:258:12",
              "statements": [
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "29445:10:12",
                  "value": {
                    "kind": "number",
                    "nodeType": "YulLiteral",
                    "src": "29454:1:12",
                    "type": "",
                    "value": "0"
                  },
                  "variables": [
                    {
                      "name": "i",
                      "nodeType": "YulTypedName",
                      "src": "29449:1:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "29514:63:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "arguments": [
                                {
                                  "name": "dst",
                                  "nodeType": "YulIdentifier",
                                  "src": "29539:3:12"
                                },
                                {
                                  "name": "i",
                                  "nodeType": "YulIdentifier",
                                  "src": "29544:1:12"
                                }
                              ],
                              "functionName": {
                                "name": "add",
                                "nodeType": "YulIdentifier",
                                "src": "29535:3:12"
                              },
                              "nodeType": "YulFunctionCall",
                              "src": "29535:11:12"
                            },
                            {
                              "arguments": [
                                {
                                  "arguments": [
                                    {
                                      "name": "src",
                                      "nodeType": "YulIdentifier",
                                      "src": "29558:3:12"
                                    },
                                    {
                                      "name": "i",
                                      "nodeType": "YulIdentifier",
                                      "src": "29563:1:12"
                                    }
                                  ],
                                  "functionName": {
                                    "name": "add",
                                    "nodeType": "YulIdentifier",
                                    "src": "29554:3:12"
                                  },
                                  "nodeType": "YulFunctionCall",
                                  "src": "29554:11:12"
                                }
                              ],
                              "functionName": {
                                "name": "mload",
                                "nodeType": "YulIdentifier",
                                "src": "29548:5:12"
                              },
                              "nodeType": "YulFunctionCall",
                              "src": "29548:18:12"
                            }
                          ],
                          "functionName": {
                            "name": "mstore",
                            "nodeType": "YulIdentifier",
                            "src": "29528:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "29528:39:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "29528:39:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "i",
                        "nodeType": "YulIdentifier",
                        "src": "29475:1:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "29478:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "lt",
                      "nodeType": "YulIdentifier",
                      "src": "29472:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29472:13:12"
                  },
                  "nodeType": "YulForLoop",
                  "post": {
                    "nodeType": "YulBlock",
                    "src": "29486:19:12",
                    "statements": [
                      {
                        "nodeType": "YulAssignment",
                        "src": "29488:15:12",
                        "value": {
                          "arguments": [
                            {
                              "name": "i",
                              "nodeType": "YulIdentifier",
                              "src": "29497:1:12"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "29500:2:12",
                              "type": "",
                              "value": "32"
                            }
                          ],
                          "functionName": {
                            "name": "add",
                            "nodeType": "YulIdentifier",
                            "src": "29493:3:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "29493:10:12"
                        },
                        "variableNames": [
                          {
                            "name": "i",
                            "nodeType": "YulIdentifier",
                            "src": "29488:1:12"
                          }
                        ]
                      }
                    ]
                  },
                  "pre": {
                    "nodeType": "YulBlock",
                    "src": "29468:3:12",
                    "statements": []
                  },
                  "src": "29464:113:12"
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "29611:76:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "arguments": [
                                {
                                  "name": "dst",
                                  "nodeType": "YulIdentifier",
                                  "src": "29661:3:12"
                                },
                                {
                                  "name": "length",
                                  "nodeType": "YulIdentifier",
                                  "src": "29666:6:12"
                                }
                              ],
                              "functionName": {
                                "name": "add",
                                "nodeType": "YulIdentifier",
                                "src": "29657:3:12"
                              },
                              "nodeType": "YulFunctionCall",
                              "src": "29657:16:12"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "29675:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "mstore",
                            "nodeType": "YulIdentifier",
                            "src": "29650:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "29650:27:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "29650:27:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "i",
                        "nodeType": "YulIdentifier",
                        "src": "29592:1:12"
                      },
                      {
                        "name": "length",
                        "nodeType": "YulIdentifier",
                        "src": "29595:6:12"
                      }
                    ],
                    "functionName": {
                      "name": "gt",
                      "nodeType": "YulIdentifier",
                      "src": "29589:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29589:13:12"
                  },
                  "nodeType": "YulIf",
                  "src": "29586:2:12"
                }
              ]
            },
            "name": "copy_memory_to_memory",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "src",
                "nodeType": "YulTypedName",
                "src": "29417:3:12",
                "type": ""
              },
              {
                "name": "dst",
                "nodeType": "YulTypedName",
                "src": "29422:3:12",
                "type": ""
              },
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "29427:6:12",
                "type": ""
              }
            ],
            "src": "29386:307:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "29750:269:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "29760:22:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "data",
                        "nodeType": "YulIdentifier",
                        "src": "29774:4:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "29780:1:12",
                        "type": "",
                        "value": "2"
                      }
                    ],
                    "functionName": {
                      "name": "div",
                      "nodeType": "YulIdentifier",
                      "src": "29770:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29770:12:12"
                  },
                  "variableNames": [
                    {
                      "name": "length",
                      "nodeType": "YulIdentifier",
                      "src": "29760:6:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "29791:38:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "data",
                        "nodeType": "YulIdentifier",
                        "src": "29821:4:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "29827:1:12",
                        "type": "",
                        "value": "1"
                      }
                    ],
                    "functionName": {
                      "name": "and",
                      "nodeType": "YulIdentifier",
                      "src": "29817:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29817:12:12"
                  },
                  "variables": [
                    {
                      "name": "outOfPlaceEncoding",
                      "nodeType": "YulTypedName",
                      "src": "29795:18:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "29868:51:12",
                    "statements": [
                      {
                        "nodeType": "YulAssignment",
                        "src": "29882:27:12",
                        "value": {
                          "arguments": [
                            {
                              "name": "length",
                              "nodeType": "YulIdentifier",
                              "src": "29896:6:12"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "29904:4:12",
                              "type": "",
                              "value": "0x7f"
                            }
                          ],
                          "functionName": {
                            "name": "and",
                            "nodeType": "YulIdentifier",
                            "src": "29892:3:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "29892:17:12"
                        },
                        "variableNames": [
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "29882:6:12"
                          }
                        ]
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "outOfPlaceEncoding",
                        "nodeType": "YulIdentifier",
                        "src": "29848:18:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "29841:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29841:26:12"
                  },
                  "nodeType": "YulIf",
                  "src": "29838:2:12"
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "29971:42:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x22",
                            "nodeType": "YulIdentifier",
                            "src": "29985:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "29985:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "29985:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "outOfPlaceEncoding",
                        "nodeType": "YulIdentifier",
                        "src": "29935:18:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "length",
                            "nodeType": "YulIdentifier",
                            "src": "29958:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "29966:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "lt",
                          "nodeType": "YulIdentifier",
                          "src": "29955:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "29955:14:12"
                      }
                    ],
                    "functionName": {
                      "name": "eq",
                      "nodeType": "YulIdentifier",
                      "src": "29932:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "29932:38:12"
                  },
                  "nodeType": "YulIf",
                  "src": "29929:2:12"
                }
              ]
            },
            "name": "extract_byte_array_length",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "data",
                "nodeType": "YulTypedName",
                "src": "29734:4:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "length",
                "nodeType": "YulTypedName",
                "src": "29743:6:12",
                "type": ""
              }
            ],
            "src": "29699:320:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "30068:238:12",
              "statements": [
                {
                  "nodeType": "YulVariableDeclaration",
                  "src": "30078:58:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "memPtr",
                        "nodeType": "YulIdentifier",
                        "src": "30100:6:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "size",
                            "nodeType": "YulIdentifier",
                            "src": "30130:4:12"
                          }
                        ],
                        "functionName": {
                          "name": "round_up_to_mul_of_32",
                          "nodeType": "YulIdentifier",
                          "src": "30108:21:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "30108:27:12"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "30096:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30096:40:12"
                  },
                  "variables": [
                    {
                      "name": "newFreePtr",
                      "nodeType": "YulTypedName",
                      "src": "30082:10:12",
                      "type": ""
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "30247:22:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x41",
                            "nodeType": "YulIdentifier",
                            "src": "30249:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "30249:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "30249:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "newFreePtr",
                            "nodeType": "YulIdentifier",
                            "src": "30190:10:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "30202:18:12",
                            "type": "",
                            "value": "0xffffffffffffffff"
                          }
                        ],
                        "functionName": {
                          "name": "gt",
                          "nodeType": "YulIdentifier",
                          "src": "30187:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "30187:34:12"
                      },
                      {
                        "arguments": [
                          {
                            "name": "newFreePtr",
                            "nodeType": "YulIdentifier",
                            "src": "30226:10:12"
                          },
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "30238:6:12"
                          }
                        ],
                        "functionName": {
                          "name": "lt",
                          "nodeType": "YulIdentifier",
                          "src": "30223:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "30223:22:12"
                      }
                    ],
                    "functionName": {
                      "name": "or",
                      "nodeType": "YulIdentifier",
                      "src": "30184:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30184:62:12"
                  },
                  "nodeType": "YulIf",
                  "src": "30181:2:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30285:2:12",
                        "type": "",
                        "value": "64"
                      },
                      {
                        "name": "newFreePtr",
                        "nodeType": "YulIdentifier",
                        "src": "30289:10:12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "30278:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30278:22:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "30278:22:12"
                }
              ]
            },
            "name": "finalize_allocation",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "30054:6:12",
                "type": ""
              },
              {
                "name": "size",
                "nodeType": "YulTypedName",
                "src": "30062:4:12",
                "type": ""
              }
            ],
            "src": "30025:281:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "30355:190:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "30365:33:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "30392:5:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "30374:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30374:24:12"
                  },
                  "variableNames": [
                    {
                      "name": "value",
                      "nodeType": "YulIdentifier",
                      "src": "30365:5:12"
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "30488:22:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x11",
                            "nodeType": "YulIdentifier",
                            "src": "30490:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "30490:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "30490:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "30413:5:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30420:66:12",
                        "type": "",
                        "value": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                      }
                    ],
                    "functionName": {
                      "name": "eq",
                      "nodeType": "YulIdentifier",
                      "src": "30410:2:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30410:77:12"
                  },
                  "nodeType": "YulIf",
                  "src": "30407:2:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "30519:20:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "value",
                        "nodeType": "YulIdentifier",
                        "src": "30530:5:12"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30537:1:12",
                        "type": "",
                        "value": "1"
                      }
                    ],
                    "functionName": {
                      "name": "add",
                      "nodeType": "YulIdentifier",
                      "src": "30526:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30526:13:12"
                  },
                  "variableNames": [
                    {
                      "name": "ret",
                      "nodeType": "YulIdentifier",
                      "src": "30519:3:12"
                    }
                  ]
                }
              ]
            },
            "name": "increment_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "30341:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "ret",
                "nodeType": "YulTypedName",
                "src": "30351:3:12",
                "type": ""
              }
            ],
            "src": "30312:233:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "30585:142:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "30595:25:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "30618:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "30600:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30600:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "x",
                      "nodeType": "YulIdentifier",
                      "src": "30595:1:12"
                    }
                  ]
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "30629:25:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "30652:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "cleanup_t_uint256",
                      "nodeType": "YulIdentifier",
                      "src": "30634:17:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30634:20:12"
                  },
                  "variableNames": [
                    {
                      "name": "y",
                      "nodeType": "YulIdentifier",
                      "src": "30629:1:12"
                    }
                  ]
                },
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "30676:22:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [],
                          "functionName": {
                            "name": "panic_error_0x12",
                            "nodeType": "YulIdentifier",
                            "src": "30678:16:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "30678:18:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "30678:18:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "30673:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "30666:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30666:9:12"
                  },
                  "nodeType": "YulIf",
                  "src": "30663:2:12"
                },
                {
                  "nodeType": "YulAssignment",
                  "src": "30707:14:12",
                  "value": {
                    "arguments": [
                      {
                        "name": "x",
                        "nodeType": "YulIdentifier",
                        "src": "30716:1:12"
                      },
                      {
                        "name": "y",
                        "nodeType": "YulIdentifier",
                        "src": "30719:1:12"
                      }
                    ],
                    "functionName": {
                      "name": "mod",
                      "nodeType": "YulIdentifier",
                      "src": "30712:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30712:9:12"
                  },
                  "variableNames": [
                    {
                      "name": "r",
                      "nodeType": "YulIdentifier",
                      "src": "30707:1:12"
                    }
                  ]
                }
              ]
            },
            "name": "mod_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "x",
                "nodeType": "YulTypedName",
                "src": "30574:1:12",
                "type": ""
              },
              {
                "name": "y",
                "nodeType": "YulTypedName",
                "src": "30577:1:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "r",
                "nodeType": "YulTypedName",
                "src": "30583:1:12",
                "type": ""
              }
            ],
            "src": "30551:176:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "30761:152:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30778:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30781:77:12",
                        "type": "",
                        "value": "35408467139433450592217433187231851964531694900788300625387963629091585785856"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "30771:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30771:88:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "30771:88:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30875:1:12",
                        "type": "",
                        "value": "4"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30878:4:12",
                        "type": "",
                        "value": "0x11"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "30868:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30868:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "30868:15:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30899:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30902:4:12",
                        "type": "",
                        "value": "0x24"
                      }
                    ],
                    "functionName": {
                      "name": "revert",
                      "nodeType": "YulIdentifier",
                      "src": "30892:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30892:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "30892:15:12"
                }
              ]
            },
            "name": "panic_error_0x11",
            "nodeType": "YulFunctionDefinition",
            "src": "30733:180:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "30947:152:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30964:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "30967:77:12",
                        "type": "",
                        "value": "35408467139433450592217433187231851964531694900788300625387963629091585785856"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "30957:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "30957:88:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "30957:88:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31061:1:12",
                        "type": "",
                        "value": "4"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31064:4:12",
                        "type": "",
                        "value": "0x12"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "31054:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31054:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31054:15:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31085:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31088:4:12",
                        "type": "",
                        "value": "0x24"
                      }
                    ],
                    "functionName": {
                      "name": "revert",
                      "nodeType": "YulIdentifier",
                      "src": "31078:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31078:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31078:15:12"
                }
              ]
            },
            "name": "panic_error_0x12",
            "nodeType": "YulFunctionDefinition",
            "src": "30919:180:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "31133:152:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31150:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31153:77:12",
                        "type": "",
                        "value": "35408467139433450592217433187231851964531694900788300625387963629091585785856"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "31143:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31143:88:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31143:88:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31247:1:12",
                        "type": "",
                        "value": "4"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31250:4:12",
                        "type": "",
                        "value": "0x22"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "31240:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31240:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31240:15:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31271:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31274:4:12",
                        "type": "",
                        "value": "0x24"
                      }
                    ],
                    "functionName": {
                      "name": "revert",
                      "nodeType": "YulIdentifier",
                      "src": "31264:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31264:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31264:15:12"
                }
              ]
            },
            "name": "panic_error_0x22",
            "nodeType": "YulFunctionDefinition",
            "src": "31105:180:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "31319:152:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31336:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31339:77:12",
                        "type": "",
                        "value": "35408467139433450592217433187231851964531694900788300625387963629091585785856"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "31329:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31329:88:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31329:88:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31433:1:12",
                        "type": "",
                        "value": "4"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31436:4:12",
                        "type": "",
                        "value": "0x41"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "31426:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31426:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31426:15:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31457:1:12",
                        "type": "",
                        "value": "0"
                      },
                      {
                        "kind": "number",
                        "nodeType": "YulLiteral",
                        "src": "31460:4:12",
                        "type": "",
                        "value": "0x24"
                      }
                    ],
                    "functionName": {
                      "name": "revert",
                      "nodeType": "YulIdentifier",
                      "src": "31450:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31450:15:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31450:15:12"
                }
              ]
            },
            "name": "panic_error_0x41",
            "nodeType": "YulFunctionDefinition",
            "src": "31291:180:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "31525:54:12",
              "statements": [
                {
                  "nodeType": "YulAssignment",
                  "src": "31535:38:12",
                  "value": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "31553:5:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "31560:2:12",
                            "type": "",
                            "value": "31"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "31549:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "31549:14:12"
                      },
                      {
                        "arguments": [
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "31569:2:12",
                            "type": "",
                            "value": "31"
                          }
                        ],
                        "functionName": {
                          "name": "not",
                          "nodeType": "YulIdentifier",
                          "src": "31565:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "31565:7:12"
                      }
                    ],
                    "functionName": {
                      "name": "and",
                      "nodeType": "YulIdentifier",
                      "src": "31545:3:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31545:28:12"
                  },
                  "variableNames": [
                    {
                      "name": "result",
                      "nodeType": "YulIdentifier",
                      "src": "31535:6:12"
                    }
                  ]
                }
              ]
            },
            "name": "round_up_to_mul_of_32",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "31508:5:12",
                "type": ""
              }
            ],
            "returnVariables": [
              {
                "name": "result",
                "nodeType": "YulTypedName",
                "src": "31518:6:12",
                "type": ""
              }
            ],
            "src": "31477:102:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "31691:131:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "31713:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "31721:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "31709:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "31709:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "31725:34:12",
                        "type": "",
                        "value": "ERC721: transfer to non ERC721Re"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "31702:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31702:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31702:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "31781:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "31789:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "31777:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "31777:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "31794:20:12",
                        "type": "",
                        "value": "ceiver implementer"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "31770:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31770:45:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31770:45:12"
                }
              ]
            },
            "name": "store_literal_in_memory_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "31683:6:12",
                "type": ""
              }
            ],
            "src": "31585:237:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "31934:119:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "31956:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "31964:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "31952:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "31952:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "31968:34:12",
                        "type": "",
                        "value": "Ownable: new owner is the zero a"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "31945:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "31945:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "31945:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "32024:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "32032:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "32020:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "32020:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "32037:8:12",
                        "type": "",
                        "value": "ddress"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "32013:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "32013:33:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "32013:33:12"
                }
              ]
            },
            "name": "store_literal_in_memory_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "31926:6:12",
                "type": ""
              }
            ],
            "src": "31828:225:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "32165:118:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "32187:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "32195:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "32183:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "32183:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "32199:34:12",
                        "type": "",
                        "value": "ERC721: transfer from incorrect "
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "32176:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "32176:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "32176:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "32255:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "32263:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "32251:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "32251:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "32268:7:12",
                        "type": "",
                        "value": "owner"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "32244:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "32244:32:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "32244:32:12"
                }
              ]
            },
            "name": "store_literal_in_memory_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "32157:6:12",
                "type": ""
              }
            ],
            "src": "32059:224:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "32395:72:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "32417:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "32425:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "32413:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "32413:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "32429:30:12",
                        "type": "",
                        "value": "ERC721: token already minted"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "32406:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "32406:54:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "32406:54:12"
                }
              ]
            },
            "name": "store_literal_in_memory_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "32387:6:12",
                "type": ""
              }
            ],
            "src": "32289:178:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "32579:117:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "32601:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "32609:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "32597:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "32597:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "32613:34:12",
                        "type": "",
                        "value": "ERC721: transfer to the zero add"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "32590:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "32590:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "32590:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "32669:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "32677:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "32665:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "32665:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "32682:6:12",
                        "type": "",
                        "value": "ress"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "32658:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "32658:31:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "32658:31:12"
                }
              ]
            },
            "name": "store_literal_in_memory_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "32571:6:12",
                "type": ""
              }
            ],
            "src": "32473:223:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "32808:69:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "32830:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "32838:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "32826:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "32826:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "32842:27:12",
                        "type": "",
                        "value": "ERC721: approve to caller"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "32819:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "32819:51:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "32819:51:12"
                }
              ]
            },
            "name": "store_literal_in_memory_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "32800:6:12",
                "type": ""
              }
            ],
            "src": "32702:175:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "32989:125:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33011:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33019:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33007:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33007:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33023:34:12",
                        "type": "",
                        "value": "ERC721: operator query for nonex"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33000:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33000:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33000:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33079:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33087:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33075:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33075:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33092:14:12",
                        "type": "",
                        "value": "istent token"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33068:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33068:39:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33068:39:12"
                }
              ]
            },
            "name": "store_literal_in_memory_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "32981:6:12",
                "type": ""
              }
            ],
            "src": "32883:231:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "33226:137:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33248:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33256:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33244:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33244:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33260:34:12",
                        "type": "",
                        "value": "ERC721: approve caller is not ow"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33237:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33237:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33237:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33316:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33324:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33312:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33312:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33329:26:12",
                        "type": "",
                        "value": "ner nor approved for all"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33305:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33305:51:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33305:51:12"
                }
              ]
            },
            "name": "store_literal_in_memory_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "33218:6:12",
                "type": ""
              }
            ],
            "src": "33120:243:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "33475:123:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33497:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33505:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33493:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33493:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33509:34:12",
                        "type": "",
                        "value": "ERC721: balance query for the ze"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33486:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33486:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33486:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33565:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33573:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33561:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33561:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33578:12:12",
                        "type": "",
                        "value": "ro address"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33554:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33554:37:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33554:37:12"
                }
              ]
            },
            "name": "store_literal_in_memory_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "33467:6:12",
                "type": ""
              }
            ],
            "src": "33369:229:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "33710:122:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33732:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33740:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33728:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33728:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33744:34:12",
                        "type": "",
                        "value": "ERC721: owner query for nonexist"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33721:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33721:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33721:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33800:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33808:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33796:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33796:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33813:11:12",
                        "type": "",
                        "value": "ent token"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33789:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33789:36:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33789:36:12"
                }
              ]
            },
            "name": "store_literal_in_memory_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "33702:6:12",
                "type": ""
              }
            ],
            "src": "33604:228:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "33944:76:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "33966:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "33974:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "33962:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "33962:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "33978:34:12",
                        "type": "",
                        "value": "ERC721: mint to the zero address"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "33955:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "33955:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "33955:58:12"
                }
              ]
            },
            "name": "store_literal_in_memory_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "33936:6:12",
                "type": ""
              }
            ],
            "src": "33838:182:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "34132:125:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "34154:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "34162:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "34150:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "34150:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "34166:34:12",
                        "type": "",
                        "value": "ERC721: approved query for nonex"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "34143:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "34143:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "34143:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "34222:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "34230:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "34218:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "34218:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "34235:14:12",
                        "type": "",
                        "value": "istent token"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "34211:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "34211:39:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "34211:39:12"
                }
              ]
            },
            "name": "store_literal_in_memory_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "34124:6:12",
                "type": ""
              }
            ],
            "src": "34026:231:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "34369:76:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "34391:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "34399:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "34387:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "34387:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "34403:34:12",
                        "type": "",
                        "value": "Ownable: caller is not the owner"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "34380:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "34380:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "34380:58:12"
                }
              ]
            },
            "name": "store_literal_in_memory_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "34361:6:12",
                "type": ""
              }
            ],
            "src": "34263:182:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "34557:128:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "34579:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "34587:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "34575:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "34575:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "34591:34:12",
                        "type": "",
                        "value": "ERC721Metadata: URI query for no"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "34568:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "34568:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "34568:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "34647:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "34655:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "34643:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "34643:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "34660:17:12",
                        "type": "",
                        "value": "nexistent token"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "34636:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "34636:42:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "34636:42:12"
                }
              ]
            },
            "name": "store_literal_in_memory_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "34549:6:12",
                "type": ""
              }
            ],
            "src": "34451:234:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "34797:114:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "34819:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "34827:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "34815:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "34815:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "34831:34:12",
                        "type": "",
                        "value": "ERC721: approval to current owne"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "34808:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "34808:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "34808:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "34887:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "34895:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "34883:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "34883:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "34900:3:12",
                        "type": "",
                        "value": "r"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "34876:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "34876:28:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "34876:28:12"
                }
              ]
            },
            "name": "store_literal_in_memory_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "34789:6:12",
                "type": ""
              }
            ],
            "src": "34691:220:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "35023:130:12",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "35045:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "35053:1:12",
                            "type": "",
                            "value": "0"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "35041:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "35041:14:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "35057:34:12",
                        "type": "",
                        "value": "ERC721: transfer caller is not o"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "35034:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "35034:58:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "35034:58:12"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "memPtr",
                            "nodeType": "YulIdentifier",
                            "src": "35113:6:12"
                          },
                          {
                            "kind": "number",
                            "nodeType": "YulLiteral",
                            "src": "35121:2:12",
                            "type": "",
                            "value": "32"
                          }
                        ],
                        "functionName": {
                          "name": "add",
                          "nodeType": "YulIdentifier",
                          "src": "35109:3:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "35109:15:12"
                      },
                      {
                        "kind": "string",
                        "nodeType": "YulLiteral",
                        "src": "35126:19:12",
                        "type": "",
                        "value": "wner nor approved"
                      }
                    ],
                    "functionName": {
                      "name": "mstore",
                      "nodeType": "YulIdentifier",
                      "src": "35102:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "35102:44:12"
                  },
                  "nodeType": "YulExpressionStatement",
                  "src": "35102:44:12"
                }
              ]
            },
            "name": "store_literal_in_memory_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "memPtr",
                "nodeType": "YulTypedName",
                "src": "35015:6:12",
                "type": ""
              }
            ],
            "src": "34917:236:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "35202:79:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "35259:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "35268:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "35271:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "35261:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "35261:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "35261:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "35225:5:12"
                          },
                          {
                            "arguments": [
                              {
                                "name": "value",
                                "nodeType": "YulIdentifier",
                                "src": "35250:5:12"
                              }
                            ],
                            "functionName": {
                              "name": "cleanup_t_address",
                              "nodeType": "YulIdentifier",
                              "src": "35232:17:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "35232:24:12"
                          }
                        ],
                        "functionName": {
                          "name": "eq",
                          "nodeType": "YulIdentifier",
                          "src": "35222:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "35222:35:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "35215:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "35215:43:12"
                  },
                  "nodeType": "YulIf",
                  "src": "35212:2:12"
                }
              ]
            },
            "name": "validator_revert_t_address",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "35195:5:12",
                "type": ""
              }
            ],
            "src": "35159:122:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "35327:76:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "35381:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "35390:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "35393:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "35383:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "35383:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "35383:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "35350:5:12"
                          },
                          {
                            "arguments": [
                              {
                                "name": "value",
                                "nodeType": "YulIdentifier",
                                "src": "35372:5:12"
                              }
                            ],
                            "functionName": {
                              "name": "cleanup_t_bool",
                              "nodeType": "YulIdentifier",
                              "src": "35357:14:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "35357:21:12"
                          }
                        ],
                        "functionName": {
                          "name": "eq",
                          "nodeType": "YulIdentifier",
                          "src": "35347:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "35347:32:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "35340:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "35340:40:12"
                  },
                  "nodeType": "YulIf",
                  "src": "35337:2:12"
                }
              ]
            },
            "name": "validator_revert_t_bool",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "35320:5:12",
                "type": ""
              }
            ],
            "src": "35287:116:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "35451:78:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "35507:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "35516:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "35519:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "35509:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "35509:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "35509:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "35474:5:12"
                          },
                          {
                            "arguments": [
                              {
                                "name": "value",
                                "nodeType": "YulIdentifier",
                                "src": "35498:5:12"
                              }
                            ],
                            "functionName": {
                              "name": "cleanup_t_bytes4",
                              "nodeType": "YulIdentifier",
                              "src": "35481:16:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "35481:23:12"
                          }
                        ],
                        "functionName": {
                          "name": "eq",
                          "nodeType": "YulIdentifier",
                          "src": "35471:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "35471:34:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "35464:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "35464:42:12"
                  },
                  "nodeType": "YulIf",
                  "src": "35461:2:12"
                }
              ]
            },
            "name": "validator_revert_t_bytes4",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "35444:5:12",
                "type": ""
              }
            ],
            "src": "35409:120:12"
          },
          {
            "body": {
              "nodeType": "YulBlock",
              "src": "35578:79:12",
              "statements": [
                {
                  "body": {
                    "nodeType": "YulBlock",
                    "src": "35635:16:12",
                    "statements": [
                      {
                        "expression": {
                          "arguments": [
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "35644:1:12",
                              "type": "",
                              "value": "0"
                            },
                            {
                              "kind": "number",
                              "nodeType": "YulLiteral",
                              "src": "35647:1:12",
                              "type": "",
                              "value": "0"
                            }
                          ],
                          "functionName": {
                            "name": "revert",
                            "nodeType": "YulIdentifier",
                            "src": "35637:6:12"
                          },
                          "nodeType": "YulFunctionCall",
                          "src": "35637:12:12"
                        },
                        "nodeType": "YulExpressionStatement",
                        "src": "35637:12:12"
                      }
                    ]
                  },
                  "condition": {
                    "arguments": [
                      {
                        "arguments": [
                          {
                            "name": "value",
                            "nodeType": "YulIdentifier",
                            "src": "35601:5:12"
                          },
                          {
                            "arguments": [
                              {
                                "name": "value",
                                "nodeType": "YulIdentifier",
                                "src": "35626:5:12"
                              }
                            ],
                            "functionName": {
                              "name": "cleanup_t_uint256",
                              "nodeType": "YulIdentifier",
                              "src": "35608:17:12"
                            },
                            "nodeType": "YulFunctionCall",
                            "src": "35608:24:12"
                          }
                        ],
                        "functionName": {
                          "name": "eq",
                          "nodeType": "YulIdentifier",
                          "src": "35598:2:12"
                        },
                        "nodeType": "YulFunctionCall",
                        "src": "35598:35:12"
                      }
                    ],
                    "functionName": {
                      "name": "iszero",
                      "nodeType": "YulIdentifier",
                      "src": "35591:6:12"
                    },
                    "nodeType": "YulFunctionCall",
                    "src": "35591:43:12"
                  },
                  "nodeType": "YulIf",
                  "src": "35588:2:12"
                }
              ]
            },
            "name": "validator_revert_t_uint256",
            "nodeType": "YulFunctionDefinition",
            "parameters": [
              {
                "name": "value",
                "nodeType": "YulTypedName",
                "src": "35571:5:12",
                "type": ""
              }
            ],
            "src": "35535:122:12"
          }
        ]
      },
      "contents": "{\n\n    function abi_decode_available_length_t_bytes_memory_ptr(src, length, end) -> array {\n        array := allocate_memory(array_allocation_size_t_bytes_memory_ptr(length))\n        mstore(array, length)\n        let dst := add(array, 0x20)\n        if gt(add(src, length), end) { revert(0, 0) }\n        copy_calldata_to_memory(src, dst, length)\n    }\n\n    function abi_decode_t_address(offset, end) -> value {\n        value := calldataload(offset)\n        validator_revert_t_address(value)\n    }\n\n    // int256[]\n    function abi_decode_t_array$_t_int256_$dyn_calldata_ptr(offset, end) -> arrayPos, length {\n        if iszero(slt(add(offset, 0x1f), end)) { revert(0, 0) }\n        length := calldataload(offset)\n        if gt(length, 0xffffffffffffffff) { revert(0, 0) }\n        arrayPos := add(offset, 0x20)\n        if gt(add(arrayPos, mul(length, 0x20)), end) { revert(0, 0) }\n    }\n\n    function abi_decode_t_bool(offset, end) -> value {\n        value := calldataload(offset)\n        validator_revert_t_bool(value)\n    }\n\n    function abi_decode_t_bytes4(offset, end) -> value {\n        value := calldataload(offset)\n        validator_revert_t_bytes4(value)\n    }\n\n    function abi_decode_t_bytes4_fromMemory(offset, end) -> value {\n        value := mload(offset)\n        validator_revert_t_bytes4(value)\n    }\n\n    // bytes\n    function abi_decode_t_bytes_memory_ptr(offset, end) -> array {\n        if iszero(slt(add(offset, 0x1f), end)) { revert(0, 0) }\n        let length := calldataload(offset)\n        array := abi_decode_available_length_t_bytes_memory_ptr(add(offset, 0x20), length, end)\n    }\n\n    function abi_decode_t_uint256(offset, end) -> value {\n        value := calldataload(offset)\n        validator_revert_t_uint256(value)\n    }\n\n    function abi_decode_tuple_t_address(headStart, dataEnd) -> value0 {\n        if slt(sub(dataEnd, headStart), 32) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_addresst_address(headStart, dataEnd) -> value0, value1 {\n        if slt(sub(dataEnd, headStart), 64) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 32\n\n            value1 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_addresst_addresst_uint256(headStart, dataEnd) -> value0, value1, value2 {\n        if slt(sub(dataEnd, headStart), 96) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 32\n\n            value1 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 64\n\n            value2 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_addresst_addresst_uint256t_bytes_memory_ptr(headStart, dataEnd) -> value0, value1, value2, value3 {\n        if slt(sub(dataEnd, headStart), 128) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 32\n\n            value1 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 64\n\n            value2 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := calldataload(add(headStart, 96))\n            if gt(offset, 0xffffffffffffffff) { revert(0, 0) }\n\n            value3 := abi_decode_t_bytes_memory_ptr(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_addresst_bool(headStart, dataEnd) -> value0, value1 {\n        if slt(sub(dataEnd, headStart), 64) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 32\n\n            value1 := abi_decode_t_bool(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_addresst_uint256(headStart, dataEnd) -> value0, value1 {\n        if slt(sub(dataEnd, headStart), 64) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 32\n\n            value1 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_addresst_uint256t_uint256t_array$_t_int256_$dyn_calldata_ptr(headStart, dataEnd) -> value0, value1, value2, value3, value4 {\n        if slt(sub(dataEnd, headStart), 128) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 32\n\n            value1 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 64\n\n            value2 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := calldataload(add(headStart, 96))\n            if gt(offset, 0xffffffffffffffff) { revert(0, 0) }\n\n            value3, value4 := abi_decode_t_array$_t_int256_$dyn_calldata_ptr(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_addresst_uint256t_uint256t_uint256t_array$_t_int256_$dyn_calldata_ptr(headStart, dataEnd) -> value0, value1, value2, value3, value4, value5 {\n        if slt(sub(dataEnd, headStart), 160) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_address(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 32\n\n            value1 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 64\n\n            value2 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := 96\n\n            value3 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n        {\n\n            let offset := calldataload(add(headStart, 128))\n            if gt(offset, 0xffffffffffffffff) { revert(0, 0) }\n\n            value4, value5 := abi_decode_t_array$_t_int256_$dyn_calldata_ptr(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_bytes4(headStart, dataEnd) -> value0 {\n        if slt(sub(dataEnd, headStart), 32) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_bytes4(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_bytes4_fromMemory(headStart, dataEnd) -> value0 {\n        if slt(sub(dataEnd, headStart), 32) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_bytes4_fromMemory(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_decode_tuple_t_uint256(headStart, dataEnd) -> value0 {\n        if slt(sub(dataEnd, headStart), 32) { revert(0, 0) }\n\n        {\n\n            let offset := 0\n\n            value0 := abi_decode_t_uint256(add(headStart, offset), dataEnd)\n        }\n\n    }\n\n    function abi_encodeUpdatedPos_t_int256_to_t_int256(value0, pos) -> updatedPos {\n        abi_encode_t_int256_to_t_int256(value0, pos)\n        updatedPos := add(pos, 0x20)\n    }\n\n    function abi_encode_t_address_to_t_address_fromStack(value, pos) {\n        mstore(pos, cleanup_t_address(value))\n    }\n\n    // int256[] -> int256[]\n    function abi_encode_t_array$_t_int256_$dyn_memory_ptr_to_t_array$_t_int256_$dyn_memory_ptr(value, pos)  -> end  {\n        let length := array_length_t_array$_t_int256_$dyn_memory_ptr(value)\n        pos := array_storeLengthForEncoding_t_array$_t_int256_$dyn_memory_ptr(pos, length)\n        let baseRef := array_dataslot_t_array$_t_int256_$dyn_memory_ptr(value)\n        let srcPtr := baseRef\n        for { let i := 0 } lt(i, length) { i := add(i, 1) }\n        {\n            let elementValue0 := mload(srcPtr)\n            pos := abi_encodeUpdatedPos_t_int256_to_t_int256(elementValue0, pos)\n            srcPtr := array_nextElement_t_array$_t_int256_$dyn_memory_ptr(srcPtr)\n        }\n        end := pos\n    }\n\n    function abi_encode_t_bool_to_t_bool_fromStack(value, pos) {\n        mstore(pos, cleanup_t_bool(value))\n    }\n\n    function abi_encode_t_bytes_memory_ptr_to_t_bytes_memory_ptr_fromStack(value, pos) -> end {\n        let length := array_length_t_bytes_memory_ptr(value)\n        pos := array_storeLengthForEncoding_t_bytes_memory_ptr_fromStack(pos, length)\n        copy_memory_to_memory(add(value, 0x20), pos, length)\n        end := add(pos, round_up_to_mul_of_32(length))\n    }\n\n    function abi_encode_t_int256_to_t_int256(value, pos) {\n        mstore(pos, cleanup_t_int256(value))\n    }\n\n    function abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_fromStack(value, pos) -> end {\n        let length := array_length_t_string_memory_ptr(value)\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, length)\n        copy_memory_to_memory(add(value, 0x20), pos, length)\n        end := add(pos, round_up_to_mul_of_32(length))\n    }\n\n    function abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack(value, pos) -> end {\n        let length := array_length_t_string_memory_ptr(value)\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_nonPadded_inplace_fromStack(pos, length)\n        copy_memory_to_memory(add(value, 0x20), pos, length)\n        end := add(pos, length)\n    }\n\n    function abi_encode_t_stringliteral_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 50)\n        store_literal_in_memory_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 38)\n        store_literal_in_memory_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 37)\n        store_literal_in_memory_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 28)\n        store_literal_in_memory_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57(pos)\n        end := add(pos, 32)\n    }\n\n    function abi_encode_t_stringliteral_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 36)\n        store_literal_in_memory_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 25)\n        store_literal_in_memory_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05(pos)\n        end := add(pos, 32)\n    }\n\n    function abi_encode_t_stringliteral_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 44)\n        store_literal_in_memory_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 56)\n        store_literal_in_memory_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 42)\n        store_literal_in_memory_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 41)\n        store_literal_in_memory_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 32)\n        store_literal_in_memory_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6(pos)\n        end := add(pos, 32)\n    }\n\n    function abi_encode_t_stringliteral_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 44)\n        store_literal_in_memory_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 32)\n        store_literal_in_memory_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe(pos)\n        end := add(pos, 32)\n    }\n\n    function abi_encode_t_stringliteral_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 47)\n        store_literal_in_memory_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 33)\n        store_literal_in_memory_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942(pos)\n        end := add(pos, 64)\n    }\n\n    function abi_encode_t_stringliteral_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2_to_t_string_memory_ptr_fromStack(pos) -> end {\n        pos := array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, 49)\n        store_literal_in_memory_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2(pos)\n        end := add(pos, 64)\n    }\n\n    // struct AnonFTFactory.IdentityData -> struct AnonFTFactory.IdentityData\n    function abi_encode_t_struct$_IdentityData_$1782_memory_ptr_to_t_struct$_IdentityData_$1782_memory_ptr_fromStack(value, pos)  -> end  {\n        let tail := add(pos, 0x60)\n\n        {\n            // n\n\n            let memberValue0 := mload(add(value, 0x00))\n            abi_encode_t_uint256_to_t_uint256(memberValue0, add(pos, 0x00))\n        }\n\n        {\n            // k\n\n            let memberValue0 := mload(add(value, 0x20))\n            abi_encode_t_uint256_to_t_uint256(memberValue0, add(pos, 0x20))\n        }\n\n        {\n            // identifiers\n\n            let memberValue0 := mload(add(value, 0x40))\n\n            mstore(add(pos, 0x40), sub(tail, pos))\n            tail := abi_encode_t_array$_t_int256_$dyn_memory_ptr_to_t_array$_t_int256_$dyn_memory_ptr(memberValue0, tail)\n\n        }\n\n        end := tail\n    }\n\n    function abi_encode_t_uint256_to_t_uint256(value, pos) {\n        mstore(pos, cleanup_t_uint256(value))\n    }\n\n    function abi_encode_t_uint256_to_t_uint256_fromStack(value, pos) {\n        mstore(pos, cleanup_t_uint256(value))\n    }\n\n    function abi_encode_tuple_packed_t_string_memory_ptr_t_string_memory_ptr__to_t_string_memory_ptr_t_string_memory_ptr__nonPadded_inplace_fromStack_reversed(pos , value1, value0) -> end {\n\n        pos := abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack(value0,  pos)\n\n        pos := abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_nonPadded_inplace_fromStack(value1,  pos)\n\n        end := pos\n    }\n\n    function abi_encode_tuple_t_address__to_t_address__fromStack_reversed(headStart , value0) -> tail {\n        tail := add(headStart, 32)\n\n        abi_encode_t_address_to_t_address_fromStack(value0,  add(headStart, 0))\n\n    }\n\n    function abi_encode_tuple_t_address_t_address_t_uint256_t_bytes_memory_ptr__to_t_address_t_address_t_uint256_t_bytes_memory_ptr__fromStack_reversed(headStart , value3, value2, value1, value0) -> tail {\n        tail := add(headStart, 128)\n\n        abi_encode_t_address_to_t_address_fromStack(value0,  add(headStart, 0))\n\n        abi_encode_t_address_to_t_address_fromStack(value1,  add(headStart, 32))\n\n        abi_encode_t_uint256_to_t_uint256_fromStack(value2,  add(headStart, 64))\n\n        mstore(add(headStart, 96), sub(tail, headStart))\n        tail := abi_encode_t_bytes_memory_ptr_to_t_bytes_memory_ptr_fromStack(value3,  tail)\n\n    }\n\n    function abi_encode_tuple_t_bool__to_t_bool__fromStack_reversed(headStart , value0) -> tail {\n        tail := add(headStart, 32)\n\n        abi_encode_t_bool_to_t_bool_fromStack(value0,  add(headStart, 0))\n\n    }\n\n    function abi_encode_tuple_t_string_memory_ptr__to_t_string_memory_ptr__fromStack_reversed(headStart , value0) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_string_memory_ptr_to_t_string_memory_ptr_fromStack(value0,  tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_stringliteral_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2__to_t_string_memory_ptr__fromStack_reversed(headStart ) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_stringliteral_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2_to_t_string_memory_ptr_fromStack( tail)\n\n    }\n\n    function abi_encode_tuple_t_struct$_IdentityData_$1782_memory_ptr__to_t_struct$_IdentityData_$1782_memory_ptr__fromStack_reversed(headStart , value0) -> tail {\n        tail := add(headStart, 32)\n\n        mstore(add(headStart, 0), sub(tail, headStart))\n        tail := abi_encode_t_struct$_IdentityData_$1782_memory_ptr_to_t_struct$_IdentityData_$1782_memory_ptr_fromStack(value0,  tail)\n\n    }\n\n    function abi_encode_tuple_t_uint256__to_t_uint256__fromStack_reversed(headStart , value0) -> tail {\n        tail := add(headStart, 32)\n\n        abi_encode_t_uint256_to_t_uint256_fromStack(value0,  add(headStart, 0))\n\n    }\n\n    function allocate_memory(size) -> memPtr {\n        memPtr := allocate_unbounded()\n        finalize_allocation(memPtr, size)\n    }\n\n    function allocate_unbounded() -> memPtr {\n        memPtr := mload(64)\n    }\n\n    function array_allocation_size_t_bytes_memory_ptr(length) -> size {\n        // Make sure we can allocate memory without overflow\n        if gt(length, 0xffffffffffffffff) { panic_error_0x41() }\n\n        size := round_up_to_mul_of_32(length)\n\n        // add length slot\n        size := add(size, 0x20)\n\n    }\n\n    function array_dataslot_t_array$_t_int256_$dyn_memory_ptr(ptr) -> data {\n        data := ptr\n\n        data := add(ptr, 0x20)\n\n    }\n\n    function array_length_t_array$_t_int256_$dyn_memory_ptr(value) -> length {\n\n        length := mload(value)\n\n    }\n\n    function array_length_t_bytes_memory_ptr(value) -> length {\n\n        length := mload(value)\n\n    }\n\n    function array_length_t_string_memory_ptr(value) -> length {\n\n        length := mload(value)\n\n    }\n\n    function array_nextElement_t_array$_t_int256_$dyn_memory_ptr(ptr) -> next {\n        next := add(ptr, 0x20)\n    }\n\n    function array_storeLengthForEncoding_t_array$_t_int256_$dyn_memory_ptr(pos, length) -> updated_pos {\n        mstore(pos, length)\n        updated_pos := add(pos, 0x20)\n    }\n\n    function array_storeLengthForEncoding_t_bytes_memory_ptr_fromStack(pos, length) -> updated_pos {\n        mstore(pos, length)\n        updated_pos := add(pos, 0x20)\n    }\n\n    function array_storeLengthForEncoding_t_string_memory_ptr_fromStack(pos, length) -> updated_pos {\n        mstore(pos, length)\n        updated_pos := add(pos, 0x20)\n    }\n\n    function array_storeLengthForEncoding_t_string_memory_ptr_nonPadded_inplace_fromStack(pos, length) -> updated_pos {\n        updated_pos := pos\n    }\n\n    function checked_add_t_uint256(x, y) -> sum {\n        x := cleanup_t_uint256(x)\n        y := cleanup_t_uint256(y)\n\n        // overflow, if x > (maxValue - y)\n        if gt(x, sub(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, y)) { panic_error_0x11() }\n\n        sum := add(x, y)\n    }\n\n    function checked_div_t_uint256(x, y) -> r {\n        x := cleanup_t_uint256(x)\n        y := cleanup_t_uint256(y)\n        if iszero(y) { panic_error_0x12() }\n\n        r := div(x, y)\n    }\n\n    function checked_sub_t_uint256(x, y) -> diff {\n        x := cleanup_t_uint256(x)\n        y := cleanup_t_uint256(y)\n\n        if lt(x, y) { panic_error_0x11() }\n\n        diff := sub(x, y)\n    }\n\n    function cleanup_t_address(value) -> cleaned {\n        cleaned := cleanup_t_uint160(value)\n    }\n\n    function cleanup_t_bool(value) -> cleaned {\n        cleaned := iszero(iszero(value))\n    }\n\n    function cleanup_t_bytes4(value) -> cleaned {\n        cleaned := and(value, 0xffffffff00000000000000000000000000000000000000000000000000000000)\n    }\n\n    function cleanup_t_int256(value) -> cleaned {\n        cleaned := value\n    }\n\n    function cleanup_t_uint160(value) -> cleaned {\n        cleaned := and(value, 0xffffffffffffffffffffffffffffffffffffffff)\n    }\n\n    function cleanup_t_uint256(value) -> cleaned {\n        cleaned := value\n    }\n\n    function copy_calldata_to_memory(src, dst, length) {\n        calldatacopy(dst, src, length)\n        // clear end\n        mstore(add(dst, length), 0)\n    }\n\n    function copy_memory_to_memory(src, dst, length) {\n        let i := 0\n        for { } lt(i, length) { i := add(i, 32) }\n        {\n            mstore(add(dst, i), mload(add(src, i)))\n        }\n        if gt(i, length)\n        {\n            // clear end\n            mstore(add(dst, length), 0)\n        }\n    }\n\n    function extract_byte_array_length(data) -> length {\n        length := div(data, 2)\n        let outOfPlaceEncoding := and(data, 1)\n        if iszero(outOfPlaceEncoding) {\n            length := and(length, 0x7f)\n        }\n\n        if eq(outOfPlaceEncoding, lt(length, 32)) {\n            panic_error_0x22()\n        }\n    }\n\n    function finalize_allocation(memPtr, size) {\n        let newFreePtr := add(memPtr, round_up_to_mul_of_32(size))\n        // protect against overflow\n        if or(gt(newFreePtr, 0xffffffffffffffff), lt(newFreePtr, memPtr)) { panic_error_0x41() }\n        mstore(64, newFreePtr)\n    }\n\n    function increment_t_uint256(value) -> ret {\n        value := cleanup_t_uint256(value)\n        if eq(value, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff) { panic_error_0x11() }\n        ret := add(value, 1)\n    }\n\n    function mod_t_uint256(x, y) -> r {\n        x := cleanup_t_uint256(x)\n        y := cleanup_t_uint256(y)\n        if iszero(y) { panic_error_0x12() }\n        r := mod(x, y)\n    }\n\n    function panic_error_0x11() {\n        mstore(0, 35408467139433450592217433187231851964531694900788300625387963629091585785856)\n        mstore(4, 0x11)\n        revert(0, 0x24)\n    }\n\n    function panic_error_0x12() {\n        mstore(0, 35408467139433450592217433187231851964531694900788300625387963629091585785856)\n        mstore(4, 0x12)\n        revert(0, 0x24)\n    }\n\n    function panic_error_0x22() {\n        mstore(0, 35408467139433450592217433187231851964531694900788300625387963629091585785856)\n        mstore(4, 0x22)\n        revert(0, 0x24)\n    }\n\n    function panic_error_0x41() {\n        mstore(0, 35408467139433450592217433187231851964531694900788300625387963629091585785856)\n        mstore(4, 0x41)\n        revert(0, 0x24)\n    }\n\n    function round_up_to_mul_of_32(value) -> result {\n        result := and(add(value, 31), not(31))\n    }\n\n    function store_literal_in_memory_1e766a06da43a53d0f4c380e06e5a342e14d5af1bf8501996c844905530ca84e(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: transfer to non ERC721Re\")\n\n        mstore(add(memPtr, 32), \"ceiver implementer\")\n\n    }\n\n    function store_literal_in_memory_245f15ff17f551913a7a18385165551503906a406f905ac1c2437281a7cd0cfe(memPtr) {\n\n        mstore(add(memPtr, 0), \"Ownable: new owner is the zero a\")\n\n        mstore(add(memPtr, 32), \"ddress\")\n\n    }\n\n    function store_literal_in_memory_277f8ee9d5b4fc3c4149386f24de0fc1bbc63a8210e2197bfd1c0376a2ac5f48(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: transfer from incorrect \")\n\n        mstore(add(memPtr, 32), \"owner\")\n\n    }\n\n    function store_literal_in_memory_2a63ce106ef95058ed21fd07c42a10f11dc5c32ac13a4e847923f7759f635d57(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: token already minted\")\n\n    }\n\n    function store_literal_in_memory_455fea98ea03c32d7dd1a6f1426917d80529bf47b3ccbde74e7206e889e709f4(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: transfer to the zero add\")\n\n        mstore(add(memPtr, 32), \"ress\")\n\n    }\n\n    function store_literal_in_memory_45fe4329685be5ecd250fd0e6a25aea0ea4d0e30fb6a73c118b95749e6d70d05(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: approve to caller\")\n\n    }\n\n    function store_literal_in_memory_5797d1ccb08b83980dd0c07ea40d8f6a64d35fff736a19bdd17522954cb0899c(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: operator query for nonex\")\n\n        mstore(add(memPtr, 32), \"istent token\")\n\n    }\n\n    function store_literal_in_memory_6d83cef3e0cb19b8320a9c5feb26b56bbb08f152a8e61b12eca3302d8d68b23d(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: approve caller is not ow\")\n\n        mstore(add(memPtr, 32), \"ner nor approved for all\")\n\n    }\n\n    function store_literal_in_memory_7395d4d3901c50cdfcab223d072f9aa36241df5d883e62cbf147ee1b05a9e6ba(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: balance query for the ze\")\n\n        mstore(add(memPtr, 32), \"ro address\")\n\n    }\n\n    function store_literal_in_memory_7481f3df2a424c0755a1ad2356614e9a5a358d461ea2eae1f89cb21cbad00397(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: owner query for nonexist\")\n\n        mstore(add(memPtr, 32), \"ent token\")\n\n    }\n\n    function store_literal_in_memory_8a66f4bb6512ffbfcc3db9b42318eb65f26ac15163eaa9a1e5cfa7bee9d1c7c6(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: mint to the zero address\")\n\n    }\n\n    function store_literal_in_memory_9291e0f44949204f2e9b40e6be090924979d6047b2365868f4e9f027722eb89d(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: approved query for nonex\")\n\n        mstore(add(memPtr, 32), \"istent token\")\n\n    }\n\n    function store_literal_in_memory_9924ebdf1add33d25d4ef888e16131f0a5687b0580a36c21b5c301a6c462effe(memPtr) {\n\n        mstore(add(memPtr, 0), \"Ownable: caller is not the owner\")\n\n    }\n\n    function store_literal_in_memory_a2d45c0fba603d40d82d590051761ca952d1ab9d78cca6d0d464d7b6e961a9cb(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721Metadata: URI query for no\")\n\n        mstore(add(memPtr, 32), \"nexistent token\")\n\n    }\n\n    function store_literal_in_memory_b51b4875eede07862961e8f9365c6749f5fe55c6ee5d7a9e42b6912ad0b15942(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: approval to current owne\")\n\n        mstore(add(memPtr, 32), \"r\")\n\n    }\n\n    function store_literal_in_memory_c8682f3ad98807db59a6ec6bb812b72fed0a66e3150fa8239699ee83885247f2(memPtr) {\n\n        mstore(add(memPtr, 0), \"ERC721: transfer caller is not o\")\n\n        mstore(add(memPtr, 32), \"wner nor approved\")\n\n    }\n\n    function validator_revert_t_address(value) {\n        if iszero(eq(value, cleanup_t_address(value))) { revert(0, 0) }\n    }\n\n    function validator_revert_t_bool(value) {\n        if iszero(eq(value, cleanup_t_bool(value))) { revert(0, 0) }\n    }\n\n    function validator_revert_t_bytes4(value) {\n        if iszero(eq(value, cleanup_t_bytes4(value))) { revert(0, 0) }\n    }\n\n    function validator_revert_t_uint256(value) {\n        if iszero(eq(value, cleanup_t_uint256(value))) { revert(0, 0) }\n    }\n\n}\n",
      "id": 12,
      "language": "Yul",
      "name": "#utility.yul"
    }
  ],
  "sourceMap": "225:1444:11:-:0;;;608:69;;;;;;;;;;1390:113:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1464:5;1456;:13;;;;;;;;;;;;:::i;:::-;;1489:7;1479;:17;;;;;;;;;;;;:::i;:::-;;1390:113;;921:32:0;940:12;:10;;;:12;;:::i;:::-;921:18;;;:32;;:::i;:::-;658:15:11::1;:7;:13;;;;;:15;;:::i;:::-;225:1444:::0;;640:96:6;693:7;719:10;712:17;;640:96;:::o;2270:187:0:-;2343:16;2362:6;;;;;;;;;;;2343:25;;2387:8;2378:6;;:17;;;;;;;;;;;;;;;;;;2441:8;2410:40;;2431:8;2410:40;;;;;;;;;;;;2270:187;;:::o;1309:84:7:-;1385:1;1368:7;:14;;:18;;;;1309:84;:::o;225:1444:11:-;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;:::o;7:320:12:-;;88:1;82:4;78:12;68:22;;135:1;129:4;125:12;156:18;146:2;;212:4;204:6;200:17;190:27;;146:2;274;266:6;263:14;243:18;240:38;237:2;;;293:18;;:::i;:::-;237:2;58:269;;;;:::o;333:180::-;381:77;378:1;371:88;478:4;475:1;468:15;502:4;499:1;492:15;225:1444:11;;;;;;;",
  "deployedSourceMap": "225:1444:11:-:0;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1570:300:1;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;2488:98;;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;4000:217;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;3538:401;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;1458:83:11;;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;4727:330:1;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;965:236:11;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;5123:179:1;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;2191:235;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;1929:205;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;1668:101:0;;;:::i;:::-;;1036:85;;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;2650:102:1;;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;4284:153;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;5368:320;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;680:282:11;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;2818:329:1;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;4503:162;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;1918:198:0;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;1544:123:11;;;;;;;;;;;;;:::i;:::-;;:::i;:::-;;;;;;;:::i;:::-;;;;;;;;1570:300:1;1672:4;1722:25;1707:40;;;:11;:40;;;;:104;;;;1778:33;1763:48;;;:11;:48;;;;1707:104;:156;;;;1827:36;1851:11;1827:23;:36::i;:::-;1707:156;1688:175;;1570:300;;;:::o;2488:98::-;2542:13;2574:5;2567:12;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2488:98;:::o;4000:217::-;4076:7;4103:16;4111:7;4103;:16::i;:::-;4095:73;;;;;;;;;;;;:::i;:::-;;;;;;;;;4186:15;:24;4202:7;4186:24;;;;;;;;;;;;;;;;;;;;;4179:31;;4000:217;;;:::o;3538:401::-;3618:13;3634:23;3649:7;3634:14;:23::i;:::-;3618:39;;3681:5;3675:11;;:2;:11;;;;3667:57;;;;;;;;;;;;:::i;:::-;;;;;;;;;3772:5;3756:21;;:12;:10;:12::i;:::-;:21;;;:62;;;;3781:37;3798:5;3805:12;:10;:12::i;:::-;3781:16;:37::i;:::-;3756:62;3735:165;;;;;;;;;;;;:::i;:::-;;;;;;;;;3911:21;3920:2;3924:7;3911:8;:21::i;:::-;3538:401;;;:::o;1458:83:11:-;1500:7;1520:17;:7;:15;:17::i;:::-;1513:24;;1458:83;:::o;4727:330:1:-;4916:41;4935:12;:10;:12::i;:::-;4949:7;4916:18;:41::i;:::-;4908:103;;;;;;;;;;;;:::i;:::-;;;;;;;;;5022:28;5032:4;5038:2;5042:7;5022:9;:28::i;:::-;4727:330;;;:::o;965:236:11:-;1078:24;1094:7;1078:15;:24::i;:::-;1107:42;1121:10;1133:2;1137:7;1107:42;;;;;;;;;;;;:13;:42::i;:::-;1154:43;1170:7;1179:1;1182;1185:11;;1154:43;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:15;:43::i;:::-;965:236;;;;;;:::o;5123:179:1:-;5256:39;5273:4;5279:2;5283:7;5256:39;;;;;;;;;;;;:16;:39::i;:::-;5123:179;;;:::o;2191:235::-;2263:7;2282:13;2298:7;:16;2306:7;2298:16;;;;;;;;;;;;;;;;;;;;;2282:32;;2349:1;2332:19;;:5;:19;;;;2324:73;;;;;;;;;;;;:::i;:::-;;;;;;;;;2414:5;2407:12;;;2191:235;;;:::o;1929:205::-;2001:7;2045:1;2028:19;;:5;:19;;;;2020:74;;;;;;;;;;;;:::i;:::-;;;;;;;;;2111:9;:16;2121:5;2111:16;;;;;;;;;;;;;;;;2104:23;;1929:205;;;:::o;1668:101:0:-;1259:12;:10;:12::i;:::-;1248:23;;:7;:5;:7::i;:::-;:23;;;1240:68;;;;;;;;;;;;:::i;:::-;;;;;;;;;1732:30:::1;1759:1;1732:18;:30::i;:::-;1668:101::o:0;1036:85::-;1082:7;1108:6;;;;;;;;;;;1101:13;;1036:85;:::o;2650:102:1:-;2706:13;2738:7;2731:14;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2650:102;:::o;4284:153::-;4378:52;4397:12;:10;:12::i;:::-;4411:8;4421;4378:18;:52::i;:::-;4284:153;;:::o;5368:320::-;5537:41;5556:12;:10;:12::i;:::-;5570:7;5537:18;:41::i;:::-;5529:103;;;;;;;;;;;;:::i;:::-;;;;;;;;;5642:39;5656:4;5662:2;5666:7;5675:5;5642:13;:39::i;:::-;5368:320;;;;:::o;680:282:11:-;777:7;815:19;:7;:17;:19::i;:::-;838:13;854:17;:7;:15;:17::i;:::-;838:33;;875:20;885:2;889:5;875:9;:20::i;:::-;900:41;916:5;923:1;926;929:11;;900:41;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:15;:41::i;:::-;953:5;946:12;;;680:282;;;;;;;:::o;2818:329:1:-;2891:13;2924:16;2932:7;2924;:16::i;:::-;2916:76;;;;;;;;;;;;:::i;:::-;;;;;;;;;3003:21;3027:10;:8;:10::i;:::-;3003:34;;3078:1;3060:7;3054:21;:25;:86;;;;;;;;;;;;;;;;;3106:7;3115:18;:7;:16;:18::i;:::-;3089:45;;;;;;;;;:::i;:::-;;;;;;;;;;;;;3054:86;3047:93;;;2818:329;;;:::o;4503:162::-;4600:4;4623:18;:25;4642:5;4623:25;;;;;;;;;;;;;;;:35;4649:8;4623:35;;;;;;;;;;;;;;;;;;;;;;;;;4616:42;;4503:162;;;;:::o;1918:198:0:-;1259:12;:10;:12::i;:::-;1248:23;;:7;:5;:7::i;:::-;:23;;;1240:68;;;;;;;;;;;;:::i;:::-;;;;;;;;;2026:1:::1;2006:22;;:8;:22;;;;1998:73;;;;;;;;;;;;:::i;:::-;;;;;;;;;2081:28;2100:8;2081:18;:28::i;:::-;1918:198:::0;:::o;1544:123:11:-;1611:19;;:::i;:::-;1643:11;:20;1655:7;1643:20;;;;;;;;;;;1636:27;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1544:123;;;:::o;1309:84:7:-;1385:1;1368:7;:14;;:18;;;;1309:84;:::o;829:155:9:-;914:4;952:25;937:40;;;:11;:40;;;;930:47;;829:155;;;:::o;7160:125:1:-;7225:4;7276:1;7248:30;;:7;:16;7256:7;7248:16;;;;;;;;;;;;;;;;;;;;;:30;;;;7241:37;;7160:125;;;:::o;640:96:6:-;693:7;719:10;712:17;;640:96;:::o;11169:171:1:-;11270:2;11243:15;:24;11259:7;11243:24;;;;;;;;;;;;:29;;;;;;;;;;;;;;;;;;11325:7;11321:2;11287:46;;11296:23;11311:7;11296:14;:23::i;:::-;11287:46;;;;;;;;;;;;11169:171;;:::o;827:112:7:-;892:7;918;:14;;;911:21;;827:112;;;:::o;7443:344:1:-;7536:4;7560:16;7568:7;7560;:16::i;:::-;7552:73;;;;;;;;;;;;:::i;:::-;;;;;;;;;7635:13;7651:23;7666:7;7651:14;:23::i;:::-;7635:39;;7703:5;7692:16;;:7;:16;;;:52;;;;7712:32;7729:5;7736:7;7712:16;:32::i;:::-;7692:52;:87;;;;7772:7;7748:31;;:20;7760:7;7748:11;:20::i;:::-;:31;;;7692:87;7684:96;;;7443:344;;;;:::o;10453:605::-;10607:4;10580:31;;:23;10595:7;10580:14;:23::i;:::-;:31;;;10572:81;;;;;;;;;;;;:::i;:::-;;;;;;;;;10685:1;10671:16;;:2;:16;;;;10663:65;;;;;;;;;;;;:::i;:::-;;;;;;;;;10739:39;10760:4;10766:2;10770:7;10739:20;:39::i;:::-;10840:29;10857:1;10861:7;10840:8;:29::i;:::-;10899:1;10880:9;:15;10890:4;10880:15;;;;;;;;;;;;;;;;:20;;;;;;;:::i;:::-;;;;;;;;10927:1;10910:9;:13;10920:2;10910:13;;;;;;;;;;;;;;;;:18;;;;;;;:::i;:::-;;;;;;;;10957:2;10938:7;:16;10946:7;10938:16;;;;;;;;;;;;:21;;;;;;;;;;;;;;;;;;10994:7;10990:2;10975:27;;10984:4;10975:27;;;;;;;;;;;;11013:38;11033:4;11039:2;11043:7;11013:19;:38::i;:::-;10453:605;;;:::o;1204:85:11:-;1265:11;:20;1277:7;1265:20;;;;;;;;;;;;1258:27;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;1204:85;:::o;6550:307:1:-;6701:28;6711:4;6717:2;6721:7;6701:9;:28::i;:::-;6747:48;6770:4;6776:2;6780:7;6789:5;6747:22;:48::i;:::-;6739:111;;;;;;;;;;;;:::i;:::-;;;;;;;;;6550:307;;;;:::o;1292:163:11:-;1420:31;;;;;;;;1433:1;1420:31;;;;1436:1;1420:31;;;;1439:11;1420:31;;;1397:11;:20;1409:7;1397:20;;;;;;;;;;;:54;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;1292:163;;;;:::o;2270:187:0:-;2343:16;2362:6;;;;;;;;;;;2343:25;;2387:8;2378:6;;:17;;;;;;;;;;;;;;;;;;2441:8;2410:40;;2431:8;2410:40;;;;;;;;;;;;2270:187;;:::o;11475:307:1:-;11625:8;11616:17;;:5;:17;;;;11608:55;;;;;;;;;;;;:::i;:::-;;;;;;;;;11711:8;11673:18;:25;11692:5;11673:25;;;;;;;;;;;;;;;:35;11699:8;11673:35;;;;;;;;;;;;;;;;:46;;;;;;;;;;;;;;;;;;11756:8;11734:41;;11749:5;11734:41;;;11766:8;11734:41;;;;;;:::i;:::-;;;;;;;;11475:307;;;:::o;945:123:7:-;1050:1;1032:7;:14;;;:19;;;;;;;;;;;945:123;:::o;8117:108:1:-;8192:26;8202:2;8206:7;8192:26;;;;;;;;;;;;:9;:26::i;:::-;8117:108;;:::o;3389:92::-;3440:13;3465:9;;;;;;;;;;;;;;3389:92;:::o;328:703:8:-;384:13;610:1;601:5;:10;597:51;;;627:10;;;;;;;;;;;;;;;;;;;;;597:51;657:12;672:5;657:20;;687:14;711:75;726:1;718:4;:9;711:75;;743:8;;;;;:::i;:::-;;;;773:2;765:10;;;;;:::i;:::-;;;711:75;;;795:19;827:6;817:17;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;795:39;;844:150;860:1;851:5;:10;844:150;;887:1;877:11;;;;;:::i;:::-;;;953:2;945:5;:10;;;;:::i;:::-;932:2;:24;;;;:::i;:::-;919:39;;902:6;909;902:14;;;;;;;;;;;;;;;;;;;:56;;;;;;;;;;;981:2;972:11;;;;;:::i;:::-;;;844:150;;;1017:6;1003:21;;;;;328:703;;;;:::o;13669:122:1:-;;;;:::o;14163:121::-;;;;:::o;12335:778::-;12485:4;12505:15;:2;:13;;;:15::i;:::-;12501:606;;;12556:2;12540:36;;;12577:12;:10;:12::i;:::-;12591:4;12597:7;12606:5;12540:72;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;12536:519;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;12796:1;12779:6;:13;:18;12775:266;;;12821:60;;;;;;;;;;:::i;:::-;;;;;;;;12775:266;12993:6;12987:13;12978:6;12974:2;12970:15;12963:38;12536:519;12672:41;;;12662:51;;;:6;:51;;;;12655:58;;;;;12501:606;13092:4;13085:11;;12335:778;;;;;;;:::o;8446:311::-;8571:18;8577:2;8581:7;8571:5;:18::i;:::-;8620:54;8651:1;8655:2;8659:7;8668:5;8620:22;:54::i;:::-;8599:151;;;;;;;;;;;;:::i;:::-;;;;;;;;;8446:311;;;:::o;1175:320:5:-;1235:4;1487:1;1465:7;:19;;;:23;1458:30;;1175:320;;;:::o;9079:427:1:-;9172:1;9158:16;;:2;:16;;;;9150:61;;;;;;;;;;;;:::i;:::-;;;;;;;;;9230:16;9238:7;9230;:16::i;:::-;9229:17;9221:58;;;;;;;;;;;;:::i;:::-;;;;;;;;;9290:45;9319:1;9323:2;9327:7;9290:20;:45::i;:::-;9363:1;9346:9;:13;9356:2;9346:13;;;;;;;;;;;;;;;;:18;;;;;;;:::i;:::-;;;;;;;;9393:2;9374:7;:16;9382:7;9374:16;;;;;;;;;;;;:21;;;;;;;;;;;;;;;;;;9436:7;9432:2;9411:33;;9428:1;9411:33;;;;;;;;;;;;9455:44;9483:1;9487:2;9491:7;9455:19;:44::i;:::-;9079:427;;:::o;-1:-1:-1:-;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;:::o;7:343:12:-;;109:65;125:48;166:6;125:48;:::i;:::-;109:65;:::i;:::-;100:74;;197:6;190:5;183:21;235:4;228:5;224:16;273:3;264:6;259:3;255:16;252:25;249:2;;;290:1;287;280:12;249:2;303:41;337:6;332:3;327;303:41;:::i;:::-;90:260;;;;;;:::o;356:139::-;;440:6;427:20;418:29;;456:33;483:5;456:33;:::i;:::-;408:87;;;;:::o;517:366::-;;;649:3;642:4;634:6;630:17;626:27;616:2;;667:1;664;657:12;616:2;703:6;690:20;680:30;;733:18;725:6;722:30;719:2;;;765:1;762;755:12;719:2;802:4;794:6;790:17;778:29;;856:3;848:4;840:6;836:17;826:8;822:32;819:41;816:2;;;873:1;870;863:12;816:2;606:277;;;;;:::o;889:133::-;;970:6;957:20;948:29;;986:30;1010:5;986:30;:::i;:::-;938:84;;;;:::o;1028:137::-;;1111:6;1098:20;1089:29;;1127:32;1153:5;1127:32;:::i;:::-;1079:86;;;;:::o;1171:141::-;;1258:6;1252:13;1243:22;;1274:32;1300:5;1274:32;:::i;:::-;1233:79;;;;:::o;1331:271::-;;1435:3;1428:4;1420:6;1416:17;1412:27;1402:2;;1453:1;1450;1443:12;1402:2;1493:6;1480:20;1518:78;1592:3;1584:6;1577:4;1569:6;1565:17;1518:78;:::i;:::-;1509:87;;1392:210;;;;;:::o;1608:139::-;;1692:6;1679:20;1670:29;;1708:33;1735:5;1708:33;:::i;:::-;1660:87;;;;:::o;1753:262::-;;1861:2;1849:9;1840:7;1836:23;1832:32;1829:2;;;1877:1;1874;1867:12;1829:2;1920:1;1945:53;1990:7;1981:6;1970:9;1966:22;1945:53;:::i;:::-;1935:63;;1891:117;1819:196;;;;:::o;2021:407::-;;;2146:2;2134:9;2125:7;2121:23;2117:32;2114:2;;;2162:1;2159;2152:12;2114:2;2205:1;2230:53;2275:7;2266:6;2255:9;2251:22;2230:53;:::i;:::-;2220:63;;2176:117;2332:2;2358:53;2403:7;2394:6;2383:9;2379:22;2358:53;:::i;:::-;2348:63;;2303:118;2104:324;;;;;:::o;2434:552::-;;;;2576:2;2564:9;2555:7;2551:23;2547:32;2544:2;;;2592:1;2589;2582:12;2544:2;2635:1;2660:53;2705:7;2696:6;2685:9;2681:22;2660:53;:::i;:::-;2650:63;;2606:117;2762:2;2788:53;2833:7;2824:6;2813:9;2809:22;2788:53;:::i;:::-;2778:63;;2733:118;2890:2;2916:53;2961:7;2952:6;2941:9;2937:22;2916:53;:::i;:::-;2906:63;;2861:118;2534:452;;;;;:::o;2992:809::-;;;;;3160:3;3148:9;3139:7;3135:23;3131:33;3128:2;;;3177:1;3174;3167:12;3128:2;3220:1;3245:53;3290:7;3281:6;3270:9;3266:22;3245:53;:::i;:::-;3235:63;;3191:117;3347:2;3373:53;3418:7;3409:6;3398:9;3394:22;3373:53;:::i;:::-;3363:63;;3318:118;3475:2;3501:53;3546:7;3537:6;3526:9;3522:22;3501:53;:::i;:::-;3491:63;;3446:118;3631:2;3620:9;3616:18;3603:32;3662:18;3654:6;3651:30;3648:2;;;3694:1;3691;3684:12;3648:2;3722:62;3776:7;3767:6;3756:9;3752:22;3722:62;:::i;:::-;3712:72;;3574:220;3118:683;;;;;;;:::o;3807:401::-;;;3929:2;3917:9;3908:7;3904:23;3900:32;3897:2;;;3945:1;3942;3935:12;3897:2;3988:1;4013:53;4058:7;4049:6;4038:9;4034:22;4013:53;:::i;:::-;4003:63;;3959:117;4115:2;4141:50;4183:7;4174:6;4163:9;4159:22;4141:50;:::i;:::-;4131:60;;4086:115;3887:321;;;;;:::o;4214:407::-;;;4339:2;4327:9;4318:7;4314:23;4310:32;4307:2;;;4355:1;4352;4345:12;4307:2;4398:1;4423:53;4468:7;4459:6;4448:9;4444:22;4423:53;:::i;:::-;4413:63;;4369:117;4525:2;4551:53;4596:7;4587:6;4576:9;4572:22;4551:53;:::i;:::-;4541:63;;4496:118;4297:324;;;;;:::o;4627:859::-;;;;;;4820:3;4808:9;4799:7;4795:23;4791:33;4788:2;;;4837:1;4834;4827:12;4788:2;4880:1;4905:53;4950:7;4941:6;4930:9;4926:22;4905:53;:::i;:::-;4895:63;;4851:117;5007:2;5033:53;5078:7;5069:6;5058:9;5054:22;5033:53;:::i;:::-;5023:63;;4978:118;5135:2;5161:53;5206:7;5197:6;5186:9;5182:22;5161:53;:::i;:::-;5151:63;;5106:118;5291:2;5280:9;5276:18;5263:32;5322:18;5314:6;5311:30;5308:2;;;5354:1;5351;5344:12;5308:2;5390:79;5461:7;5452:6;5441:9;5437:22;5390:79;:::i;:::-;5372:97;;;;5234:245;4778:708;;;;;;;;:::o;5492:1005::-;;;;;;;5702:3;5690:9;5681:7;5677:23;5673:33;5670:2;;;5719:1;5716;5709:12;5670:2;5762:1;5787:53;5832:7;5823:6;5812:9;5808:22;5787:53;:::i;:::-;5777:63;;5733:117;5889:2;5915:53;5960:7;5951:6;5940:9;5936:22;5915:53;:::i;:::-;5905:63;;5860:118;6017:2;6043:53;6088:7;6079:6;6068:9;6064:22;6043:53;:::i;:::-;6033:63;;5988:118;6145:2;6171:53;6216:7;6207:6;6196:9;6192:22;6171:53;:::i;:::-;6161:63;;6116:118;6301:3;6290:9;6286:19;6273:33;6333:18;6325:6;6322:30;6319:2;;;6365:1;6362;6355:12;6319:2;6401:79;6472:7;6463:6;6452:9;6448:22;6401:79;:::i;:::-;6383:97;;;;6244:246;5660:837;;;;;;;;:::o;6503:260::-;;6610:2;6598:9;6589:7;6585:23;6581:32;6578:2;;;6626:1;6623;6616:12;6578:2;6669:1;6694:52;6738:7;6729:6;6718:9;6714:22;6694:52;:::i;:::-;6684:62;;6640:116;6568:195;;;;:::o;6769:282::-;;6887:2;6875:9;6866:7;6862:23;6858:32;6855:2;;;6903:1;6900;6893:12;6855:2;6946:1;6971:63;7026:7;7017:6;7006:9;7002:22;6971:63;:::i;:::-;6961:73;;6917:127;6845:206;;;;:::o;7057:262::-;;7165:2;7153:9;7144:7;7140:23;7136:32;7133:2;;;7181:1;7178;7171:12;7133:2;7224:1;7249:53;7294:7;7285:6;7274:9;7270:22;7249:53;:::i;:::-;7239:63;;7195:117;7123:196;;;;:::o;7325:175::-;;7413:44;7453:3;7445:6;7413:44;:::i;:::-;7489:4;7484:3;7480:14;7466:28;;7403:97;;;;:::o;7506:118::-;7593:24;7611:5;7593:24;:::i;:::-;7588:3;7581:37;7571:53;;:::o;7658:704::-;;7794:53;7841:5;7794:53;:::i;:::-;7863:75;7931:6;7926:3;7863:75;:::i;:::-;7856:82;;7962:55;8011:5;7962:55;:::i;:::-;8040:7;8071:1;8056:281;8081:6;8078:1;8075:13;8056:281;;;8157:6;8151:13;8184:61;8241:3;8226:13;8184:61;:::i;:::-;8177:68;;8268:59;8320:6;8268:59;:::i;:::-;8258:69;;8116:221;8103:1;8100;8096:9;8091:14;;8056:281;;;8060:14;8353:3;8346:10;;7770:592;;;;;;;:::o;8368:109::-;8449:21;8464:5;8449:21;:::i;:::-;8444:3;8437:34;8427:50;;:::o;8483:360::-;;8597:38;8629:5;8597:38;:::i;:::-;8651:70;8714:6;8709:3;8651:70;:::i;:::-;8644:77;;8730:52;8775:6;8770:3;8763:4;8756:5;8752:16;8730:52;:::i;:::-;8807:29;8829:6;8807:29;:::i;:::-;8802:3;8798:39;8791:46;;8573:270;;;;;:::o;8849:105::-;8924:23;8941:5;8924:23;:::i;:::-;8919:3;8912:36;8902:52;;:::o;8960:364::-;;9076:39;9109:5;9076:39;:::i;:::-;9131:71;9195:6;9190:3;9131:71;:::i;:::-;9124:78;;9211:52;9256:6;9251:3;9244:4;9237:5;9233:16;9211:52;:::i;:::-;9288:29;9310:6;9288:29;:::i;:::-;9283:3;9279:39;9272:46;;9052:272;;;;;:::o;9330:377::-;;9464:39;9497:5;9464:39;:::i;:::-;9519:89;9601:6;9596:3;9519:89;:::i;:::-;9512:96;;9617:52;9662:6;9657:3;9650:4;9643:5;9639:16;9617:52;:::i;:::-;9694:6;9689:3;9685:16;9678:23;;9440:267;;;;;:::o;9713:366::-;;9876:67;9940:2;9935:3;9876:67;:::i;:::-;9869:74;;9952:93;10041:3;9952:93;:::i;:::-;10070:2;10065:3;10061:12;10054:19;;9859:220;;;:::o;10085:366::-;;10248:67;10312:2;10307:3;10248:67;:::i;:::-;10241:74;;10324:93;10413:3;10324:93;:::i;:::-;10442:2;10437:3;10433:12;10426:19;;10231:220;;;:::o;10457:366::-;;10620:67;10684:2;10679:3;10620:67;:::i;:::-;10613:74;;10696:93;10785:3;10696:93;:::i;:::-;10814:2;10809:3;10805:12;10798:19;;10603:220;;;:::o;10829:366::-;;10992:67;11056:2;11051:3;10992:67;:::i;:::-;10985:74;;11068:93;11157:3;11068:93;:::i;:::-;11186:2;11181:3;11177:12;11170:19;;10975:220;;;:::o;11201:366::-;;11364:67;11428:2;11423:3;11364:67;:::i;:::-;11357:74;;11440:93;11529:3;11440:93;:::i;:::-;11558:2;11553:3;11549:12;11542:19;;11347:220;;;:::o;11573:366::-;;11736:67;11800:2;11795:3;11736:67;:::i;:::-;11729:74;;11812:93;11901:3;11812:93;:::i;:::-;11930:2;11925:3;11921:12;11914:19;;11719:220;;;:::o;11945:366::-;;12108:67;12172:2;12167:3;12108:67;:::i;:::-;12101:74;;12184:93;12273:3;12184:93;:::i;:::-;12302:2;12297:3;12293:12;12286:19;;12091:220;;;:::o;12317:366::-;;12480:67;12544:2;12539:3;12480:67;:::i;:::-;12473:74;;12556:93;12645:3;12556:93;:::i;:::-;12674:2;12669:3;12665:12;12658:19;;12463:220;;;:::o;12689:366::-;;12852:67;12916:2;12911:3;12852:67;:::i;:::-;12845:74;;12928:93;13017:3;12928:93;:::i;:::-;13046:2;13041:3;13037:12;13030:19;;12835:220;;;:::o;13061:366::-;;13224:67;13288:2;13283:3;13224:67;:::i;:::-;13217:74;;13300:93;13389:3;13300:93;:::i;:::-;13418:2;13413:3;13409:12;13402:19;;13207:220;;;:::o;13433:366::-;;13596:67;13660:2;13655:3;13596:67;:::i;:::-;13589:74;;13672:93;13761:3;13672:93;:::i;:::-;13790:2;13785:3;13781:12;13774:19;;13579:220;;;:::o;13805:366::-;;13968:67;14032:2;14027:3;13968:67;:::i;:::-;13961:74;;14044:93;14133:3;14044:93;:::i;:::-;14162:2;14157:3;14153:12;14146:19;;13951:220;;;:::o;14177:366::-;;14340:67;14404:2;14399:3;14340:67;:::i;:::-;14333:74;;14416:93;14505:3;14416:93;:::i;:::-;14534:2;14529:3;14525:12;14518:19;;14323:220;;;:::o;14549:366::-;;14712:67;14776:2;14771:3;14712:67;:::i;:::-;14705:74;;14788:93;14877:3;14788:93;:::i;:::-;14906:2;14901:3;14897:12;14890:19;;14695:220;;;:::o;14921:366::-;;15084:67;15148:2;15143:3;15084:67;:::i;:::-;15077:74;;15160:93;15249:3;15160:93;:::i;:::-;15278:2;15273:3;15269:12;15262:19;;15067:220;;;:::o;15293:366::-;;15456:67;15520:2;15515:3;15456:67;:::i;:::-;15449:74;;15532:93;15621:3;15532:93;:::i;:::-;15650:2;15645:3;15641:12;15634:19;;15439:220;;;:::o;15743:819::-;;15908:4;15903:3;15899:14;15992:4;15985:5;15981:16;15975:23;16011:63;16068:4;16063:3;16059:14;16045:12;16011:63;:::i;:::-;15923:161;16163:4;16156:5;16152:16;16146:23;16182:63;16239:4;16234:3;16230:14;16216:12;16182:63;:::i;:::-;16094:161;16344:4;16337:5;16333:16;16327:23;16397:3;16391:4;16387:14;16380:4;16375:3;16371:14;16364:38;16423:101;16519:4;16505:12;16423:101;:::i;:::-;16415:109;;16265:270;16552:4;16545:11;;15877:685;;;;;:::o;16568:108::-;16645:24;16663:5;16645:24;:::i;:::-;16640:3;16633:37;16623:53;;:::o;16682:118::-;16769:24;16787:5;16769:24;:::i;:::-;16764:3;16757:37;16747:53;;:::o;16806:435::-;;17008:95;17099:3;17090:6;17008:95;:::i;:::-;17001:102;;17120:95;17211:3;17202:6;17120:95;:::i;:::-;17113:102;;17232:3;17225:10;;16990:251;;;;;:::o;17247:222::-;;17378:2;17367:9;17363:18;17355:26;;17391:71;17459:1;17448:9;17444:17;17435:6;17391:71;:::i;:::-;17345:124;;;;:::o;17475:640::-;;17708:3;17697:9;17693:19;17685:27;;17722:71;17790:1;17779:9;17775:17;17766:6;17722:71;:::i;:::-;17803:72;17871:2;17860:9;17856:18;17847:6;17803:72;:::i;:::-;17885;17953:2;17942:9;17938:18;17929:6;17885:72;:::i;:::-;18004:9;17998:4;17994:20;17989:2;17978:9;17974:18;17967:48;18032:76;18103:4;18094:6;18032:76;:::i;:::-;18024:84;;17675:440;;;;;;;:::o;18121:210::-;;18246:2;18235:9;18231:18;18223:26;;18259:65;18321:1;18310:9;18306:17;18297:6;18259:65;:::i;:::-;18213:118;;;;:::o;18337:313::-;;18488:2;18477:9;18473:18;18465:26;;18537:9;18531:4;18527:20;18523:1;18512:9;18508:17;18501:47;18565:78;18638:4;18629:6;18565:78;:::i;:::-;18557:86;;18455:195;;;;:::o;18656:419::-;;18860:2;18849:9;18845:18;18837:26;;18909:9;18903:4;18899:20;18895:1;18884:9;18880:17;18873:47;18937:131;19063:4;18937:131;:::i;:::-;18929:139;;18827:248;;;:::o;19081:419::-;;19285:2;19274:9;19270:18;19262:26;;19334:9;19328:4;19324:20;19320:1;19309:9;19305:17;19298:47;19362:131;19488:4;19362:131;:::i;:::-;19354:139;;19252:248;;;:::o;19506:419::-;;19710:2;19699:9;19695:18;19687:26;;19759:9;19753:4;19749:20;19745:1;19734:9;19730:17;19723:47;19787:131;19913:4;19787:131;:::i;:::-;19779:139;;19677:248;;;:::o;19931:419::-;;20135:2;20124:9;20120:18;20112:26;;20184:9;20178:4;20174:20;20170:1;20159:9;20155:17;20148:47;20212:131;20338:4;20212:131;:::i;:::-;20204:139;;20102:248;;;:::o;20356:419::-;;20560:2;20549:9;20545:18;20537:26;;20609:9;20603:4;20599:20;20595:1;20584:9;20580:17;20573:47;20637:131;20763:4;20637:131;:::i;:::-;20629:139;;20527:248;;;:::o;20781:419::-;;20985:2;20974:9;20970:18;20962:26;;21034:9;21028:4;21024:20;21020:1;21009:9;21005:17;20998:47;21062:131;21188:4;21062:131;:::i;:::-;21054:139;;20952:248;;;:::o;21206:419::-;;21410:2;21399:9;21395:18;21387:26;;21459:9;21453:4;21449:20;21445:1;21434:9;21430:17;21423:47;21487:131;21613:4;21487:131;:::i;:::-;21479:139;;21377:248;;;:::o;21631:419::-;;21835:2;21824:9;21820:18;21812:26;;21884:9;21878:4;21874:20;21870:1;21859:9;21855:17;21848:47;21912:131;22038:4;21912:131;:::i;:::-;21904:139;;21802:248;;;:::o;22056:419::-;;22260:2;22249:9;22245:18;22237:26;;22309:9;22303:4;22299:20;22295:1;22284:9;22280:17;22273:47;22337:131;22463:4;22337:131;:::i;:::-;22329:139;;22227:248;;;:::o;22481:419::-;;22685:2;22674:9;22670:18;22662:26;;22734:9;22728:4;22724:20;22720:1;22709:9;22705:17;22698:47;22762:131;22888:4;22762:131;:::i;:::-;22754:139;;22652:248;;;:::o;22906:419::-;;23110:2;23099:9;23095:18;23087:26;;23159:9;23153:4;23149:20;23145:1;23134:9;23130:17;23123:47;23187:131;23313:4;23187:131;:::i;:::-;23179:139;;23077:248;;;:::o;23331:419::-;;23535:2;23524:9;23520:18;23512:26;;23584:9;23578:4;23574:20;23570:1;23559:9;23555:17;23548:47;23612:131;23738:4;23612:131;:::i;:::-;23604:139;;23502:248;;;:::o;23756:419::-;;23960:2;23949:9;23945:18;23937:26;;24009:9;24003:4;23999:20;23995:1;23984:9;23980:17;23973:47;24037:131;24163:4;24037:131;:::i;:::-;24029:139;;23927:248;;;:::o;24181:419::-;;24385:2;24374:9;24370:18;24362:26;;24434:9;24428:4;24424:20;24420:1;24409:9;24405:17;24398:47;24462:131;24588:4;24462:131;:::i;:::-;24454:139;;24352:248;;;:::o;24606:419::-;;24810:2;24799:9;24795:18;24787:26;;24859:9;24853:4;24849:20;24845:1;24834:9;24830:17;24823:47;24887:131;25013:4;24887:131;:::i;:::-;24879:139;;24777:248;;;:::o;25031:419::-;;25235:2;25224:9;25220:18;25212:26;;25284:9;25278:4;25274:20;25270:1;25259:9;25255:17;25248:47;25312:131;25438:4;25312:131;:::i;:::-;25304:139;;25202:248;;;:::o;25456:393::-;;25647:2;25636:9;25632:18;25624:26;;25696:9;25690:4;25686:20;25682:1;25671:9;25667:17;25660:47;25724:118;25837:4;25828:6;25724:118;:::i;:::-;25716:126;;25614:235;;;;:::o;25855:222::-;;25986:2;25975:9;25971:18;25963:26;;25999:71;26067:1;26056:9;26052:17;26043:6;25999:71;:::i;:::-;25953:124;;;;:::o;26083:129::-;;26144:20;;:::i;:::-;26134:30;;26173:33;26201:4;26193:6;26173:33;:::i;:::-;26124:88;;;:::o;26218:75::-;;26284:2;26278:9;26268:19;;26258:35;:::o;26299:307::-;;26450:18;26442:6;26439:30;26436:2;;;26472:18;;:::i;:::-;26436:2;26510:29;26532:6;26510:29;:::i;:::-;26502:37;;26594:4;26588;26584:15;26576:23;;26365:241;;;:::o;26612:131::-;;26701:3;26693:11;;26731:4;26726:3;26722:14;26714:22;;26683:60;;;:::o;26749:113::-;;26849:5;26843:12;26833:22;;26822:40;;;:::o;26868:98::-;;26953:5;26947:12;26937:22;;26926:40;;;:::o;26972:99::-;;27058:5;27052:12;27042:22;;27031:40;;;:::o;27077:112::-;;27178:4;27173:3;27169:14;27161:22;;27151:38;;;:::o;27195:173::-;;27317:6;27312:3;27305:19;27357:4;27352:3;27348:14;27333:29;;27295:73;;;;:::o;27374:168::-;;27491:6;27486:3;27479:19;27531:4;27526:3;27522:14;27507:29;;27469:73;;;;:::o;27548:169::-;;27666:6;27661:3;27654:19;27706:4;27701:3;27697:14;27682:29;;27644:73;;;;:::o;27723:148::-;;27862:3;27847:18;;27837:34;;;;:::o;27877:305::-;;27936:20;27954:1;27936:20;:::i;:::-;27931:25;;27970:20;27988:1;27970:20;:::i;:::-;27965:25;;28124:1;28056:66;28052:74;28049:1;28046:81;28043:2;;;28130:18;;:::i;:::-;28043:2;28174:1;28171;28167:9;28160:16;;27921:261;;;;:::o;28188:185::-;;28245:20;28263:1;28245:20;:::i;:::-;28240:25;;28279:20;28297:1;28279:20;:::i;:::-;28274:25;;28318:1;28308:2;;28323:18;;:::i;:::-;28308:2;28365:1;28362;28358:9;28353:14;;28230:143;;;;:::o;28379:191::-;;28439:20;28457:1;28439:20;:::i;:::-;28434:25;;28473:20;28491:1;28473:20;:::i;:::-;28468:25;;28512:1;28509;28506:8;28503:2;;;28517:18;;:::i;:::-;28503:2;28562:1;28559;28555:9;28547:17;;28424:146;;;;:::o;28576:96::-;;28642:24;28660:5;28642:24;:::i;:::-;28631:35;;28621:51;;;:::o;28678:90::-;;28755:5;28748:13;28741:21;28730:32;;28720:48;;;:::o;28774:149::-;;28850:66;28843:5;28839:78;28828:89;;28818:105;;;:::o;28929:76::-;;28994:5;28983:16;;28973:32;;;:::o;29011:126::-;;29088:42;29081:5;29077:54;29066:65;;29056:81;;;:::o;29143:77::-;;29209:5;29198:16;;29188:32;;;:::o;29226:154::-;29310:6;29305:3;29300;29287:30;29372:1;29363:6;29358:3;29354:16;29347:27;29277:103;;;:::o;29386:307::-;29454:1;29464:113;29478:6;29475:1;29472:13;29464:113;;;29563:1;29558:3;29554:11;29548:18;29544:1;29539:3;29535:11;29528:39;29500:2;29497:1;29493:10;29488:15;;29464:113;;;29595:6;29592:1;29589:13;29586:2;;;29675:1;29666:6;29661:3;29657:16;29650:27;29586:2;29435:258;;;;:::o;29699:320::-;;29780:1;29774:4;29770:12;29760:22;;29827:1;29821:4;29817:12;29848:18;29838:2;;29904:4;29896:6;29892:17;29882:27;;29838:2;29966;29958:6;29955:14;29935:18;29932:38;29929:2;;;29985:18;;:::i;:::-;29929:2;29750:269;;;;:::o;30025:281::-;30108:27;30130:4;30108:27;:::i;:::-;30100:6;30096:40;30238:6;30226:10;30223:22;30202:18;30190:10;30187:34;30184:62;30181:2;;;30249:18;;:::i;:::-;30181:2;30289:10;30285:2;30278:22;30068:238;;;:::o;30312:233::-;;30374:24;30392:5;30374:24;:::i;:::-;30365:33;;30420:66;30413:5;30410:77;30407:2;;;30490:18;;:::i;:::-;30407:2;30537:1;30530:5;30526:13;30519:20;;30355:190;;;:::o;30551:176::-;;30600:20;30618:1;30600:20;:::i;:::-;30595:25;;30634:20;30652:1;30634:20;:::i;:::-;30629:25;;30673:1;30663:2;;30678:18;;:::i;:::-;30663:2;30719:1;30716;30712:9;30707:14;;30585:142;;;;:::o;30733:180::-;30781:77;30778:1;30771:88;30878:4;30875:1;30868:15;30902:4;30899:1;30892:15;30919:180;30967:77;30964:1;30957:88;31064:4;31061:1;31054:15;31088:4;31085:1;31078:15;31105:180;31153:77;31150:1;31143:88;31250:4;31247:1;31240:15;31274:4;31271:1;31264:15;31291:180;31339:77;31336:1;31329:88;31436:4;31433:1;31426:15;31460:4;31457:1;31450:15;31477:102;;31569:2;31565:7;31560:2;31553:5;31549:14;31545:28;31535:38;;31525:54;;;:::o;31585:237::-;31725:34;31721:1;31713:6;31709:14;31702:58;31794:20;31789:2;31781:6;31777:15;31770:45;31691:131;:::o;31828:225::-;31968:34;31964:1;31956:6;31952:14;31945:58;32037:8;32032:2;32024:6;32020:15;32013:33;31934:119;:::o;32059:224::-;32199:34;32195:1;32187:6;32183:14;32176:58;32268:7;32263:2;32255:6;32251:15;32244:32;32165:118;:::o;32289:178::-;32429:30;32425:1;32417:6;32413:14;32406:54;32395:72;:::o;32473:223::-;32613:34;32609:1;32601:6;32597:14;32590:58;32682:6;32677:2;32669:6;32665:15;32658:31;32579:117;:::o;32702:175::-;32842:27;32838:1;32830:6;32826:14;32819:51;32808:69;:::o;32883:231::-;33023:34;33019:1;33011:6;33007:14;33000:58;33092:14;33087:2;33079:6;33075:15;33068:39;32989:125;:::o;33120:243::-;33260:34;33256:1;33248:6;33244:14;33237:58;33329:26;33324:2;33316:6;33312:15;33305:51;33226:137;:::o;33369:229::-;33509:34;33505:1;33497:6;33493:14;33486:58;33578:12;33573:2;33565:6;33561:15;33554:37;33475:123;:::o;33604:228::-;33744:34;33740:1;33732:6;33728:14;33721:58;33813:11;33808:2;33800:6;33796:15;33789:36;33710:122;:::o;33838:182::-;33978:34;33974:1;33966:6;33962:14;33955:58;33944:76;:::o;34026:231::-;34166:34;34162:1;34154:6;34150:14;34143:58;34235:14;34230:2;34222:6;34218:15;34211:39;34132:125;:::o;34263:182::-;34403:34;34399:1;34391:6;34387:14;34380:58;34369:76;:::o;34451:234::-;34591:34;34587:1;34579:6;34575:14;34568:58;34660:17;34655:2;34647:6;34643:15;34636:42;34557:128;:::o;34691:220::-;34831:34;34827:1;34819:6;34815:14;34808:58;34900:3;34895:2;34887:6;34883:15;34876:28;34797:114;:::o;34917:236::-;35057:34;35053:1;35045:6;35041:14;35034:58;35126:19;35121:2;35113:6;35109:15;35102:44;35023:130;:::o;35159:122::-;35232:24;35250:5;35232:24;:::i;:::-;35225:5;35222:35;35212:2;;35271:1;35268;35261:12;35212:2;35202:79;:::o;35287:116::-;35357:21;35372:5;35357:21;:::i;:::-;35350:5;35347:32;35337:2;;35393:1;35390;35383:12;35337:2;35327:76;:::o;35409:120::-;35481:23;35498:5;35481:23;:::i;:::-;35474:5;35471:34;35461:2;;35519:1;35516;35509:12;35461:2;35451:78;:::o;35535:122::-;35608:24;35626:5;35608:24;:::i;:::-;35601:5;35598:35;35588:2;;35647:1;35644;35637:12;35588:2;35578:79;:::o",
  "source": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n\nimport \"@openzeppelin/contracts/token/ERC721/ERC721.sol\";\nimport \"@openzeppelin/contracts/access/Ownable.sol\";\nimport \"@openzeppelin/contracts/utils/Counters.sol\";\n\n\n\ncontract AnonFTFactory is ERC721, Ownable {\n\tusing Counters for Counters.Counter;\n\n\tstruct IdentityData {\n\t\tuint256 n;\n\t\tuint256 k;\n\t\tint256[] identifiers;\n\t}\n\n\tCounters.Counter private _lastId;\n\n\t// Mapping from tokenId to NFT identifying information\n\tmapping (uint256 => IdentityData) anonymousId;\n\n\t// event Transfer(address indexed _from, address indexed _to, uint256 _value);\n\n\tconstructor() ERC721(\"AnonFTFactory\", \"ANFT\") {\n\t\t_lastId.reset();\n\t}\n\n\tfunction mint(address to, uint256 n, uint256 k, int256[] calldata identifiers) external returns (uint256) {\n\t\t// Generic ERC721 mint\n\t\t_lastId.increment();\n\t\tuint256 newId = _lastId.current();\n\t\t_safeMint(to, newId);\n\n\t\tupdateOwnership(newId, n, k, identifiers);\n\n\t\treturn newId;\n\t}\n\n\tfunction transfer(address to, uint256 tokenId, uint256 n, uint256 k, int256[] calldata identifiers) external {\n\t\tremoveOwnership(tokenId);\n\n\t\t_safeTransfer(msg.sender, to, tokenId, \"\");\n\n\t\tupdateOwnership(tokenId, n, k, identifiers);\n\t}\n\n\tfunction removeOwnership(uint256 tokenId) private {\n\t\tdelete anonymousId[tokenId];\n\t}\n\n\tfunction updateOwnership(uint256 tokenId, uint256 n, uint256 k, int256[] memory identifiers) private {\n\t\tanonymousId[tokenId] = IdentityData(n, k, identifiers);\n\t}\n\n\tfunction getLastID() public view returns (uint256) {\n\t\treturn _lastId.current();\n\t}\n\n\tfunction getOwnershipDataFor(uint256 tokenId) public view returns (IdentityData memory) {\n\t\treturn anonymousId[tokenId];\n\t}\n}\n",
  "sourcePath": "/Users/charlievictor/Imperial/4th_Year/Project/AnonFT/contracts/AnonFTFactory.sol",
  "ast": {
    "absolutePath": "project:/contracts/AnonFTFactory.sol",
    "exportedSymbols": {
      "Address": [
        1426
      ],
      "AnonFTFactory": [
        1935
      ],
      "Context": [
        1448
      ],
      "Counters": [
        1522
      ],
      "ERC165": [
        1749
      ],
      "ERC721": [
        970
      ],
      "IERC165": [
        1761
      ],
      "IERC721": [
        1086
      ],
      "IERC721Metadata": [
        1131
      ],
      "IERC721Receiver": [
        1104
      ],
      "Ownable": [
        104
      ],
      "Strings": [
        1725
      ]
    },
    "id": 1936,
    "license": "MIT",
    "nodeType": "SourceUnit",
    "nodes": [
      {
        "id": 1763,
        "literals": [
          "solidity",
          "^",
          "0.8",
          ".0"
        ],
        "nodeType": "PragmaDirective",
        "src": "32:23:11"
      },
      {
        "absolutePath": "@openzeppelin/contracts/token/ERC721/ERC721.sol",
        "file": "@openzeppelin/contracts/token/ERC721/ERC721.sol",
        "id": 1764,
        "nodeType": "ImportDirective",
        "scope": 1936,
        "sourceUnit": 971,
        "src": "58:57:11",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "absolutePath": "@openzeppelin/contracts/access/Ownable.sol",
        "file": "@openzeppelin/contracts/access/Ownable.sol",
        "id": 1765,
        "nodeType": "ImportDirective",
        "scope": 1936,
        "sourceUnit": 105,
        "src": "116:52:11",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "absolutePath": "@openzeppelin/contracts/utils/Counters.sol",
        "file": "@openzeppelin/contracts/utils/Counters.sol",
        "id": 1766,
        "nodeType": "ImportDirective",
        "scope": 1936,
        "sourceUnit": 1523,
        "src": "169:52:11",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "abstract": false,
        "baseContracts": [
          {
            "baseName": {
              "id": 1767,
              "name": "ERC721",
              "nodeType": "IdentifierPath",
              "referencedDeclaration": 970,
              "src": "251:6:11"
            },
            "id": 1768,
            "nodeType": "InheritanceSpecifier",
            "src": "251:6:11"
          },
          {
            "baseName": {
              "id": 1769,
              "name": "Ownable",
              "nodeType": "IdentifierPath",
              "referencedDeclaration": 104,
              "src": "259:7:11"
            },
            "id": 1770,
            "nodeType": "InheritanceSpecifier",
            "src": "259:7:11"
          }
        ],
        "contractDependencies": [
          104,
          970,
          1086,
          1131,
          1448,
          1749,
          1761
        ],
        "contractKind": "contract",
        "fullyImplemented": true,
        "id": 1935,
        "linearizedBaseContracts": [
          1935,
          104,
          970,
          1131,
          1086,
          1749,
          1761,
          1448
        ],
        "name": "AnonFTFactory",
        "nodeType": "ContractDefinition",
        "nodes": [
          {
            "id": 1774,
            "libraryName": {
              "id": 1771,
              "name": "Counters",
              "nodeType": "IdentifierPath",
              "referencedDeclaration": 1522,
              "src": "276:8:11"
            },
            "nodeType": "UsingForDirective",
            "src": "270:36:11",
            "typeName": {
              "id": 1773,
              "nodeType": "UserDefinedTypeName",
              "pathNode": {
                "id": 1772,
                "name": "Counters.Counter",
                "nodeType": "IdentifierPath",
                "referencedDeclaration": 1454,
                "src": "289:16:11"
              },
              "referencedDeclaration": 1454,
              "src": "289:16:11",
              "typeDescriptions": {
                "typeIdentifier": "t_struct$_Counter_$1454_storage_ptr",
                "typeString": "struct Counters.Counter"
              }
            }
          },
          {
            "canonicalName": "AnonFTFactory.IdentityData",
            "id": 1782,
            "members": [
              {
                "constant": false,
                "id": 1776,
                "mutability": "mutable",
                "name": "n",
                "nodeType": "VariableDeclaration",
                "scope": 1782,
                "src": "333:9:11",
                "stateVariable": false,
                "storageLocation": "default",
                "typeDescriptions": {
                  "typeIdentifier": "t_uint256",
                  "typeString": "uint256"
                },
                "typeName": {
                  "id": 1775,
                  "name": "uint256",
                  "nodeType": "ElementaryTypeName",
                  "src": "333:7:11",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  }
                },
                "visibility": "internal"
              },
              {
                "constant": false,
                "id": 1778,
                "mutability": "mutable",
                "name": "k",
                "nodeType": "VariableDeclaration",
                "scope": 1782,
                "src": "346:9:11",
                "stateVariable": false,
                "storageLocation": "default",
                "typeDescriptions": {
                  "typeIdentifier": "t_uint256",
                  "typeString": "uint256"
                },
                "typeName": {
                  "id": 1777,
                  "name": "uint256",
                  "nodeType": "ElementaryTypeName",
                  "src": "346:7:11",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  }
                },
                "visibility": "internal"
              },
              {
                "constant": false,
                "id": 1781,
                "mutability": "mutable",
                "name": "identifiers",
                "nodeType": "VariableDeclaration",
                "scope": 1782,
                "src": "359:20:11",
                "stateVariable": false,
                "storageLocation": "default",
                "typeDescriptions": {
                  "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                  "typeString": "int256[]"
                },
                "typeName": {
                  "baseType": {
                    "id": 1779,
                    "name": "int256",
                    "nodeType": "ElementaryTypeName",
                    "src": "359:6:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_int256",
                      "typeString": "int256"
                    }
                  },
                  "id": 1780,
                  "nodeType": "ArrayTypeName",
                  "src": "359:8:11",
                  "typeDescriptions": {
                    "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                    "typeString": "int256[]"
                  }
                },
                "visibility": "internal"
              }
            ],
            "name": "IdentityData",
            "nodeType": "StructDefinition",
            "scope": 1935,
            "src": "309:74:11",
            "visibility": "public"
          },
          {
            "constant": false,
            "id": 1785,
            "mutability": "mutable",
            "name": "_lastId",
            "nodeType": "VariableDeclaration",
            "scope": 1935,
            "src": "386:32:11",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_struct$_Counter_$1454_storage",
              "typeString": "struct Counters.Counter"
            },
            "typeName": {
              "id": 1784,
              "nodeType": "UserDefinedTypeName",
              "pathNode": {
                "id": 1783,
                "name": "Counters.Counter",
                "nodeType": "IdentifierPath",
                "referencedDeclaration": 1454,
                "src": "386:16:11"
              },
              "referencedDeclaration": 1454,
              "src": "386:16:11",
              "typeDescriptions": {
                "typeIdentifier": "t_struct$_Counter_$1454_storage_ptr",
                "typeString": "struct Counters.Counter"
              }
            },
            "visibility": "private"
          },
          {
            "constant": false,
            "id": 1790,
            "mutability": "mutable",
            "name": "anonymousId",
            "nodeType": "VariableDeclaration",
            "scope": 1935,
            "src": "478:45:11",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
              "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData)"
            },
            "typeName": {
              "id": 1789,
              "keyType": {
                "id": 1786,
                "name": "uint256",
                "nodeType": "ElementaryTypeName",
                "src": "487:7:11",
                "typeDescriptions": {
                  "typeIdentifier": "t_uint256",
                  "typeString": "uint256"
                }
              },
              "nodeType": "Mapping",
              "src": "478:33:11",
              "typeDescriptions": {
                "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
                "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData)"
              },
              "valueType": {
                "id": 1788,
                "nodeType": "UserDefinedTypeName",
                "pathNode": {
                  "id": 1787,
                  "name": "IdentityData",
                  "nodeType": "IdentifierPath",
                  "referencedDeclaration": 1782,
                  "src": "498:12:11"
                },
                "referencedDeclaration": 1782,
                "src": "498:12:11",
                "typeDescriptions": {
                  "typeIdentifier": "t_struct$_IdentityData_$1782_storage_ptr",
                  "typeString": "struct AnonFTFactory.IdentityData"
                }
              }
            },
            "visibility": "internal"
          },
          {
            "body": {
              "id": 1802,
              "nodeType": "Block",
              "src": "654:23:11",
              "statements": [
                {
                  "expression": {
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "expression": {
                        "id": 1797,
                        "name": "_lastId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1785,
                        "src": "658:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_struct$_Counter_$1454_storage",
                          "typeString": "struct Counters.Counter storage ref"
                        }
                      },
                      "id": 1799,
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": false,
                      "memberName": "reset",
                      "nodeType": "MemberAccess",
                      "referencedDeclaration": 1521,
                      "src": "658:13:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_struct$_Counter_$1454_storage_ptr_$returns$__$bound_to$_t_struct$_Counter_$1454_storage_ptr_$",
                        "typeString": "function (struct Counters.Counter storage pointer)"
                      }
                    },
                    "id": 1800,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "658:15:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1801,
                  "nodeType": "ExpressionStatement",
                  "src": "658:15:11"
                }
              ]
            },
            "id": 1803,
            "implemented": true,
            "kind": "constructor",
            "modifiers": [
              {
                "arguments": [
                  {
                    "hexValue": "416e6f6e4654466163746f7279",
                    "id": 1793,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": true,
                    "kind": "string",
                    "lValueRequested": false,
                    "nodeType": "Literal",
                    "src": "629:15:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_stringliteral_eac9c07f282e3adfde47bfde94bc1d6d64ef039e7b3557bc9dd915f63eb789e5",
                      "typeString": "literal_string \"AnonFTFactory\""
                    },
                    "value": "AnonFTFactory"
                  },
                  {
                    "hexValue": "414e4654",
                    "id": 1794,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": true,
                    "kind": "string",
                    "lValueRequested": false,
                    "nodeType": "Literal",
                    "src": "646:6:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_stringliteral_c34d869bbcf77b34fabc5e2e6bb587a71ec04a7fe6e025a1282ca7750acaed0f",
                      "typeString": "literal_string \"ANFT\""
                    },
                    "value": "ANFT"
                  }
                ],
                "id": 1795,
                "modifierName": {
                  "id": 1792,
                  "name": "ERC721",
                  "nodeType": "IdentifierPath",
                  "referencedDeclaration": 970,
                  "src": "622:6:11"
                },
                "nodeType": "ModifierInvocation",
                "src": "622:31:11"
              }
            ],
            "name": "",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1791,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "619:2:11"
            },
            "returnParameters": {
              "id": 1796,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "654:0:11"
            },
            "scope": 1935,
            "src": "608:69:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "public"
          },
          {
            "body": {
              "id": 1842,
              "nodeType": "Block",
              "src": "786:176:11",
              "statements": [
                {
                  "expression": {
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "expression": {
                        "id": 1817,
                        "name": "_lastId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1785,
                        "src": "815:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_struct$_Counter_$1454_storage",
                          "typeString": "struct Counters.Counter storage ref"
                        }
                      },
                      "id": 1819,
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": false,
                      "memberName": "increment",
                      "nodeType": "MemberAccess",
                      "referencedDeclaration": 1480,
                      "src": "815:17:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_struct$_Counter_$1454_storage_ptr_$returns$__$bound_to$_t_struct$_Counter_$1454_storage_ptr_$",
                        "typeString": "function (struct Counters.Counter storage pointer)"
                      }
                    },
                    "id": 1820,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "815:19:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1821,
                  "nodeType": "ExpressionStatement",
                  "src": "815:19:11"
                },
                {
                  "assignments": [
                    1823
                  ],
                  "declarations": [
                    {
                      "constant": false,
                      "id": 1823,
                      "mutability": "mutable",
                      "name": "newId",
                      "nodeType": "VariableDeclaration",
                      "scope": 1842,
                      "src": "838:13:11",
                      "stateVariable": false,
                      "storageLocation": "default",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      },
                      "typeName": {
                        "id": 1822,
                        "name": "uint256",
                        "nodeType": "ElementaryTypeName",
                        "src": "838:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      "visibility": "internal"
                    }
                  ],
                  "id": 1827,
                  "initialValue": {
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "expression": {
                        "id": 1824,
                        "name": "_lastId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1785,
                        "src": "854:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_struct$_Counter_$1454_storage",
                          "typeString": "struct Counters.Counter storage ref"
                        }
                      },
                      "id": 1825,
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": false,
                      "memberName": "current",
                      "nodeType": "MemberAccess",
                      "referencedDeclaration": 1466,
                      "src": "854:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_view$_t_struct$_Counter_$1454_storage_ptr_$returns$_t_uint256_$bound_to$_t_struct$_Counter_$1454_storage_ptr_$",
                        "typeString": "function (struct Counters.Counter storage pointer) view returns (uint256)"
                      }
                    },
                    "id": 1826,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "854:17:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "nodeType": "VariableDeclarationStatement",
                  "src": "838:33:11"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "id": 1829,
                        "name": "to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1805,
                        "src": "885:2:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "id": 1830,
                        "name": "newId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1823,
                        "src": "889:5:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 1828,
                      "name": "_safeMint",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [
                        599,
                        628
                      ],
                      "referencedDeclaration": 599,
                      "src": "875:9:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,uint256)"
                      }
                    },
                    "id": 1831,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "875:20:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1832,
                  "nodeType": "ExpressionStatement",
                  "src": "875:20:11"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "id": 1834,
                        "name": "newId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1823,
                        "src": "916:5:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1835,
                        "name": "n",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1807,
                        "src": "923:1:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1836,
                        "name": "k",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1809,
                        "src": "926:1:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1837,
                        "name": "identifiers",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1812,
                        "src": "929:11:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                          "typeString": "int256[] calldata"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                          "typeString": "int256[] calldata"
                        }
                      ],
                      "id": 1833,
                      "name": "updateOwnership",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1911,
                      "src": "900:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_uint256_$_t_uint256_$_t_uint256_$_t_array$_t_int256_$dyn_memory_ptr_$returns$__$",
                        "typeString": "function (uint256,uint256,uint256,int256[] memory)"
                      }
                    },
                    "id": 1838,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "900:41:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1839,
                  "nodeType": "ExpressionStatement",
                  "src": "900:41:11"
                },
                {
                  "expression": {
                    "id": 1840,
                    "name": "newId",
                    "nodeType": "Identifier",
                    "overloadedDeclarations": [],
                    "referencedDeclaration": 1823,
                    "src": "953:5:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "functionReturnParameters": 1816,
                  "id": 1841,
                  "nodeType": "Return",
                  "src": "946:12:11"
                }
              ]
            },
            "functionSelector": "bb287ff5",
            "id": 1843,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "mint",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1813,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1805,
                  "mutability": "mutable",
                  "name": "to",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "694:10:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 1804,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "694:7:11",
                    "stateMutability": "nonpayable",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1807,
                  "mutability": "mutable",
                  "name": "n",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "706:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1806,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "706:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1809,
                  "mutability": "mutable",
                  "name": "k",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "717:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1808,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "717:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1812,
                  "mutability": "mutable",
                  "name": "identifiers",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "728:29:11",
                  "stateVariable": false,
                  "storageLocation": "calldata",
                  "typeDescriptions": {
                    "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                    "typeString": "int256[]"
                  },
                  "typeName": {
                    "baseType": {
                      "id": 1810,
                      "name": "int256",
                      "nodeType": "ElementaryTypeName",
                      "src": "728:6:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_int256",
                        "typeString": "int256"
                      }
                    },
                    "id": 1811,
                    "nodeType": "ArrayTypeName",
                    "src": "728:8:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                      "typeString": "int256[]"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "693:65:11"
            },
            "returnParameters": {
              "id": 1816,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1815,
                  "mutability": "mutable",
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "777:7:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1814,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "777:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "776:9:11"
            },
            "scope": 1935,
            "src": "680:282:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "external"
          },
          {
            "body": {
              "id": 1876,
              "nodeType": "Block",
              "src": "1074:127:11",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "id": 1858,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1847,
                        "src": "1094:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 1857,
                      "name": "removeOwnership",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1888,
                      "src": "1078:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_uint256_$returns$__$",
                        "typeString": "function (uint256)"
                      }
                    },
                    "id": 1859,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "1078:24:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1860,
                  "nodeType": "ExpressionStatement",
                  "src": "1078:24:11"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "expression": {
                          "id": 1862,
                          "name": "msg",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 4294967281,
                          "src": "1121:3:11",
                          "typeDescriptions": {
                            "typeIdentifier": "t_magic_message",
                            "typeString": "msg"
                          }
                        },
                        "id": 1863,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "sender",
                        "nodeType": "MemberAccess",
                        "src": "1121:10:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "id": 1864,
                        "name": "to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1845,
                        "src": "1133:2:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "id": 1865,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1847,
                        "src": "1137:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "hexValue": "",
                        "id": 1866,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": true,
                        "kind": "string",
                        "lValueRequested": false,
                        "nodeType": "Literal",
                        "src": "1146:2:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_stringliteral_c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
                          "typeString": "literal_string \"\""
                        },
                        "value": ""
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_stringliteral_c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
                          "typeString": "literal_string \"\""
                        }
                      ],
                      "id": 1861,
                      "name": "_safeTransfer",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 525,
                      "src": "1107:13:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_address_$_t_address_$_t_uint256_$_t_bytes_memory_ptr_$returns$__$",
                        "typeString": "function (address,address,uint256,bytes memory)"
                      }
                    },
                    "id": 1867,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "1107:42:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1868,
                  "nodeType": "ExpressionStatement",
                  "src": "1107:42:11"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "id": 1870,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1847,
                        "src": "1170:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1871,
                        "name": "n",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1849,
                        "src": "1179:1:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1872,
                        "name": "k",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1851,
                        "src": "1182:1:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1873,
                        "name": "identifiers",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1854,
                        "src": "1185:11:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                          "typeString": "int256[] calldata"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                          "typeString": "int256[] calldata"
                        }
                      ],
                      "id": 1869,
                      "name": "updateOwnership",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1911,
                      "src": "1154:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_uint256_$_t_uint256_$_t_uint256_$_t_array$_t_int256_$dyn_memory_ptr_$returns$__$",
                        "typeString": "function (uint256,uint256,uint256,int256[] memory)"
                      }
                    },
                    "id": 1874,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "1154:43:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1875,
                  "nodeType": "ExpressionStatement",
                  "src": "1154:43:11"
                }
              ]
            },
            "functionSelector": "41265c41",
            "id": 1877,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "transfer",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1855,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1845,
                  "mutability": "mutable",
                  "name": "to",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "983:10:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 1844,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "983:7:11",
                    "stateMutability": "nonpayable",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1847,
                  "mutability": "mutable",
                  "name": "tokenId",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "995:15:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1846,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "995:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1849,
                  "mutability": "mutable",
                  "name": "n",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "1012:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1848,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1012:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1851,
                  "mutability": "mutable",
                  "name": "k",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "1023:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1850,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1023:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1854,
                  "mutability": "mutable",
                  "name": "identifiers",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "1034:29:11",
                  "stateVariable": false,
                  "storageLocation": "calldata",
                  "typeDescriptions": {
                    "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                    "typeString": "int256[]"
                  },
                  "typeName": {
                    "baseType": {
                      "id": 1852,
                      "name": "int256",
                      "nodeType": "ElementaryTypeName",
                      "src": "1034:6:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_int256",
                        "typeString": "int256"
                      }
                    },
                    "id": 1853,
                    "nodeType": "ArrayTypeName",
                    "src": "1034:8:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                      "typeString": "int256[]"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "982:82:11"
            },
            "returnParameters": {
              "id": 1856,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1074:0:11"
            },
            "scope": 1935,
            "src": "965:236:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "external"
          },
          {
            "body": {
              "id": 1887,
              "nodeType": "Block",
              "src": "1254:35:11",
              "statements": [
                {
                  "expression": {
                    "id": 1885,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "nodeType": "UnaryOperation",
                    "operator": "delete",
                    "prefix": true,
                    "src": "1258:27:11",
                    "subExpression": {
                      "baseExpression": {
                        "id": 1882,
                        "name": "anonymousId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1790,
                        "src": "1265:11:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
                          "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData storage ref)"
                        }
                      },
                      "id": 1884,
                      "indexExpression": {
                        "id": 1883,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1879,
                        "src": "1277:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": true,
                      "nodeType": "IndexAccess",
                      "src": "1265:20:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_struct$_IdentityData_$1782_storage",
                        "typeString": "struct AnonFTFactory.IdentityData storage ref"
                      }
                    },
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1886,
                  "nodeType": "ExpressionStatement",
                  "src": "1258:27:11"
                }
              ]
            },
            "id": 1888,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "removeOwnership",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1880,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1879,
                  "mutability": "mutable",
                  "name": "tokenId",
                  "nodeType": "VariableDeclaration",
                  "scope": 1888,
                  "src": "1229:15:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1878,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1229:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1228:17:11"
            },
            "returnParameters": {
              "id": 1881,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1254:0:11"
            },
            "scope": 1935,
            "src": "1204:85:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "private"
          },
          {
            "body": {
              "id": 1910,
              "nodeType": "Block",
              "src": "1393:62:11",
              "statements": [
                {
                  "expression": {
                    "id": 1908,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "baseExpression": {
                        "id": 1900,
                        "name": "anonymousId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1790,
                        "src": "1397:11:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
                          "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData storage ref)"
                        }
                      },
                      "id": 1902,
                      "indexExpression": {
                        "id": 1901,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1890,
                        "src": "1409:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": true,
                      "nodeType": "IndexAccess",
                      "src": "1397:20:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_struct$_IdentityData_$1782_storage",
                        "typeString": "struct AnonFTFactory.IdentityData storage ref"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "arguments": [
                        {
                          "id": 1904,
                          "name": "n",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1892,
                          "src": "1433:1:11",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "id": 1905,
                          "name": "k",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1894,
                          "src": "1436:1:11",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "id": 1906,
                          "name": "identifiers",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1897,
                          "src": "1439:11:11",
                          "typeDescriptions": {
                            "typeIdentifier": "t_array$_t_int256_$dyn_memory_ptr",
                            "typeString": "int256[] memory"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_array$_t_int256_$dyn_memory_ptr",
                            "typeString": "int256[] memory"
                          }
                        ],
                        "id": 1903,
                        "name": "IdentityData",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1782,
                        "src": "1420:12:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_type$_t_struct$_IdentityData_$1782_storage_ptr_$",
                          "typeString": "type(struct AnonFTFactory.IdentityData storage pointer)"
                        }
                      },
                      "id": 1907,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "structConstructorCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "1420:31:11",
                      "tryCall": false,
                      "typeDescriptions": {
                        "typeIdentifier": "t_struct$_IdentityData_$1782_memory_ptr",
                        "typeString": "struct AnonFTFactory.IdentityData memory"
                      }
                    },
                    "src": "1397:54:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_struct$_IdentityData_$1782_storage",
                      "typeString": "struct AnonFTFactory.IdentityData storage ref"
                    }
                  },
                  "id": 1909,
                  "nodeType": "ExpressionStatement",
                  "src": "1397:54:11"
                }
              ]
            },
            "id": 1911,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "updateOwnership",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1898,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1890,
                  "mutability": "mutable",
                  "name": "tokenId",
                  "nodeType": "VariableDeclaration",
                  "scope": 1911,
                  "src": "1317:15:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1889,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1317:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1892,
                  "mutability": "mutable",
                  "name": "n",
                  "nodeType": "VariableDeclaration",
                  "scope": 1911,
                  "src": "1334:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1891,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1334:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1894,
                  "mutability": "mutable",
                  "name": "k",
                  "nodeType": "VariableDeclaration",
                  "scope": 1911,
                  "src": "1345:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1893,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1345:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1897,
                  "mutability": "mutable",
                  "name": "identifiers",
                  "nodeType": "VariableDeclaration",
                  "scope": 1911,
                  "src": "1356:27:11",
                  "stateVariable": false,
                  "storageLocation": "memory",
                  "typeDescriptions": {
                    "typeIdentifier": "t_array$_t_int256_$dyn_memory_ptr",
                    "typeString": "int256[]"
                  },
                  "typeName": {
                    "baseType": {
                      "id": 1895,
                      "name": "int256",
                      "nodeType": "ElementaryTypeName",
                      "src": "1356:6:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_int256",
                        "typeString": "int256"
                      }
                    },
                    "id": 1896,
                    "nodeType": "ArrayTypeName",
                    "src": "1356:8:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                      "typeString": "int256[]"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1316:68:11"
            },
            "returnParameters": {
              "id": 1899,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1393:0:11"
            },
            "scope": 1935,
            "src": "1292:163:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "private"
          },
          {
            "body": {
              "id": 1920,
              "nodeType": "Block",
              "src": "1509:32:11",
              "statements": [
                {
                  "expression": {
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "expression": {
                        "id": 1916,
                        "name": "_lastId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1785,
                        "src": "1520:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_struct$_Counter_$1454_storage",
                          "typeString": "struct Counters.Counter storage ref"
                        }
                      },
                      "id": 1917,
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": false,
                      "memberName": "current",
                      "nodeType": "MemberAccess",
                      "referencedDeclaration": 1466,
                      "src": "1520:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_view$_t_struct$_Counter_$1454_storage_ptr_$returns$_t_uint256_$bound_to$_t_struct$_Counter_$1454_storage_ptr_$",
                        "typeString": "function (struct Counters.Counter storage pointer) view returns (uint256)"
                      }
                    },
                    "id": 1918,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "1520:17:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "functionReturnParameters": 1915,
                  "id": 1919,
                  "nodeType": "Return",
                  "src": "1513:24:11"
                }
              ]
            },
            "functionSelector": "12ba91ea",
            "id": 1921,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "getLastID",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1912,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1476:2:11"
            },
            "returnParameters": {
              "id": 1915,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1914,
                  "mutability": "mutable",
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 1921,
                  "src": "1500:7:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1913,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1500:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1499:9:11"
            },
            "scope": 1935,
            "src": "1458:83:11",
            "stateMutability": "view",
            "virtual": false,
            "visibility": "public"
          },
          {
            "body": {
              "id": 1933,
              "nodeType": "Block",
              "src": "1632:35:11",
              "statements": [
                {
                  "expression": {
                    "baseExpression": {
                      "id": 1929,
                      "name": "anonymousId",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1790,
                      "src": "1643:11:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
                        "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData storage ref)"
                      }
                    },
                    "id": 1931,
                    "indexExpression": {
                      "id": 1930,
                      "name": "tokenId",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1923,
                      "src": "1655:7:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "isConstant": false,
                    "isLValue": true,
                    "isPure": false,
                    "lValueRequested": false,
                    "nodeType": "IndexAccess",
                    "src": "1643:20:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_struct$_IdentityData_$1782_storage",
                      "typeString": "struct AnonFTFactory.IdentityData storage ref"
                    }
                  },
                  "functionReturnParameters": 1928,
                  "id": 1932,
                  "nodeType": "Return",
                  "src": "1636:27:11"
                }
              ]
            },
            "functionSelector": "f9986088",
            "id": 1934,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "getOwnershipDataFor",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1924,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1923,
                  "mutability": "mutable",
                  "name": "tokenId",
                  "nodeType": "VariableDeclaration",
                  "scope": 1934,
                  "src": "1573:15:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1922,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1573:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1572:17:11"
            },
            "returnParameters": {
              "id": 1928,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1927,
                  "mutability": "mutable",
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 1934,
                  "src": "1611:19:11",
                  "stateVariable": false,
                  "storageLocation": "memory",
                  "typeDescriptions": {
                    "typeIdentifier": "t_struct$_IdentityData_$1782_memory_ptr",
                    "typeString": "struct AnonFTFactory.IdentityData"
                  },
                  "typeName": {
                    "id": 1926,
                    "nodeType": "UserDefinedTypeName",
                    "pathNode": {
                      "id": 1925,
                      "name": "IdentityData",
                      "nodeType": "IdentifierPath",
                      "referencedDeclaration": 1782,
                      "src": "1611:12:11"
                    },
                    "referencedDeclaration": 1782,
                    "src": "1611:12:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_struct$_IdentityData_$1782_storage_ptr",
                      "typeString": "struct AnonFTFactory.IdentityData"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1610:21:11"
            },
            "scope": 1935,
            "src": "1544:123:11",
            "stateMutability": "view",
            "virtual": false,
            "visibility": "public"
          }
        ],
        "scope": 1936,
        "src": "225:1444:11"
      }
    ],
    "src": "32:1638:11"
  },
  "legacyAST": {
    "absolutePath": "project:/contracts/AnonFTFactory.sol",
    "exportedSymbols": {
      "Address": [
        1426
      ],
      "AnonFTFactory": [
        1935
      ],
      "Context": [
        1448
      ],
      "Counters": [
        1522
      ],
      "ERC165": [
        1749
      ],
      "ERC721": [
        970
      ],
      "IERC165": [
        1761
      ],
      "IERC721": [
        1086
      ],
      "IERC721Metadata": [
        1131
      ],
      "IERC721Receiver": [
        1104
      ],
      "Ownable": [
        104
      ],
      "Strings": [
        1725
      ]
    },
    "id": 1936,
    "license": "MIT",
    "nodeType": "SourceUnit",
    "nodes": [
      {
        "id": 1763,
        "literals": [
          "solidity",
          "^",
          "0.8",
          ".0"
        ],
        "nodeType": "PragmaDirective",
        "src": "32:23:11"
      },
      {
        "absolutePath": "@openzeppelin/contracts/token/ERC721/ERC721.sol",
        "file": "@openzeppelin/contracts/token/ERC721/ERC721.sol",
        "id": 1764,
        "nodeType": "ImportDirective",
        "scope": 1936,
        "sourceUnit": 971,
        "src": "58:57:11",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "absolutePath": "@openzeppelin/contracts/access/Ownable.sol",
        "file": "@openzeppelin/contracts/access/Ownable.sol",
        "id": 1765,
        "nodeType": "ImportDirective",
        "scope": 1936,
        "sourceUnit": 105,
        "src": "116:52:11",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "absolutePath": "@openzeppelin/contracts/utils/Counters.sol",
        "file": "@openzeppelin/contracts/utils/Counters.sol",
        "id": 1766,
        "nodeType": "ImportDirective",
        "scope": 1936,
        "sourceUnit": 1523,
        "src": "169:52:11",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "abstract": false,
        "baseContracts": [
          {
            "baseName": {
              "id": 1767,
              "name": "ERC721",
              "nodeType": "IdentifierPath",
              "referencedDeclaration": 970,
              "src": "251:6:11"
            },
            "id": 1768,
            "nodeType": "InheritanceSpecifier",
            "src": "251:6:11"
          },
          {
            "baseName": {
              "id": 1769,
              "name": "Ownable",
              "nodeType": "IdentifierPath",
              "referencedDeclaration": 104,
              "src": "259:7:11"
            },
            "id": 1770,
            "nodeType": "InheritanceSpecifier",
            "src": "259:7:11"
          }
        ],
        "contractDependencies": [
          104,
          970,
          1086,
          1131,
          1448,
          1749,
          1761
        ],
        "contractKind": "contract",
        "fullyImplemented": true,
        "id": 1935,
        "linearizedBaseContracts": [
          1935,
          104,
          970,
          1131,
          1086,
          1749,
          1761,
          1448
        ],
        "name": "AnonFTFactory",
        "nodeType": "ContractDefinition",
        "nodes": [
          {
            "id": 1774,
            "libraryName": {
              "id": 1771,
              "name": "Counters",
              "nodeType": "IdentifierPath",
              "referencedDeclaration": 1522,
              "src": "276:8:11"
            },
            "nodeType": "UsingForDirective",
            "src": "270:36:11",
            "typeName": {
              "id": 1773,
              "nodeType": "UserDefinedTypeName",
              "pathNode": {
                "id": 1772,
                "name": "Counters.Counter",
                "nodeType": "IdentifierPath",
                "referencedDeclaration": 1454,
                "src": "289:16:11"
              },
              "referencedDeclaration": 1454,
              "src": "289:16:11",
              "typeDescriptions": {
                "typeIdentifier": "t_struct$_Counter_$1454_storage_ptr",
                "typeString": "struct Counters.Counter"
              }
            }
          },
          {
            "canonicalName": "AnonFTFactory.IdentityData",
            "id": 1782,
            "members": [
              {
                "constant": false,
                "id": 1776,
                "mutability": "mutable",
                "name": "n",
                "nodeType": "VariableDeclaration",
                "scope": 1782,
                "src": "333:9:11",
                "stateVariable": false,
                "storageLocation": "default",
                "typeDescriptions": {
                  "typeIdentifier": "t_uint256",
                  "typeString": "uint256"
                },
                "typeName": {
                  "id": 1775,
                  "name": "uint256",
                  "nodeType": "ElementaryTypeName",
                  "src": "333:7:11",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  }
                },
                "visibility": "internal"
              },
              {
                "constant": false,
                "id": 1778,
                "mutability": "mutable",
                "name": "k",
                "nodeType": "VariableDeclaration",
                "scope": 1782,
                "src": "346:9:11",
                "stateVariable": false,
                "storageLocation": "default",
                "typeDescriptions": {
                  "typeIdentifier": "t_uint256",
                  "typeString": "uint256"
                },
                "typeName": {
                  "id": 1777,
                  "name": "uint256",
                  "nodeType": "ElementaryTypeName",
                  "src": "346:7:11",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  }
                },
                "visibility": "internal"
              },
              {
                "constant": false,
                "id": 1781,
                "mutability": "mutable",
                "name": "identifiers",
                "nodeType": "VariableDeclaration",
                "scope": 1782,
                "src": "359:20:11",
                "stateVariable": false,
                "storageLocation": "default",
                "typeDescriptions": {
                  "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                  "typeString": "int256[]"
                },
                "typeName": {
                  "baseType": {
                    "id": 1779,
                    "name": "int256",
                    "nodeType": "ElementaryTypeName",
                    "src": "359:6:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_int256",
                      "typeString": "int256"
                    }
                  },
                  "id": 1780,
                  "nodeType": "ArrayTypeName",
                  "src": "359:8:11",
                  "typeDescriptions": {
                    "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                    "typeString": "int256[]"
                  }
                },
                "visibility": "internal"
              }
            ],
            "name": "IdentityData",
            "nodeType": "StructDefinition",
            "scope": 1935,
            "src": "309:74:11",
            "visibility": "public"
          },
          {
            "constant": false,
            "id": 1785,
            "mutability": "mutable",
            "name": "_lastId",
            "nodeType": "VariableDeclaration",
            "scope": 1935,
            "src": "386:32:11",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_struct$_Counter_$1454_storage",
              "typeString": "struct Counters.Counter"
            },
            "typeName": {
              "id": 1784,
              "nodeType": "UserDefinedTypeName",
              "pathNode": {
                "id": 1783,
                "name": "Counters.Counter",
                "nodeType": "IdentifierPath",
                "referencedDeclaration": 1454,
                "src": "386:16:11"
              },
              "referencedDeclaration": 1454,
              "src": "386:16:11",
              "typeDescriptions": {
                "typeIdentifier": "t_struct$_Counter_$1454_storage_ptr",
                "typeString": "struct Counters.Counter"
              }
            },
            "visibility": "private"
          },
          {
            "constant": false,
            "id": 1790,
            "mutability": "mutable",
            "name": "anonymousId",
            "nodeType": "VariableDeclaration",
            "scope": 1935,
            "src": "478:45:11",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
              "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData)"
            },
            "typeName": {
              "id": 1789,
              "keyType": {
                "id": 1786,
                "name": "uint256",
                "nodeType": "ElementaryTypeName",
                "src": "487:7:11",
                "typeDescriptions": {
                  "typeIdentifier": "t_uint256",
                  "typeString": "uint256"
                }
              },
              "nodeType": "Mapping",
              "src": "478:33:11",
              "typeDescriptions": {
                "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
                "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData)"
              },
              "valueType": {
                "id": 1788,
                "nodeType": "UserDefinedTypeName",
                "pathNode": {
                  "id": 1787,
                  "name": "IdentityData",
                  "nodeType": "IdentifierPath",
                  "referencedDeclaration": 1782,
                  "src": "498:12:11"
                },
                "referencedDeclaration": 1782,
                "src": "498:12:11",
                "typeDescriptions": {
                  "typeIdentifier": "t_struct$_IdentityData_$1782_storage_ptr",
                  "typeString": "struct AnonFTFactory.IdentityData"
                }
              }
            },
            "visibility": "internal"
          },
          {
            "body": {
              "id": 1802,
              "nodeType": "Block",
              "src": "654:23:11",
              "statements": [
                {
                  "expression": {
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "expression": {
                        "id": 1797,
                        "name": "_lastId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1785,
                        "src": "658:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_struct$_Counter_$1454_storage",
                          "typeString": "struct Counters.Counter storage ref"
                        }
                      },
                      "id": 1799,
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": false,
                      "memberName": "reset",
                      "nodeType": "MemberAccess",
                      "referencedDeclaration": 1521,
                      "src": "658:13:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_struct$_Counter_$1454_storage_ptr_$returns$__$bound_to$_t_struct$_Counter_$1454_storage_ptr_$",
                        "typeString": "function (struct Counters.Counter storage pointer)"
                      }
                    },
                    "id": 1800,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "658:15:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1801,
                  "nodeType": "ExpressionStatement",
                  "src": "658:15:11"
                }
              ]
            },
            "id": 1803,
            "implemented": true,
            "kind": "constructor",
            "modifiers": [
              {
                "arguments": [
                  {
                    "hexValue": "416e6f6e4654466163746f7279",
                    "id": 1793,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": true,
                    "kind": "string",
                    "lValueRequested": false,
                    "nodeType": "Literal",
                    "src": "629:15:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_stringliteral_eac9c07f282e3adfde47bfde94bc1d6d64ef039e7b3557bc9dd915f63eb789e5",
                      "typeString": "literal_string \"AnonFTFactory\""
                    },
                    "value": "AnonFTFactory"
                  },
                  {
                    "hexValue": "414e4654",
                    "id": 1794,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": true,
                    "kind": "string",
                    "lValueRequested": false,
                    "nodeType": "Literal",
                    "src": "646:6:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_stringliteral_c34d869bbcf77b34fabc5e2e6bb587a71ec04a7fe6e025a1282ca7750acaed0f",
                      "typeString": "literal_string \"ANFT\""
                    },
                    "value": "ANFT"
                  }
                ],
                "id": 1795,
                "modifierName": {
                  "id": 1792,
                  "name": "ERC721",
                  "nodeType": "IdentifierPath",
                  "referencedDeclaration": 970,
                  "src": "622:6:11"
                },
                "nodeType": "ModifierInvocation",
                "src": "622:31:11"
              }
            ],
            "name": "",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1791,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "619:2:11"
            },
            "returnParameters": {
              "id": 1796,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "654:0:11"
            },
            "scope": 1935,
            "src": "608:69:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "public"
          },
          {
            "body": {
              "id": 1842,
              "nodeType": "Block",
              "src": "786:176:11",
              "statements": [
                {
                  "expression": {
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "expression": {
                        "id": 1817,
                        "name": "_lastId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1785,
                        "src": "815:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_struct$_Counter_$1454_storage",
                          "typeString": "struct Counters.Counter storage ref"
                        }
                      },
                      "id": 1819,
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": false,
                      "memberName": "increment",
                      "nodeType": "MemberAccess",
                      "referencedDeclaration": 1480,
                      "src": "815:17:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_struct$_Counter_$1454_storage_ptr_$returns$__$bound_to$_t_struct$_Counter_$1454_storage_ptr_$",
                        "typeString": "function (struct Counters.Counter storage pointer)"
                      }
                    },
                    "id": 1820,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "815:19:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1821,
                  "nodeType": "ExpressionStatement",
                  "src": "815:19:11"
                },
                {
                  "assignments": [
                    1823
                  ],
                  "declarations": [
                    {
                      "constant": false,
                      "id": 1823,
                      "mutability": "mutable",
                      "name": "newId",
                      "nodeType": "VariableDeclaration",
                      "scope": 1842,
                      "src": "838:13:11",
                      "stateVariable": false,
                      "storageLocation": "default",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      },
                      "typeName": {
                        "id": 1822,
                        "name": "uint256",
                        "nodeType": "ElementaryTypeName",
                        "src": "838:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      "visibility": "internal"
                    }
                  ],
                  "id": 1827,
                  "initialValue": {
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "expression": {
                        "id": 1824,
                        "name": "_lastId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1785,
                        "src": "854:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_struct$_Counter_$1454_storage",
                          "typeString": "struct Counters.Counter storage ref"
                        }
                      },
                      "id": 1825,
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": false,
                      "memberName": "current",
                      "nodeType": "MemberAccess",
                      "referencedDeclaration": 1466,
                      "src": "854:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_view$_t_struct$_Counter_$1454_storage_ptr_$returns$_t_uint256_$bound_to$_t_struct$_Counter_$1454_storage_ptr_$",
                        "typeString": "function (struct Counters.Counter storage pointer) view returns (uint256)"
                      }
                    },
                    "id": 1826,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "854:17:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "nodeType": "VariableDeclarationStatement",
                  "src": "838:33:11"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "id": 1829,
                        "name": "to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1805,
                        "src": "885:2:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "id": 1830,
                        "name": "newId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1823,
                        "src": "889:5:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 1828,
                      "name": "_safeMint",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [
                        599,
                        628
                      ],
                      "referencedDeclaration": 599,
                      "src": "875:9:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,uint256)"
                      }
                    },
                    "id": 1831,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "875:20:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1832,
                  "nodeType": "ExpressionStatement",
                  "src": "875:20:11"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "id": 1834,
                        "name": "newId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1823,
                        "src": "916:5:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1835,
                        "name": "n",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1807,
                        "src": "923:1:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1836,
                        "name": "k",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1809,
                        "src": "926:1:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1837,
                        "name": "identifiers",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1812,
                        "src": "929:11:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                          "typeString": "int256[] calldata"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                          "typeString": "int256[] calldata"
                        }
                      ],
                      "id": 1833,
                      "name": "updateOwnership",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1911,
                      "src": "900:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_uint256_$_t_uint256_$_t_uint256_$_t_array$_t_int256_$dyn_memory_ptr_$returns$__$",
                        "typeString": "function (uint256,uint256,uint256,int256[] memory)"
                      }
                    },
                    "id": 1838,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "900:41:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1839,
                  "nodeType": "ExpressionStatement",
                  "src": "900:41:11"
                },
                {
                  "expression": {
                    "id": 1840,
                    "name": "newId",
                    "nodeType": "Identifier",
                    "overloadedDeclarations": [],
                    "referencedDeclaration": 1823,
                    "src": "953:5:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "functionReturnParameters": 1816,
                  "id": 1841,
                  "nodeType": "Return",
                  "src": "946:12:11"
                }
              ]
            },
            "functionSelector": "bb287ff5",
            "id": 1843,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "mint",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1813,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1805,
                  "mutability": "mutable",
                  "name": "to",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "694:10:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 1804,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "694:7:11",
                    "stateMutability": "nonpayable",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1807,
                  "mutability": "mutable",
                  "name": "n",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "706:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1806,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "706:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1809,
                  "mutability": "mutable",
                  "name": "k",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "717:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1808,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "717:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1812,
                  "mutability": "mutable",
                  "name": "identifiers",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "728:29:11",
                  "stateVariable": false,
                  "storageLocation": "calldata",
                  "typeDescriptions": {
                    "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                    "typeString": "int256[]"
                  },
                  "typeName": {
                    "baseType": {
                      "id": 1810,
                      "name": "int256",
                      "nodeType": "ElementaryTypeName",
                      "src": "728:6:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_int256",
                        "typeString": "int256"
                      }
                    },
                    "id": 1811,
                    "nodeType": "ArrayTypeName",
                    "src": "728:8:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                      "typeString": "int256[]"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "693:65:11"
            },
            "returnParameters": {
              "id": 1816,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1815,
                  "mutability": "mutable",
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 1843,
                  "src": "777:7:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1814,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "777:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "776:9:11"
            },
            "scope": 1935,
            "src": "680:282:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "external"
          },
          {
            "body": {
              "id": 1876,
              "nodeType": "Block",
              "src": "1074:127:11",
              "statements": [
                {
                  "expression": {
                    "arguments": [
                      {
                        "id": 1858,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1847,
                        "src": "1094:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 1857,
                      "name": "removeOwnership",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1888,
                      "src": "1078:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_uint256_$returns$__$",
                        "typeString": "function (uint256)"
                      }
                    },
                    "id": 1859,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "1078:24:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1860,
                  "nodeType": "ExpressionStatement",
                  "src": "1078:24:11"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "expression": {
                          "id": 1862,
                          "name": "msg",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 4294967281,
                          "src": "1121:3:11",
                          "typeDescriptions": {
                            "typeIdentifier": "t_magic_message",
                            "typeString": "msg"
                          }
                        },
                        "id": 1863,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "sender",
                        "nodeType": "MemberAccess",
                        "src": "1121:10:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "id": 1864,
                        "name": "to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1845,
                        "src": "1133:2:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "id": 1865,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1847,
                        "src": "1137:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "hexValue": "",
                        "id": 1866,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": true,
                        "kind": "string",
                        "lValueRequested": false,
                        "nodeType": "Literal",
                        "src": "1146:2:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_stringliteral_c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
                          "typeString": "literal_string \"\""
                        },
                        "value": ""
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_stringliteral_c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
                          "typeString": "literal_string \"\""
                        }
                      ],
                      "id": 1861,
                      "name": "_safeTransfer",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 525,
                      "src": "1107:13:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_address_$_t_address_$_t_uint256_$_t_bytes_memory_ptr_$returns$__$",
                        "typeString": "function (address,address,uint256,bytes memory)"
                      }
                    },
                    "id": 1867,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "1107:42:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1868,
                  "nodeType": "ExpressionStatement",
                  "src": "1107:42:11"
                },
                {
                  "expression": {
                    "arguments": [
                      {
                        "id": 1870,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1847,
                        "src": "1170:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1871,
                        "name": "n",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1849,
                        "src": "1179:1:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1872,
                        "name": "k",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1851,
                        "src": "1182:1:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      {
                        "id": 1873,
                        "name": "identifiers",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1854,
                        "src": "1185:11:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                          "typeString": "int256[] calldata"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        {
                          "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                          "typeString": "int256[] calldata"
                        }
                      ],
                      "id": 1869,
                      "name": "updateOwnership",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1911,
                      "src": "1154:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_uint256_$_t_uint256_$_t_uint256_$_t_array$_t_int256_$dyn_memory_ptr_$returns$__$",
                        "typeString": "function (uint256,uint256,uint256,int256[] memory)"
                      }
                    },
                    "id": 1874,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "1154:43:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1875,
                  "nodeType": "ExpressionStatement",
                  "src": "1154:43:11"
                }
              ]
            },
            "functionSelector": "41265c41",
            "id": 1877,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "transfer",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1855,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1845,
                  "mutability": "mutable",
                  "name": "to",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "983:10:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 1844,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "983:7:11",
                    "stateMutability": "nonpayable",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1847,
                  "mutability": "mutable",
                  "name": "tokenId",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "995:15:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1846,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "995:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1849,
                  "mutability": "mutable",
                  "name": "n",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "1012:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1848,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1012:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1851,
                  "mutability": "mutable",
                  "name": "k",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "1023:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1850,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1023:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1854,
                  "mutability": "mutable",
                  "name": "identifiers",
                  "nodeType": "VariableDeclaration",
                  "scope": 1877,
                  "src": "1034:29:11",
                  "stateVariable": false,
                  "storageLocation": "calldata",
                  "typeDescriptions": {
                    "typeIdentifier": "t_array$_t_int256_$dyn_calldata_ptr",
                    "typeString": "int256[]"
                  },
                  "typeName": {
                    "baseType": {
                      "id": 1852,
                      "name": "int256",
                      "nodeType": "ElementaryTypeName",
                      "src": "1034:6:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_int256",
                        "typeString": "int256"
                      }
                    },
                    "id": 1853,
                    "nodeType": "ArrayTypeName",
                    "src": "1034:8:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                      "typeString": "int256[]"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "982:82:11"
            },
            "returnParameters": {
              "id": 1856,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1074:0:11"
            },
            "scope": 1935,
            "src": "965:236:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "external"
          },
          {
            "body": {
              "id": 1887,
              "nodeType": "Block",
              "src": "1254:35:11",
              "statements": [
                {
                  "expression": {
                    "id": 1885,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "nodeType": "UnaryOperation",
                    "operator": "delete",
                    "prefix": true,
                    "src": "1258:27:11",
                    "subExpression": {
                      "baseExpression": {
                        "id": 1882,
                        "name": "anonymousId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1790,
                        "src": "1265:11:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
                          "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData storage ref)"
                        }
                      },
                      "id": 1884,
                      "indexExpression": {
                        "id": 1883,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1879,
                        "src": "1277:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": true,
                      "nodeType": "IndexAccess",
                      "src": "1265:20:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_struct$_IdentityData_$1782_storage",
                        "typeString": "struct AnonFTFactory.IdentityData storage ref"
                      }
                    },
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 1886,
                  "nodeType": "ExpressionStatement",
                  "src": "1258:27:11"
                }
              ]
            },
            "id": 1888,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "removeOwnership",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1880,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1879,
                  "mutability": "mutable",
                  "name": "tokenId",
                  "nodeType": "VariableDeclaration",
                  "scope": 1888,
                  "src": "1229:15:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1878,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1229:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1228:17:11"
            },
            "returnParameters": {
              "id": 1881,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1254:0:11"
            },
            "scope": 1935,
            "src": "1204:85:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "private"
          },
          {
            "body": {
              "id": 1910,
              "nodeType": "Block",
              "src": "1393:62:11",
              "statements": [
                {
                  "expression": {
                    "id": 1908,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "baseExpression": {
                        "id": 1900,
                        "name": "anonymousId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1790,
                        "src": "1397:11:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
                          "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData storage ref)"
                        }
                      },
                      "id": 1902,
                      "indexExpression": {
                        "id": 1901,
                        "name": "tokenId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1890,
                        "src": "1409:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      },
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": true,
                      "nodeType": "IndexAccess",
                      "src": "1397:20:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_struct$_IdentityData_$1782_storage",
                        "typeString": "struct AnonFTFactory.IdentityData storage ref"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "arguments": [
                        {
                          "id": 1904,
                          "name": "n",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1892,
                          "src": "1433:1:11",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "id": 1905,
                          "name": "k",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1894,
                          "src": "1436:1:11",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "id": 1906,
                          "name": "identifiers",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1897,
                          "src": "1439:11:11",
                          "typeDescriptions": {
                            "typeIdentifier": "t_array$_t_int256_$dyn_memory_ptr",
                            "typeString": "int256[] memory"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_array$_t_int256_$dyn_memory_ptr",
                            "typeString": "int256[] memory"
                          }
                        ],
                        "id": 1903,
                        "name": "IdentityData",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1782,
                        "src": "1420:12:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_type$_t_struct$_IdentityData_$1782_storage_ptr_$",
                          "typeString": "type(struct AnonFTFactory.IdentityData storage pointer)"
                        }
                      },
                      "id": 1907,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "structConstructorCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "1420:31:11",
                      "tryCall": false,
                      "typeDescriptions": {
                        "typeIdentifier": "t_struct$_IdentityData_$1782_memory_ptr",
                        "typeString": "struct AnonFTFactory.IdentityData memory"
                      }
                    },
                    "src": "1397:54:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_struct$_IdentityData_$1782_storage",
                      "typeString": "struct AnonFTFactory.IdentityData storage ref"
                    }
                  },
                  "id": 1909,
                  "nodeType": "ExpressionStatement",
                  "src": "1397:54:11"
                }
              ]
            },
            "id": 1911,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "updateOwnership",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1898,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1890,
                  "mutability": "mutable",
                  "name": "tokenId",
                  "nodeType": "VariableDeclaration",
                  "scope": 1911,
                  "src": "1317:15:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1889,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1317:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1892,
                  "mutability": "mutable",
                  "name": "n",
                  "nodeType": "VariableDeclaration",
                  "scope": 1911,
                  "src": "1334:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1891,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1334:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1894,
                  "mutability": "mutable",
                  "name": "k",
                  "nodeType": "VariableDeclaration",
                  "scope": 1911,
                  "src": "1345:9:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1893,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1345:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 1897,
                  "mutability": "mutable",
                  "name": "identifiers",
                  "nodeType": "VariableDeclaration",
                  "scope": 1911,
                  "src": "1356:27:11",
                  "stateVariable": false,
                  "storageLocation": "memory",
                  "typeDescriptions": {
                    "typeIdentifier": "t_array$_t_int256_$dyn_memory_ptr",
                    "typeString": "int256[]"
                  },
                  "typeName": {
                    "baseType": {
                      "id": 1895,
                      "name": "int256",
                      "nodeType": "ElementaryTypeName",
                      "src": "1356:6:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_int256",
                        "typeString": "int256"
                      }
                    },
                    "id": 1896,
                    "nodeType": "ArrayTypeName",
                    "src": "1356:8:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_array$_t_int256_$dyn_storage_ptr",
                      "typeString": "int256[]"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1316:68:11"
            },
            "returnParameters": {
              "id": 1899,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1393:0:11"
            },
            "scope": 1935,
            "src": "1292:163:11",
            "stateMutability": "nonpayable",
            "virtual": false,
            "visibility": "private"
          },
          {
            "body": {
              "id": 1920,
              "nodeType": "Block",
              "src": "1509:32:11",
              "statements": [
                {
                  "expression": {
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "expression": {
                        "id": 1916,
                        "name": "_lastId",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 1785,
                        "src": "1520:7:11",
                        "typeDescriptions": {
                          "typeIdentifier": "t_struct$_Counter_$1454_storage",
                          "typeString": "struct Counters.Counter storage ref"
                        }
                      },
                      "id": 1917,
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": false,
                      "memberName": "current",
                      "nodeType": "MemberAccess",
                      "referencedDeclaration": 1466,
                      "src": "1520:15:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_view$_t_struct$_Counter_$1454_storage_ptr_$returns$_t_uint256_$bound_to$_t_struct$_Counter_$1454_storage_ptr_$",
                        "typeString": "function (struct Counters.Counter storage pointer) view returns (uint256)"
                      }
                    },
                    "id": 1918,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "1520:17:11",
                    "tryCall": false,
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "functionReturnParameters": 1915,
                  "id": 1919,
                  "nodeType": "Return",
                  "src": "1513:24:11"
                }
              ]
            },
            "functionSelector": "12ba91ea",
            "id": 1921,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "getLastID",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1912,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1476:2:11"
            },
            "returnParameters": {
              "id": 1915,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1914,
                  "mutability": "mutable",
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 1921,
                  "src": "1500:7:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1913,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1500:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1499:9:11"
            },
            "scope": 1935,
            "src": "1458:83:11",
            "stateMutability": "view",
            "virtual": false,
            "visibility": "public"
          },
          {
            "body": {
              "id": 1933,
              "nodeType": "Block",
              "src": "1632:35:11",
              "statements": [
                {
                  "expression": {
                    "baseExpression": {
                      "id": 1929,
                      "name": "anonymousId",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1790,
                      "src": "1643:11:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_mapping$_t_uint256_$_t_struct$_IdentityData_$1782_storage_$",
                        "typeString": "mapping(uint256 => struct AnonFTFactory.IdentityData storage ref)"
                      }
                    },
                    "id": 1931,
                    "indexExpression": {
                      "id": 1930,
                      "name": "tokenId",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 1923,
                      "src": "1655:7:11",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "isConstant": false,
                    "isLValue": true,
                    "isPure": false,
                    "lValueRequested": false,
                    "nodeType": "IndexAccess",
                    "src": "1643:20:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_struct$_IdentityData_$1782_storage",
                      "typeString": "struct AnonFTFactory.IdentityData storage ref"
                    }
                  },
                  "functionReturnParameters": 1928,
                  "id": 1932,
                  "nodeType": "Return",
                  "src": "1636:27:11"
                }
              ]
            },
            "functionSelector": "f9986088",
            "id": 1934,
            "implemented": true,
            "kind": "function",
            "modifiers": [],
            "name": "getOwnershipDataFor",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 1924,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1923,
                  "mutability": "mutable",
                  "name": "tokenId",
                  "nodeType": "VariableDeclaration",
                  "scope": 1934,
                  "src": "1573:15:11",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 1922,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "1573:7:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1572:17:11"
            },
            "returnParameters": {
              "id": 1928,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 1927,
                  "mutability": "mutable",
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 1934,
                  "src": "1611:19:11",
                  "stateVariable": false,
                  "storageLocation": "memory",
                  "typeDescriptions": {
                    "typeIdentifier": "t_struct$_IdentityData_$1782_memory_ptr",
                    "typeString": "struct AnonFTFactory.IdentityData"
                  },
                  "typeName": {
                    "id": 1926,
                    "nodeType": "UserDefinedTypeName",
                    "pathNode": {
                      "id": 1925,
                      "name": "IdentityData",
                      "nodeType": "IdentifierPath",
                      "referencedDeclaration": 1782,
                      "src": "1611:12:11"
                    },
                    "referencedDeclaration": 1782,
                    "src": "1611:12:11",
                    "typeDescriptions": {
                      "typeIdentifier": "t_struct$_IdentityData_$1782_storage_ptr",
                      "typeString": "struct AnonFTFactory.IdentityData"
                    }
                  },
                  "visibility": "internal"
                }
              ],
              "src": "1610:21:11"
            },
            "scope": 1935,
            "src": "1544:123:11",
            "stateMutability": "view",
            "virtual": false,
            "visibility": "public"
          }
        ],
        "scope": 1936,
        "src": "225:1444:11"
      }
    ],
    "src": "32:1638:11"
  },
  "compiler": {
    "name": "solc",
    "version": "0.8.1+commit.df193b15.Emscripten.clang"
  },
  "networks": {
    "5777": {
      "events": {},
      "links": {},
      "address": "0x52D547D67fAB6719e1b857D90Cc4AAB0F6D1572a",
      "transactionHash": "0xf187820f08187263f9f16a3217bd5cf3a2e171da1bd4237e902ee39ea1de86c6"
    },
    "1651237224575": {
      "events": {},
      "links": {},
      "address": "0x33e4F861bFb861bc7E3fd438fD7F1D568BF5842F",
      "transactionHash": "0xb8f196dde227a22fec49a0d489a76849817937be1baac95e1aec1022375fdc19"
    },
    "1651336065528": {
      "events": {},
      "links": {},
      "address": "0x2aE2B126E96518785f86931d029c5d0AA157f26D",
      "transactionHash": "0xe6d63df9528e3c839cf0d0722358c6b1e9406af2b1d616befdc8b2cf46b45958"
    },
    "1651445951891": {
      "events": {},
      "links": {},
      "address": "0x7c1E07969cf56fe6b562FFAe414Dc8412eb5cEFC",
      "transactionHash": "0x13676d99917661c80fe544b3a5ef8c105d3a4a1b99d35d7bf88868e589029762"
    },
    "1651510508731": {
      "events": {},
      "links": {},
      "address": "0xEa6Cbb5Ff1775f209925561976C49a4949938020",
      "transactionHash": "0xcc5822f62160fe1812239b6d85d4d74921c77c1e0eecfaed8e404349cdeffa23"
    }
  },
  "schemaVersion": "3.4.4",
  "updatedAt": "2022-05-02T16:55:16.686Z",
  "networkType": "ethereum",
  "devdoc": {
    "kind": "dev",
    "methods": {
      "approve(address,uint256)": {
        "details": "See {IERC721-approve}."
      },
      "balanceOf(address)": {
        "details": "See {IERC721-balanceOf}."
      },
      "getApproved(uint256)": {
        "details": "See {IERC721-getApproved}."
      },
      "isApprovedForAll(address,address)": {
        "details": "See {IERC721-isApprovedForAll}."
      },
      "name()": {
        "details": "See {IERC721Metadata-name}."
      },
      "owner()": {
        "details": "Returns the address of the current owner."
      },
      "ownerOf(uint256)": {
        "details": "See {IERC721-ownerOf}."
      },
      "renounceOwnership()": {
        "details": "Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner."
      },
      "safeTransferFrom(address,address,uint256)": {
        "details": "See {IERC721-safeTransferFrom}."
      },
      "safeTransferFrom(address,address,uint256,bytes)": {
        "details": "See {IERC721-safeTransferFrom}."
      },
      "setApprovalForAll(address,bool)": {
        "details": "See {IERC721-setApprovalForAll}."
      },
      "supportsInterface(bytes4)": {
        "details": "See {IERC165-supportsInterface}."
      },
      "symbol()": {
        "details": "See {IERC721Metadata-symbol}."
      },
      "tokenURI(uint256)": {
        "details": "See {IERC721Metadata-tokenURI}."
      },
      "transferFrom(address,address,uint256)": {
        "details": "See {IERC721-transferFrom}."
      },
      "transferOwnership(address)": {
        "details": "Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner."
      }
    },
    "version": 1
  },
  "userdoc": {
    "kind": "user",
    "methods": {},
    "version": 1
  }
}
},{}]},{},[1]);
