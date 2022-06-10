
let relayerURL = 'http://localhost:3000/'
let relayerAddr = '0x8135eCAc30E84cDEe2Ee4a8e35A6c6B2Be0Af7b5';

const nftMetaData = {};
//     {
//         'tokenId': 0,
//         'image': "https://upload.wikimedia.org/wikipedia/commons/7/73/Skeleton-Key-Silhouette.svg"
//     },
//     {
//         'tokenId': 0,
//         'image': "https://creazilla-store.fra1.digitaloceanspaces.com/silhouettes/68643/key-silhouette-000000-md.png"
//     },
//     {
//         'tokenId': 0,
//         'image': "https://illustoon.com/photo/5953.png"
//     }
// ]

const varDocumentMapping = {
    'witnesses': ['modal-witnesses', 'sell-witnesses', 'prove-1-w', 'prove-2-w'],
    'identifiers': ['input-identifiers', 'buy-identifiers'],
    'n': ['input-n', 'buy-n'],
    'k': ['input-k', 'buy-k'],
    'challenge': ['prove-2-c', 'verify-2-c'],
    'r': ['prove-2-r'],
    'x': ['verify-2-x'],
    'y': ['verify-2-y']
}

const statusHelp = {
    'snark': {
        'label': 'Compute',
        'help': 'Generating zk-SNARK'
    },
    'commit': {
        'label': 'Commit',
        'help': 'Committing values'
    },
    'payment': {
        'label': 'Pay',
        'help': 'Sending Payment to Contract'
    },
    'prove': {
        'label': 'Prove',
        'help': 'Proving Ownership'
    },
    'claim': {
        'label': 'Claim',
        'help': 'Claiming Commitment'
    }
}

function init() {
    document.getElementById("mint-nft").addEventListener('submit', mintNFT);
    document.getElementById("buy-nft").addEventListener('submit', buyNFT);
    document.getElementById("sell-nft").addEventListener('submit', sellNFT);
    document.getElementById("connect-nft").addEventListener('submit', connectNFT);
    document.getElementById("setup-proof").addEventListener('submit', getSetupParams);
    document.getElementById("prove-1").addEventListener('submit', proverFirstAction);
    document.getElementById("prove-2").addEventListener('submit', proverSecondAction);
    document.getElementById("verify-1").addEventListener('submit', verifierFirstAction);
    document.getElementById("verify-2").addEventListener('submit', verifierSecondAction);
    document.getElementById("buy-default").addEventListener('click', defaultSetup);
    document.getElementById("mint-default").addEventListener('click', defaultSetup);

    buildForSaleList();
}

function truncateProof(stark) {
    return stark.slice(0, 64);
}

async function connectNFT(event) {
    event.preventDefault();

    tokenCached['tokenId'] = document.getElementById("input-token-id").value;
    await getPublicParams();
    showToken();

    return false;
}

async function mintNFT(event) {
    event.preventDefault();

    buildStatusModal(["snark", "commit", "payment", "claim"]);

    previousStatus = "";
    currentStatus = "snark";

    try {
        updateStatus(true, previousStatus, currentStatus);

        let payment = document.getElementById("input-tornado-note").value;
        if (payment) {
            var { proof, args } = await withdrawProof(payment, relayerAddr);
        }

        previousStatus = currentStatus;
        currentStatus = "commit";
        updateStatus(true, previousStatus, currentStatus);

        const commitment = Math.floor(Math.random() * 100);
        let tx = await commitToProof(relayerURL, document.getElementById("input-n").value, document.getElementById("input-k").value, JSON.parse(document.getElementById("input-identifiers").value), commitment);
        console.log(tx);
        let commitOK = await checkCommitment(commitment, document.getElementById("input-n").value, document.getElementById("input-k").value, JSON.parse(document.getElementById("input-identifiers").value));

        if (commitOK) {
            previousStatus = currentStatus;
            currentStatus = "payment";
            updateStatus(true, previousStatus, currentStatus);

            if (payment) {
                const receipt = await anonymousPayment(relayerURL, proof, args);
                console.log(receipt);
            }

            previousStatus = currentStatus;
            currentStatus = "claim";
            updateStatus(true, previousStatus, currentStatus);
            const confirmation = await confirmPayment(relayerURL, commitment);
            
            previousStatus = currentStatus;
            updateStatus(true, previousStatus, "");
            console.log(confirmation);
            tokenCached['tokenId'] = parseInt(confirmation['logs'][1]['data'], 16);
            console.log(tokenCached['tokenId']);
            let url = URL.createObjectURL(document.getElementById("input-file").files[0]);
            console.log(url);
            nftMetaData[tokenCached['tokenId']] = url;
            
            await getPublicParams();
            showToken();
        } else {
            updateStatus(false, previousStatus, currentStatus);
            console.log("Relayer commitment does not match generated identifiers");
        }
    } catch {
        updateStatus(false, previousStatus, currentStatus);
    } finally {
        closeStatusModal('status-update');
    }

    return false;
}

async function sellNFT(event) {
    event.preventDefault();

    buildStatusModal(["snark", "commit", "payment", "prove", "claim"]);

    previousStatus = "";
    currentStatus = "snark";
    try {
        updateStatus(true, previousStatus, currentStatus);

        let payment = document.getElementById("sell-tornado-note").value;
        if (payment) {
            var { proof, args } = await withdrawProof(payment, relayerAddr);
        }

        const commitment = Math.floor(Math.random() * 100);

        previousStatus = currentStatus;
        currentStatus = "commit";
        updateStatus(true, previousStatus, currentStatus);

        tokenCached['tokenId'] = document.getElementById("sell-token-id").value;
        await getPublicParams();

        var resp = await initOwnershipProof(relayerURL, commitment, tokenCached['tokenId'], document.getElementById("sell-eth-address").value);
        console.log(resp);

        var commitOK = await checkSaleCommitment(commitment, tokenCached['tokenId'], document.getElementById("sell-eth-address").value);

        if (commitOK) {
            previousStatus = currentStatus;
            currentStatus = "payment";
            updateStatus(true, previousStatus, currentStatus);

            if (payment) {
                const receipt = await anonymousPayment(relayerURL, proof, args);
                console.log(receipt);
            }
            
            previousStatus = currentStatus;
            currentStatus = "prove";
            updateStatus(true, previousStatus, currentStatus);

            var resp = await prove1(
                tokenCached['n'],
                tokenCached['k'],
                JSON.parse(document.getElementById('sell-witnesses').value)
            );
    
            if (resp.ok) {
                let json = await resp.json()
                cacheValues(json);
            } else {
                response.text().then(err => console.log(err));
            }
    
            let challenge = await proveOwnershipCommit(relayerURL, commitment, proofCached['x'])
            
            // Get last k bits of challenge reversed for proof.
            challenge = parseInt(challenge, 16).toString(2); // Convert hex to binary
            challenge = challenge.substring(challenge.length - tokenCached['k']);
            challenge = challenge.split("").reverse();
            challenge = challenge.map(val => parseInt(val, 10));
    
            resp = await prove2(
                tokenCached['n'],
                tokenCached['k'],
                proofCached['r'],
                challenge,
                JSON.parse(document.getElementById('sell-witnesses').value)
            );
    
            if (resp.ok) {
                let json = await resp.json()
                cacheValues(json);
            } else {
                response.text().then(err => console.log(err));
            }
    
            previousStatus = currentStatus;
            currentStatus = "claim";
            updateStatus(true, previousStatus, currentStatus);

            let result = await proveOwnershipVerify(relayerURL, commitment, proofCached['y'])
            console.log(result);

            updateStatus(true, previousStatus, "");
        } else {
            updateStatus(false, previousStatus, currentStatus);
        }

    } catch {
        updateStatus(false, previousStatus, currentStatus);
    } finally {
        buildForSaleList();
        closeStatusModal('status-update');
    }

    return false;
}

async function buyNFT(event) {
    event.preventDefault();

    buildStatusModal(["snark", "commit", "payment", "claim"]);

    previousStatus = "";
    currentStatus = "snark";
    try {
        updateStatus(true, previousStatus, currentStatus);

        let payment = document.getElementById("buy-tornado-note").value;
        if (payment) {
            var { proof, args } = await withdrawProof(payment, relayerAddr);
        }
        
        previousStatus = currentStatus;
        currentStatus = "commit";
        updateStatus(true, previousStatus, currentStatus);
        
        const commitment = Math.floor(Math.random() * 100);
        let tx = await commitToProof(relayerURL, document.getElementById("buy-n").value, document.getElementById("buy-k").value, JSON.parse(document.getElementById("buy-identifiers").value), commitment);
        console.log(tx);
        let bool = await checkCommitment(commitment, document.getElementById("buy-n").value, document.getElementById("buy-k").value, JSON.parse(document.getElementById("buy-identifiers").value));
        if (bool) {
            previousStatus = currentStatus;
            currentStatus = "payment";
            updateStatus(true, previousStatus, currentStatus);

            if (payment) {
                const receipt = await anonymousPayment(relayerURL, proof, args);
                console.log(receipt);
            }

            previousStatus = currentStatus;
            currentStatus = "claim";
            updateStatus(true, previousStatus, currentStatus);

            const confirmation = await confirmPayment(relayerURL, commitment, document.getElementById("buy-token-id").value);
            console.log(confirmation);

            previousStatus = currentStatus;
            updateStatus(true, previousStatus, "");
            console.log(confirmation);

            tokenCached['tokenId'] = document.getElementById("buy-token-id").value;
            await getPublicParams();
            showToken();
        } else {
            updateStatus(false, previousStatus, currentStatus);
            console.log("Relayer commitment does not match generated identifiers");
        }
    } catch {
        updateStatus(false, previousStatus, currentStatus);
    } finally {
        buildForSaleList();
        closeStatusModal('status-update');
    }

    
    return false;
}

function showToken() {
    // let imgSrc;
    // if ()
    // for (const metadata of nftMetaData) {
    //     if (metadata['tokenId'] == tokenCached['tokenId']) {
    //         imgSrc = metadata['image'];

    //         break;
    //     } else if (metadata['tokenId'] == 0) {
    //         metadata['tokenId'] = tokenCached['tokenId'];
    //         imgSrc = metadata['image'];

    //         break;
    //     }
    // }

    console.log(nftMetaData[tokenCached['tokenId']]);

    document.getElementById('token-img').src = nftMetaData[tokenCached['tokenId']];
    document.getElementById('token-id').innerText = 'ID: ' + tokenCached['tokenId'];
    document.getElementById('token-n').innerText = 'N: ' + tokenCached['n'];
    document.getElementById('token-k').innerText = 'K: ' + tokenCached['k'];
    document.getElementById('token-identifiers').innerText = 'Identifiers: ' + tokenCached['identifiers'];

    if (document.getElementById('nft-vis').classList.contains('d-none')) {
        document.getElementById('nft-vis').classList.remove('d-none');
    }
}

function autoFillCached() {
    for (const [key, value] of Object.entries(proofCached)) {
        if (!varDocumentMapping[key]) continue;
        for (const docId of varDocumentMapping[key]) {
            if (docId == "modal-witnesses") {
                document.getElementById("modal-witnesses").innerText = value;
                continue;
            }

            document.getElementById(docId).value = value;
        }
    }
}

const toTitleCase = str => str.replace(/(^\w)/g, m => m.toUpperCase())

/* 
Builds the following response HTML object:

<div class="card">
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
    var innerHTML = '<div class="card">' + 
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
function handleResponse(response, stage) {
    if (response.ok) {
        response.json()
        .then((json) => {
            buildResponse(json, stage);
            cacheValues(json);
            autoFillCached();
        });
    } else {
        response.text().then(err => handleError(err, stage));
    }
}

async function buildForSaleList() {
    const forSale = await getAllForSale();

    var wrapper = document.createElement('div');
    var inner = '<div class="list-group">';
    for (const id of forSale) {
        inner += '<button type="button" class="list-group-item list-group-item-action" aria-current="true">' +
                             'ID: ' + id +
                             '</button>';
    }
    inner += '</div>';
    wrapper.innerHTML = inner;
    document.getElementById('nfts-for-sale').innerHTML = '';
    document.getElementById('nfts-for-sale').appendChild(wrapper);
}

async function defaultSetup(event) {
    event.preventDefault();
    console.log("In setup")
    proofCached['k'] = 8;

    var resp = await setup(
        '151',
        '211',
        '8'
    );

    handleResponse(resp, 'setup');

    return false;
}

async function getSetupParams(event) {
    event.preventDefault();
    console.log("In setup")
    proofCached['k'] = document.getElementById('setup-k').value;

    var resp = await setup(
        document.getElementById('setup-p').value,
        document.getElementById('setup-q').value,
        document.getElementById('setup-k').value
    );

    handleResponse(resp, 'setup');

    return false;
}

async function proverFirstAction(event) {
    event.preventDefault();
    console.log("In prover 1")

    var resp = await prove1(
        tokenCached['n'],
        tokenCached['k'],
        JSON.parse(document.getElementById('prove-1-w').value)
    );

    handleResponse(resp, 'prove-1');

    return false;
}

async function proverSecondAction(event) {
    event.preventDefault();
    console.log("In prover 2")

    var resp = await prove2(
        tokenCached['n'],
        tokenCached['k'],
        document.getElementById('prove-2-r').value,
        JSON.parse(document.getElementById('prove-2-c').value),
        JSON.parse(document.getElementById('prove-2-w').value)
    );

    handleResponse(resp, 'prove-2');

    return false;
}

async function verifierFirstAction(event) {
    event.preventDefault();
    console.log("In verifier 1")

    var resp = await verify1(tokenCached['k']);

    handleResponse(resp, 'verify-1');

    return false;
}

async function verifierSecondAction(event) {
    event.preventDefault();
    console.log("In verifier 2")

    var resp = await verify2(
        tokenCached['n'],
        tokenCached['k'],
        tokenCached['identifiers'],
        document.getElementById('verify-2-x').value,
        document.getElementById('verify-2-y').value,
        JSON.parse(document.getElementById('verify-2-c').value)
    );

    handleResponse(resp, 'verify-2');

    return false;
}

/* 
 * Builds status modal to display transaction progress
 */
async function buildStatusModal(stages) {
    // Build HTML object
    var wrapper = document.createElement('div');
    var innerHTML = '<div class="container-fluid p-4">' +
                        '<div class="row justify-content-md-center align-items-center g-0 mx-5">' +
                            `<div class="col"><img src="/assets/stageToDo.svg" id="stage-${stages[0]}" /></div>`

    for (var i = 1; i < stages.length; i++) {
        innerHTML += `<div class="col link"><img src="/assets/connectorToDo.svg" id="connector-${stages[i]}" /></div>`;
        innerHTML += `<div class="col"><img src="/assets/stageToDo.svg" id="stage-${stages[i]}" /></div>`;
        
    }

    innerHTML += '</div><div class="row justify-content-md-center mx-4">';

    for (const stage of stages) {
        innerHTML += `<div class="col text-center"><h6>${statusHelp[stage]['label']}</h6></div>`;
    }

    innerHTML += '</div>'
    innerHTML += '<div class="row justify-content-md-center">' +
                    '<div class="col-auto text-center">' +
                        '<p id="status-help"></p>' +
                    '</div></div></div></div>'
    wrapper.innerHTML = innerHTML;

    // Insert into document
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-body').appendChild(wrapper);

    // Open modal
    var modal = new bootstrap.Modal(document.getElementById("status-update"), {});
    modal.show();
}

/* Displays the progress to the user */
async function updateStatus(success, previous, current) {
    if (!current) {
        let assetType = success ? "Complete" : "Failed";
        document.getElementById("connector-" + previous).src = "/assets/connector" + assetType + ".svg";
        document.getElementById("stage-" + previous).src = "/assets/stage" + assetType + ".svg";
        return;
    }

    document.getElementById("status-help").innerHTML = statusHelp[current]['help'];

    if (!previous) {
        document.getElementById("stage-" + current).src = "/assets/stageInProgress.svg";
        return;
    }

    if (success) {
        if (!previous.includes("snark")) document.getElementById("connector-" + previous).src = "/assets/connectorComplete.svg";
        document.getElementById("stage-" + previous).src = "/assets/stageComplete.svg";
        document.getElementById("connector-" + current).src = "/assets/connectorInProgress.svg";
        document.getElementById("stage-" + current).src = "/assets/stageInProgress.svg";
    } else {
        document.getElementById("connector-" + current).src = "/assets/connectorFailed.svg";
        document.getElementById("stage-" + current).src = "/assets/stageFailed.svg";
    }
}

async function closeStatusModal(ident) {
    var myModalEl = document.getElementById(ident);
    var modal = bootstrap.Modal.getInstance(myModalEl);
    modal.hide();
}

init();
