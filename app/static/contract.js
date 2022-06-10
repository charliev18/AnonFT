const AnonFTContractJson = require('../../build/contracts/AnonFTFactory.json');

window.CONTRACT_ADDR = '0xE12363E7b558A15f448845B7C3ED419B161B7E15';
window.CONTRACT_ACCT = '0xD895929f3f465d3e1079bBf3db374EE92B9Cd2e2';

window.tokenCached = {};

function init() {
    // var web3_eth = new Web3('ws://localhost:8545');
    var web3_eth = new Web3('wss://goerli.infura.io/ws/v3/1154aaae2dda49bf92041c41761bf9c6');
    window.web3_eth = web3_eth;

    var anonFTContract = new web3_eth.eth.Contract(AnonFTContractJson.abi, CONTRACT_ADDR);
    // Bind to window
    anonFTContract.defaultAccount = CONTRACT_ACCT;

    window.anonFTContract = anonFTContract;
    window.getPublicParams = getPublicParams;
    window.checkCommitment = checkCommitment;
    window.checkSaleCommitment = checkSaleCommitment;
    window.getAllForSale = getAllForSale;

    anonFTContract.methods.getTokensForSale().call().then(console.log);
}

async function getPublicParams() {
    var receipt = await anonFTContract.methods.getOwnershipDataFor(tokenCached['tokenId']).call();

    tokenCached['n'] = receipt['n'];
    tokenCached['k'] = receipt['k'];
    tokenCached['identifiers'] = '[' + receipt['identifiers'].join(", ") + ']';
}

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

async function checkSaleCommitment(commitment, tokenId, address) {
    var receipt = await anonFTContract.methods.getSaleCommitmentFor(commitment).call();
    console.log(receipt);

    return receipt['toPay'] == address && receipt['tokenId'] == tokenId;
}

async function getAllForSale() {
    var receipt = await anonFTContract.methods.getTokensForSale().call();
    console.log(receipt);
    return receipt;
}

// async function mint(ethId, n, k, identifiers) {
//     var receipt = await anonFTContract.methods.mint(
//         ethId,
//         n,
//         k,
//         identifiers
//     ).send({
//         from: CONTRACT_ACCT,
//         gas: 400000
//     });
    
//     tokenCached['tokenId'] = receipt['events']['Transfer']['returnValues']['tokenId'];
//     await getPublicParams();
// }

// async function trade(userId, recipId, tokenId, n, k, identifiers) {
//     var receipt = await anonFTContract.methods.transfer(
//         recipId,
//         tokenId,
//         n,
//         k,
//         identifiers
//     ).send({
//         from: userId,
//         gas: 400000
//     });
    
//     tokenCached['tokenId'] = receipt['events']['Transfer']['returnValues']['tokenId'];
//     await getPublicParams();
// }

init();
