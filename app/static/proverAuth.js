/** 
 * Main js file providing interactive components for prover.html
 * Intended for any application to verify user's knowledge of proof 
 * witnesses in off-chain proof of ownership
 */

const WHISPER_PROVIDER = 'ws://localhost:8546'

/** 
 * Initiates Web3 provider for Whisper network communications
 */
async function init() {
    // Connect to Web3 whisper node
    var web3_shh = new Web3(WHISPER_PROVIDER);
    window.web3_shh = web3_shh;

    web3_shh.shh.net.getPeerCount().then(console.log);
    await createNewKeyPair();

    await createSubscription(handleMessage);

    tokenCached['tokenId'] = pullDataFromURL('id');
    getPublicParams();

    document.getElementById("user-input").addEventListener('submit', executeProof);
}


/** 
 * Retrieves data from the URL with specified key
 * @param  key: key string to retrieve from URL
 * @returns   : value for key  
 */
function pullDataFromURL(key) {
    var url_string = window.location;
    var url = new URL(url_string);
    return url.searchParams.get(key);
}


/**
 * Basic server response error handler, simply prints error to console
 * @param  error: error value
 */
function handleError(error) {
    console.log(error);
}


/**
 * Basic server response handler
 * @param  respons: Response object to unpack
 */
async function handleResp(response) {
    if (response.ok) {
        var json = await response.json();
        cacheValues(json);
    } else {
        response.text().then(err => handleError(err));
    }
}


/**
 * Handles incoming messages from Whisper network, responds with next proof steps if necessary
 * @param   error: error message if relevant
 * @param   message: message value in hexadecimal
 * @param   subscription: Web3 Whisper subscription
 */
async function handleMessage(error, message, subscription) {
    if (error) {
        console.log(error);
        return;
    }

    console.log(web3_eth.utils.hexToUtf8(message['payload']));
    json = JSON.parse(web3_eth.utils.hexToUtf8(message['payload']));

    if (json['stage'] == "challenge") {
        console.log("Handling challenge request");
        var resp = await prove2(
            tokenCached['n'],
            tokenCached['k'],
            proofCached['r'],
            json['data']['challenge'],
            proofCached['witnesses']
        )
        await handleResp(resp);
        
        sendMessage(proofCached['verifier'], await buildMessage("verify", {"y": proofCached["y"]}));
    }

    else if (json['stage'] == "outcome") {
        console.log("Handling outcome request");
        console.log(json['data']['accepts']);
    }
}


/**
 * Builds message object for Whisper communication to verifier
 * @param   stage: associated stage of the proof of ownership
 * @param   data: proof data for current stage
 * @returns object to be sent over the Whisper network to a verifier
 */
async function buildMessage(stage, data) {
    return {
        "stage": stage,
        "tokenId": tokenCached["tokenId"],
        "data": data,
        "respondTo": await getPublicKey()
    }
}


/*
 * Event handler for submitting form with user provided witnesses, kicks off communication with verifier
 */
async function executeProof(event) {
    event.preventDefault();

    proofCached['witnesses'] = JSON.parse(document.getElementById("witnesses").value);
    proofCached['verifier'] = document.getElementById("verifier").value;

    var resp = await prove1(
        tokenCached['n'],
        tokenCached['k'],
        proofCached['witnesses']
    )

    await handleResp(resp);

    sendMessage(proofCached['verifier'], await buildMessage("init", {'x': proofCached['x']}));

    return false;
}


/**
 * Event handler for executing a local proof to test witness authenticity
 */
async function executeLocalProof(event) {
    event.preventDefault();

    var witnesses = JSON.parse(document.getElementById("witnesses").value);

    var resp = await prove1(
        tokenCached['n'],
        tokenCached['k'],
        witnesses
    )

    await handleResp(resp);

    resp = await verify1(
        tokenCached['k']
    )

    await handleResp(resp);

    resp = await prove2(
        tokenCached['n'],
        tokenCached['k'],
        proofCached['r'],
        proofCached['challenge'],
        witnesses
    )

    await handleResp(resp);

    resp = await verify2(
        tokenCached['n'],
        tokenCached['k'],
        tokenCached['identifiers'],
        proofCached['x'],
        proofCached['y'],
        proofCached['challenge'],
    )

    await handleResp(resp);

    return;
}

init();

