
async function init() {
    // Connect to Web3 whisper node
    var web3_shh = new Web3('ws://localhost:8547');
    window.web3_shh = web3_shh;
    await createNewKeyPair();

    await createSubscription(handleMessage);

    document.getElementById("verify-id").innerText = await getPublicKey();
}

function handleError(error) {
    console.log(error);
}

async function handleResp(response) {
    if (response.ok) {
        var json = await response.json();
        cacheValues(json);
    } else {
        response.text().then(err => handleError(err));
    }
}

/*
* Expects messages like:
*
* {'stage': 'init' | 'verify',
*   'tokenId': ID,
*   'data': {REQUIRED PROOF VALUES},
*   'respondTo': PK
* }
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
