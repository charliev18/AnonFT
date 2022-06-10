
async function init() {
    // Connect to Web3 whisper node
    var web3_shh = new Web3('ws://localhost:8546');
    window.web3_shh = web3_shh;

    web3_shh.shh.net.getPeerCount().then(console.log);
    await createNewKeyPair();

    await createSubscription(handleMessage);

    tokenCached['tokenId'] = pullDataFromURL('id');
    getPublicParams();

    document.getElementById("user-input").addEventListener('submit', executeProof);
}

function pullDataFromURL(key) {
    var url_string = window.location;
    var url = new URL(url_string);
    return url.searchParams.get(key);
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

async function buildMessage(stage, data) {
    return {
        "stage": stage,
        "tokenId": tokenCached["tokenId"],
        "data": data,
        "respondTo": await getPublicKey()
    }
}

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

