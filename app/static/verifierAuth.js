
/**
 * Main js file providing interactive components for verifier.html
 * Intended for any application acting as verifier for off-chain proof of ownership
 */

const WHISPER_PROVIDER = 'ws://localhost:8547'

/**
 * Initiates Web3 provider for Whisper network communications
 */
async function init() {
    // Connect to Web3 whisper node
    var web3_shh = new Web3(WHISPER_PROVIDER);
    window.web3_shh = web3_shh;
    await createNewKeyPair();

    await createSubscription(handleMessage);

    document.getElementById("verify-id").innerText = await getPublicKey();
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
* Whisper message handler
* Expects messages like:
*
* {'stage': 'init' | 'verify',
*   'tokenId': ID,
*   'data': {REQUIRED PROOF VALUES},
*   'respondTo': PK
* }
*
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

    tokenCached['tokenId'] = json['tokenId'];
    await getPublicParams()

    // Executes verifier first action
    if (json['stage'] == "init") {
        console.log("Handling initiation request");
        proofCached['x'] = json['data']['x'];

        var resp = await verify1(tokenCached['k']);
        await handleResp(resp);
        
        sendMessage(json['respondTo'], {
            "stage": "challenge",
            "data": {"challenge": proofCached["challenge"]}
        })
    }

    // Executes verifier second action
    else if (json['stage'] == "verify") {
        console.log("Handling verification request");
        resp = await verify2(
            tokenCached['n'],
            tokenCached['k'],
            tokenCached['identifiers'],
            proofCached['x'],
            json['data']['y'],
            proofCached['challenge']
        )
        await handleResp(resp);

        sendMessage(json['respondTo'], {
            "stage": "outcome",
            "data": {"accepts": proofCached["accepts"]}
        })
    }

    else {
        console.log("Unrecognised request");
    }
}

init();
