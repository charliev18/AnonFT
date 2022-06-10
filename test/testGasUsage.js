const Web3 = require('web3');
const anonFTjson = require('../build/contracts/AnonFTFactory.json');
const anonFTAddr =  "0xE12363E7b558A15f448845B7C3ED419B161B7E15";
const provider = "wss://goerli.infura.io/ws/v3/1154aaae2dda49bf92041c41761bf9c6";
const accountAddr = "0x8135eCAc30E84cDEe2Ee4a8e35A6c6B2Be0Af7b5";
const PRIVATE_KEY = "0x69a618d4ada04be6f96800c84525497534ccb88766fd02f45bc376f65aabdcb9";
const gasLimit = 3000000;

let web3, nonce, anonFTContract, forSale, tokenWitnesses, numTransactions;

const mintGas = [624288, 669090,713904, 758718, 848346, 937976, 982790, 1117233, 1386120, 1655006, 2192784, 3806118]
const sellGas = [7452468, 4123052, 3000142, 2476834, 1915348, 1670955, 1557288, 1382470, 1208216, 1104989, 1023150, 925490]

function init() {
    web3 = new Web3(provider);
    anonFTContract = new web3.eth.Contract(anonFTjson.abi, anonFTAddr);
    forSale = [];
    numTransactions = 0;
    tokenWitnesses = {
        // 4: [ 1 ],
        // 51: [ 1, 2 ],
        // 6: [ 1, 2, 3 ],
        // 53: [ 1, 2, 3, 4 ],
        // 8: [ 1, 2, 3, 4, 5, 6 ],
        // 43: [
        //   1, 2, 3, 4,
        //   5, 6, 7, 8
        // ],
        // 44: [
        //   1, 2, 3, 4, 5,
        //   6, 7, 8, 9
        // ],
        // 44: [
        //    1,  2, 3, 4,  5,
        //    6,  7, 8, 9, 10,
        //   11, 12
        // ],
        // 12: [
        //    1,  2,  3,  4,  5,  6,  7,
        //    8,  9, 10, 11, 12, 13, 14,
        //   15, 16, 17, 18
        // ],
        // 13: [
        //    1,  2,  3,  4,  5,  6,  7,  8,
        //    9, 10, 11, 12, 13, 14, 15, 16,
        //   17, 18, 19, 20, 21, 22, 23, 24
        // ],
        // 14: [
        //    1,  2,  3,  4,  5,  6,  7,  8,  9,
        //   10, 11, 12, 13, 14, 15, 16, 17, 18,
        //   19, 20, 21, 22, 23, 24, 25, 26, 27,
        //   28, 29, 30, 31, 32, 33, 34, 35, 36
        // ],
        // 15: [
        //    1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12,
        //   13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
        //   25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
        //   37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
        //   49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
        //   61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72
        // ]
    };
    // let calldata = anonFTContract.methods.mintDummy(209, 4, JSON.parse("[-16, 130, 188, 102]")).encodeABI();
    // submitTransaction(anonFTAddr, calldata).then(() => {
        runTests();
    // })
    // getForSale();
    // console.log(calculate(mintGas, sellGas));
}

async function runTests() {
    // await testMint();
    // console.log(tokenWitnesses);

    // await testSell();

    let forSale = await getForSale();
    console.log(forSale);
    await testBuy(forSale);
}

async function getForSale() {
    return await anonFTContract.methods.getTokensForSale().call();
}

// const kVals = [1,2,3,4,6,8,9,12,18,24,36,72]
const kVals = [1]

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMint() {
    console.log("TESTING MINT GAS CONSUMPTION")

    let gasUsage = {};
    let gasUsed = 0
    for(const k of kVals) {
        await sleep(1000);
        gasUsed = 0
        commitment = k + 1000;
        ident = {
            n: 31861,
            identifiers: Array.apply(null, Array(k)).map(function (x, i) { return modInverse((i + 1) * (i + 1), 31861); })
        }
        console.log(ident);

        calldata = anonFTContract.methods.commitID(commitment, ident.n, k, ident.identifiers).encodeABI();

        let tx = await submitTransaction(anonFTAddr, calldata);
        if (!tx.status) continue;

        gasUsed += tx.gasUsed;

        console.log(tx.gasUsed);

        calldata = anonFTContract.methods.confirmAndMint(commitment).encodeABI();
        tx = await submitTransaction(anonFTAddr, calldata);
        if (!tx.status) continue;

        gasUsed += tx.gasUsed;
        console.log(tx.gasUsed);

        gasUsage[k] = generateValues(gasUsed);

        tokenWitnesses[parseInt(tx.logs[1].data, 16)] = Array.apply(null, Array(k)).map(function (x, i) { return i + 1; });
    }

    console.log(gasUsage);
}

function modInverse(a, m) {
    // validate inputs
    [a, m] = [Number(a), Number(m)]

    if (Number.isNaN(a) || Number.isNaN(m)) {
        return NaN // invalid input
    }

    a = (a % m + m) % m

    if (!a || m < 2) {
        return NaN // invalid input
    }

    // find the gcd
    const s = []
    let b = m

    while(b) {
        [a, b] = [b, a % b]
        s.push({a, b})
    }

    if (a !== 1) {
        return NaN // inverse does not exists
    }
    // find the inverse
    let x = 1
    let y = 0
    for(let i = s.length - 2; i >= 0; --i) {
        [x, y] = [y,  x - y * Math.floor(s[i].a / s[i].b)]
    }

    return (y % m + m) % m
}

async function testSell() {
    console.log("TESTING SELL GAS CONSUMPTION")

    let gasUsage = {};
    let gasUsed = 0;
    let proofGas = 0;
    for (const [tokenId, witnesses] of Object.entries(tokenWitnesses)) {
        numTransactions = 0;
        let start = Date.now();
        let k = witnesses.length;
        console.log(`TOKEN ID: ${tokenId}, K: ${k}`);

        await sleep(1000);

        gasUsed = 0;
        proofGas = 0;
        let commitment = k + 1050
        
        let calldata = anonFTContract.methods.initiateSaleProof(commitment, tokenId, accountAddr).encodeABI();

        let tx = await submitTransaction(anonFTAddr, calldata);
        if (!tx.status) continue;

        gasUsed += tx.gasUsed;

        console.log(tx.gasUsed);

        remainingVerifications = await anonFTContract.methods.getNumVerifications(commitment).call();
        console.log(`Initial T: ${remainingVerifications}`);
        

        while (true) {
            let r = Math.floor(Math.random() * 20);
            let x = r * r;

            calldata = anonFTContract.methods.receiveChallenge(commitment, x).encodeABI();

            tx = await submitTransaction(anonFTAddr, calldata);
            if (!tx.status) continue;

            let initChallenge = tx['logs'][0]['data'];

            proofGas += tx.gasUsed;
            gasUsed += tx.gasUsed;
            console.log(tx.gasUsed);
            console.log(`RETURNED CHALLENGE: ${initChallenge}`);

            challenge = parseInt(initChallenge, 16).toString(2); // Convert hex to binary
            challenge = challenge.substring(challenge.length - k);
            challenge = challenge.split("").reverse();
            challenge = challenge.map(val => parseInt(val, 10));

            while (challenge.length < k) {
                challenge.push(0)
            }

            console.log(`Challenge: ${challenge} of length ${challenge.length}`)

            let secrets = witnesses.map(function (x, i) { 
                if (challenge[i] == 1) {
                    return x;
                } else {
                    return 1;
                }
            }).reduce((a,b) => a * b % 31861);

            let y = (secrets * r) % 31861;
            console.log(`Y: ${y}`);

            calldata = anonFTContract.methods.submitVerificationDummy(commitment, y, initChallenge).encodeABI();
            tx = await submitTransaction(anonFTAddr, calldata);
            if (!tx.status) continue;

            proofGas += tx.gasUsed;
            gasUsed += tx.gasUsed;
            console.log(tx.gasUsed);
            await sleep(1000);

            remainingVerifications = await anonFTContract.methods.getNumVerifications(commitment).call();
            console.log(`T: ${remainingVerifications}`);
            if (remainingVerifications == 0) {
                break;
            }
        }

        let stop = Date.now()

        usage = generateSellValues(gasUsed, proofGas, numTransactions, (stop - start)/1000);
        gasUsage[k] = usage

        console.log(`K: ${k}`); 
        console.log(usage);
        forSale.push(tokenId);
    }

    console.log(gasUsage);
}

async function testBuy(tokens) {

    let gasUsage = {};
    let gasUsed = 0
    for(const k of kVals) {
        await sleep(1000);
        gasUsed = 0
        commitment = k + 100;
        ident = {
            n: 31861,
            identifiers: Array.apply(null, Array(k)).map(function (x, i) { return (i + 1) * 100; })
        }
        console.log(ident);
        let tokenID = tokens.pop();

        calldata = anonFTContract.methods.commitID(commitment, ident.n, k, ident.identifiers).encodeABI();

        let tx = await submitTransaction(anonFTAddr, calldata);
        gasUsed += tx.gasUsed;

        console.log(tx.gasUsed);

        calldata = anonFTContract.methods.confirmAndTransfer(tokenID, commitment).encodeABI();
        tx = await submitTransaction(anonFTAddr, calldata);
        gasUsed += tx.gasUsed;
        console.log(tx.gasUsed);

        usage = generateValues(gasUsed);
        console.log(usage);
        gasUsage[k] = usage;
    }

    console.log(gasUsage);
}

function generateValues(gasUsed) {
    fees = gasUsed * 0.000000001 * 60;
    gbp = fees * 2000;

    actual = gasUsed + 349351;
    actualFees = actual * 0.000000001 * 60;
    actualgbp = actualFees * 2000;
    return {'gasUsed': gasUsed, 
            'gasFees': fees, 
            'cost': gbp,
            'actualGas': actual,
            'actualFees': actualFees,
            'actualCost': actualgbp
        }
}

function generateSellValues(gasUsed, proofGas, numTransactions, timeTaken) {
    fees = gasUsed * 0.000000001 * 60;
    gbp = fees * 2000;

    proofFees = proofGas * 0.000000001 * 60;
    proofGBP = proofFees * 2000;

    actual = gasUsed + 349351;
    actualFees = actual * 0.000000001 * 60;
    actualgbp = actualFees * 2000;
    return {'gasUsed': gasUsed, 
            'gasFees': fees, 
            'cost': gbp,
            'proofGas': proofGas,
            'proofFees': proofFees,
            'proofCost': proofGBP,
            'actualGas': actual,
            'actualFees': actualFees,
            'actualCost': actualgbp,
            'numTransactions': numTransactions,
            'timeTaken': timeTaken
        }
}

async function submitTransaction(destination, calldata) {
    let _nonce = await getNonce();
    nonce = nonce > _nonce ? nonce : _nonce;
    console.log(`Creating new transaction with nonce: ${nonce}`);

    tx = {
        nonce: nonce,
        to: destination,
        data: calldata,
        gas: gasLimit
        // gasPrice: 1000000
    }
    return web3.eth.accounts.signTransaction(tx, PRIVATE_KEY)
        .then((res) => {
            return res.rawTransaction;
        })
        .then((raw) => {
            nonce += 1;
            numTransactions += 1;
            return web3.eth.sendSignedTransaction(raw);
        })
        .then((receipt) => {
            // console.log(receipt);
            return receipt;
        }).catch(err => {
            console.log(err);
            return err;
        }
    );
}

async function getNonce() {
    return await web3.eth.getTransactionCount(accountAddr);
}

function calculate(gasA, gasB) {
    return gasA.map((x, i) => {
        let total = x + gasB[i];
        let fees = total * 0.000000001 * 60;
        return [total, fees, fees * 2000];
    })
}

init();
