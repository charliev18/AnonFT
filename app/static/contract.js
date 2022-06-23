
/**
 * Handles webapp interactions with the deployed Ethereum contract
 */

const AnonFTContractJson = require('../../build/contracts/AnonFTFactory.json');
const config = require('../../config.js')

window.CONTRACT_ADDR = config.anonFTAddr;
window.CONTRACT_ACCT = config.accountAddr;

window.tokenCached = {};

/**
 * Sets up Web3 provider and contracts, exposes functions to other js files
 */
function init() {
    var web3_eth = new Web3(config.provider);
    window.web3_eth = web3_eth;

    var anonFTContract = new web3_eth.eth.Contract(AnonFTContractJson.abi, CONTRACT_ADDR);
    anonFTContract.defaultAccount = CONTRACT_ACCT;

    window.anonFTContract = anonFTContract;
    window.getPublicParams = getPublicParams;
    window.checkCommitment = checkCommitment;
    window.checkSaleCommitment = checkSaleCommitment;
    window.getAllForSale = getAllForSale;
}


/**
 * Retrieves the public proof parameters from the blockchain for the token currently connected on the frontend
 */
async function getPublicParams() {
    var receipt = await anonFTContract.methods.getOwnershipDataFor(tokenCached['tokenId']).call();

    tokenCached['n'] = receipt['n'];
    tokenCached['k'] = receipt['k'];
    tokenCached['identifiers'] = '[' + receipt['identifiers'].join(", ") + ']';
}


/**
 * Verifies the committed values on the blockchain are as expected for a mint/buy
 * @param   commitment: commitment key
 * @param   n: expected n value
 * @param   k: expected k value
 * @param   identifiers: expected identifiers
 * @returns true if values match, false otherwise
 */
async function checkCommitment(commitment, n, k, identifiers) {
    var receipt = await anonFTContract.methods.checkCommitment(commitment).call();
    console.log(receipt);

    if (n == receipt['n'] && k == receipt['k']) {
        let ret = true
        for (let i = 0; i < identifiers.length; i++) {
            ret &= identifiers[i] == receipt['identifiers'][i];
        }
        return ret;
    }

    return false;
}


/**
 * Verifies the committed values on the blockchain are as expected for a sale
 * @param   commitment: commitment key
 * @param   tokenId: expected tokenId
 * @param   address: expected Ethereum address
 * @returns true if values match, false otherwise
 */
async function checkSaleCommitment(commitment, tokenId, address) {
    var receipt = await anonFTContract.methods.getSaleCommitmentFor(commitment).call();
    console.log(receipt);

    return receipt['toPay'] == address && receipt['tokenId'] == tokenId;
}


/**
 * Retrieves list of tokens for sale from the blockchain
 * @returns receipt containing list of token IDs
 */
async function getAllForSale() {
    var receipt = await anonFTContract.methods.getTokensForSale().call();
    console.log(receipt);
    return receipt;
}

init();
