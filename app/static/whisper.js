
var commKeyId;

function init() {
    window.onunload = closeConnection;
}

function closeConnection() {
    web3_shh.shh.deleteKeyPair(commKeyId);
}

async function createNewKeyPair() {
    var keyId = await web3_shh.shh.newKeyPair();
    commKeyId = keyId;
    console.log("Key ID: " + keyId);
}

async function getPublicKey() {
    return await web3_shh.shh.getPublicKey(commKeyId);
}

async function getPrivateKey() {
    var pk = await web3_shh.shh.getPrivateKey(commKeyId);
    console.log(pk);
}

async function createSubscription(func) {
    console.log(`Opening Whisper endpoint with ID: ${commKeyId}`);
    web3_shh.shh.subscribe('messages', {
        privateKeyID: commKeyId,

    }, func);
}

async function sendMessage(destPubKey, message) {
    console.log(`Sending message to user with public key:\n${destPubKey}\nWith value: ${message}`);
    web3_shh.shh.post({
        pubKey: destPubKey,
        ttl: 10,
        payload: web3_eth.utils.utf8ToHex(JSON.stringify(message)),
        powTime: 1,
        powTarget: 0.5
    }).then(h => console.log(`Message with hash ${h} was successfuly sent`))
    .catch(err => console.log("Error: ", err));
}

init();
