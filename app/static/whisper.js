
/*
 * Helpful utility functions for applications inolving Whisper messages
 * Intended to be included on any site executing off-chain proof of ownership
 */

var commKeyId;


/**
 * Prepares window to ensure Whisper connections are not left open
 */
function init() {
    window.onunload = closeConnection;
}


/**
 * Closes active Whisper network connection
 * @param  commKeyId: Whisper communication key
 */
function closeConnection() {
    web3_shh.shh.deleteKeyPair(commKeyId);
}


/**
 * Creates a new key pair to accept Whisper communications on
 */
async function createNewKeyPair() {
    var keyId = await web3_shh.shh.newKeyPair();
    commKeyId = keyId;
    console.log("Key ID: " + keyId);
}


/**
 * @returns public key for the active communication channel
 */
async function getPublicKey() {
    return await web3_shh.shh.getPublicKey(commKeyId);
}


/**
 * @returns private key for the active communication channel
 */
async function getPrivateKey() {
    return await web3_shh.shh.getPrivateKey(commKeyId);
}


/**
 * Opens up a new subscription on the active communication channel
 * @param  func: message handler to be called when a message arrives
 */
async function createSubscription(func) {
    console.log(`Opening Whisper endpoint with ID: ${commKeyId}`);
    web3_shh.shh.subscribe('messages', {
        privateKeyID: commKeyId,

    }, func);
}


/**
 * Submits a new message to the active communication channel for a specified user
 * @param  destPubKey: Public key of the destination user
 * @param  message: Message to send
 */
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
