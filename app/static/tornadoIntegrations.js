const axios = require('axios');
const snarkjs = require('snarkjs');
const buildGroth16 = require('websnark/src/groth16');
const websnarkUtils = require('websnark/src/utils');
const assert = require('assert');
const circomlib = require('circomlib');
const bigInt = snarkjs.bigInt;
const { toBN, BN } = require('web3-utils');
const merkleTree = require('fixed-merkle-tree');
const BigNumber = require('bignumber.js');
const { resolve } = require('path');

let web3, tornadoContract, tornadoInstance, circuit, proving_key, groth16, netId, netName, netSymbol, multiCall, subgraph;
let MERKLE_TREE_HEIGHT;

let deployed = {
    netId5: {
        'eth': {
            'instanceAddress': {
                '0.1': '0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7',
                '1': '0x3aac1cC67c2ec5Db4eA850957b967Ba153aD6279',
                '10': '0x723B78e67497E85279CB204544566F4dC5d2acA0',
                '100': '0x0E3A09dDA6B20aFbB34aC7cD4A6881493f3E7bf7'
            },
            'deployedBlockNumber': {
                '0.1': 3782581,
                '1': 3782590,
                '10': 3782593,
                '100': 3782596
            },
            'miningEnabled': true,
            'symbol': 'ETH',
            'decimals': 18
        },
        proxy: '0x454d870a72e29d5e5697f635128d18077bd04c60',
        multicall: '0x77dCa2C955b15e9dE4dbBCf1246B4B85b651e50e',
        subgraph: 'https://api.thegraph.com/subgraphs/name/tornadocash/goerli-tornado-subgraph',
    }
}

async function init() {
    web3 = window.web3_eth;
    currency = 'eth';
    amount = 0.1;
    groth16 = await buildGroth16();
    netId = await web3.eth.net.getId();
    netName = getCurrentNetworkName();
    netSymbol = getCurrentNetworkSymbol();
    contractJson = await (await fetch('/build/contracts/TornadoProxy.abi.json')).json();
    instanceJson = await (await fetch('/build/contracts/Instance.abi.json')).json();
    circuit = await (await fetch('/build/circuits/tornado.json')).json();
    proving_key = await (await fetch('/build/circuits/tornadoProvingKey.bin')).arrayBuffer();
    MERKLE_TREE_HEIGHT = 20;
    tornadoInstance = deployed[`netId${netId}`][currency].instanceAddress[amount];
    deployedBlockNumber = deployed[`netId${netId}`][currency].deployedBlockNumber[amount];
    tornadoAddress = deployed[`netId${netId}`].proxy;
    multiCall = deployed[`netId${netId}`].multicall;
    subgraph = deployed[`netId${netId}`].subgraph;
    
    tornadoContract = new web3.eth.Contract(instanceJson, tornadoInstance);

    window.withdrawProof = withdrawProof;
    window.commitToProof = commitToProof;
    window.anonymousPayment = anonymousPayment;
    window.confirmPayment = confirmPayment;
    window.initOwnershipProof = initOwnershipProof;
    window.proveOwnershipCommit = proveOwnershipCommit;
    window.proveOwnershipVerify = proveOwnershipVerify;
}

// List fetched from https://github.com/trustwallet/assets/tree/master/blockchains
function getCurrentNetworkName() {
    switch (netId) {
        case 1:
            return 'Ethereum';
        case 5:
            return 'Goerli';
        default:
            return 'testRPC';
    }
}

function getCurrentNetworkSymbol() {
    return 'ETH';
}

/* Compute pedersen hash */
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0];

/* Display ETH account balance */
async function printETHBalance({ address, name }) {
    const checkBalance = new BigNumber(await web3.eth.getBalance(address)).div(BigNumber(10).pow(18));
    console.log(`${name} balance is`, rmDecimalBN(checkBalance), `${netSymbol}`);
}

/** Remove Decimal without rounding with BigNumber */
function rmDecimalBN(bigNum, decimals = 6) {
    return new BigNumber(bigNum).times(BigNumber(10).pow(decimals)).integerValue(BigNumber.ROUND_DOWN).div(BigNumber(10).pow(decimals)).toNumber();
}

/* BigNumber to hex string of specified length */
function toHex(number, length = 32) {
    const str = number instanceof Buffer ? number.toString('hex') : bigInt(number).toString(16);
    return '0x' + str.padStart(length * 2, '0');
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/* Use MultiCall Contract */
async function useMultiCall(queryArray) {
    const multiCallABI = await (await fetch('/build/contracts/Multicall.abi.json')).json();
    const multiCallContract = new web3.eth.Contract(multiCallABI, multiCall);
    const { returnData } = await multiCallContract.methods.aggregate(queryArray).call();
    return returnData;
}

/*
 * Create deposit object from secret and nullifier
 */
function createDeposit({ nullifier, secret }) {
    const deposit = { nullifier, secret };
    deposit.preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)]);
    deposit.commitment = pedersenHash(deposit.preimage);
    deposit.commitmentHex = toHex(deposit.commitment);
    deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31));
    deposit.nullifierHex = toHex(deposit.nullifierHash);
    return deposit;
}

/*
 * Parses Tornado.cash note
 * @param noteString the note
 */
function parseNote(noteString) {
    console.log(noteString);
    const noteRegex = /tornado-(?<currency>\w+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{124})/g
    const match = noteRegex.exec(noteString);
    if (!match) {
        throw new Error('The note has invalid format');
    }
  
    const buf = Buffer.from(match.groups.note, 'hex');
    const nullifier = bigInt.leBuff2int(buf.slice(0, 31));
    const secret = bigInt.leBuff2int(buf.slice(31, 62));
    const deposit = createDeposit({ nullifier, secret });
    const netId = Number(match.groups.netId);
  
    return {
        currency: match.groups.currency,
        amount: match.groups.amount,
        netId,
        deposit
    }
}

async function loadCachedEvents({ type, currency, amount }) {
    try {
        const module = await (await fetch(`/cache/${netName.toLowerCase()}/${type}s_${currency}_${amount}.json`)).json();
    
        if (module) {
            const events = module;
    
            return {
                events,
                lastBlock: events[events.length - 1].blockNumber
            }
        }
    } catch (err) {
        console.log(err);
        console.log("Error fetching cached files, syncing from block", deployedBlockNumber);
        return {
            events: [],
            lastBlock: deployedBlockNumber,
        }
    }
}

async function fetchEvents({ type, currency, amount }) {
    if (type === "withdraw") {
        type = "withdrawal";
    }
  
    const cachedEvents = await loadCachedEvents({ type, currency, amount });
    const startBlock = cachedEvents.lastBlock + 1;
  
    console.log("Loaded cached",amount,currency.toUpperCase(),type,"events for",startBlock,"block");
    console.log("Fetching",amount,currency.toUpperCase(),type,"events for",netName,"network");
  
    async function syncEvents() {
        try {
            let targetBlock = await web3.eth.getBlockNumber();
            let chunks = 1000;
            let toUpdate = [];
            console.log("Querying latest events from RPC");
    
            for (let i = startBlock; i < targetBlock; i += chunks) {
                let fetchedEvents = [];
        
                function mapDepositEvents() {
                    fetchedEvents = fetchedEvents.map(({ blockNumber, transactionHash, returnValues }) => {
                        const { commitment, leafIndex, timestamp } = returnValues;
                        return {
                            blockNumber,
                            transactionHash,
                            commitment,
                            leafIndex: Number(leafIndex),
                            timestamp
                        }
                    });
                }
        
                function mapWithdrawEvents() {
                    fetchedEvents = fetchedEvents.map(({ blockNumber, transactionHash, returnValues }) => {
                    const { nullifierHash, to, fee } = returnValues;
                    return {
                        blockNumber,
                        transactionHash,
                        nullifierHash,
                        to,
                        fee
                    }
                    });
                }
        
                function mapLatestEvents() {
                    if (type === "deposit") {
                        mapDepositEvents();
                    } else {
                        mapWithdrawEvents();
                    }
                }
        
                async function fetchWeb3Events(i) {
                    let j;
                    if (i + chunks - 1 > targetBlock) {
                        j = targetBlock;
                    } else {
                        j = i + chunks - 1;
                    }
                    await tornadoContract.getPastEvents(capitalizeFirstLetter(type), {
                        fromBlock: i,
                        toBlock: j,
                    }).then(r => { fetchedEvents = fetchedEvents.concat(r); console.log("Fetched", amount, currency.toUpperCase(), type, "events to block:", j) }, err => { console.error(i + " failed fetching", type, "events from node", err); process.exit(1); }).catch(console.log);
        
                    if (type === "deposit"){
                        mapDepositEvents();
                    } else {
                        mapWithdrawEvents();
                    }
                }
        
                
                await fetchWeb3Events(i);
                toUpdate = toUpdate.concat(fetchedEvents);
            }
            async function updateCache() {
                await fetch(`${SERVER_BASE}tornadoCache`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json;charset=utf-8'},
                    body : JSON.stringify({
                        fname: `cache/${netName.toLowerCase()}/${type}s_${currency}_${amount}.json`,
                        to_update: toUpdate
                    })
                });
            }

            await updateCache();

        } catch (error) {
            throw new Error("Error while updating cache");
        }
    }
  
    async function syncGraphEvents() {  
        async function queryLatestTimestamp() {
            options = {}
            try {
                const variables = {
                    currency: currency.toString(),
                    amount: amount.toString()
                }
                if (type === "deposit") {
                    const query = {
                        query: `
                            query($currency: String, $amount: String){
                                deposits(first: 1, orderBy: timestamp, orderDirection: desc, where: {currency: $currency, amount: $amount}) {
                                timestamp
                                }
                            }
                        `,
                        variables
                    }
                    const querySubgraph = await axios.post(subgraph, query, options);
                    const queryResult = querySubgraph.data.data.deposits;
                    const result = queryResult[0].timestamp;
                    return Number(result);
                } else {
                    const query = {
                        query: `
                            query($currency: String, $amount: String){
                                withdrawals(first: 1, orderBy: timestamp, orderDirection: desc, where: {currency: $currency, amount: $amount}) {
                                timestamp
                                }
                            }
                        `,
                        variables
                    }
                    const querySubgraph = await axios.post(subgraph, query, options);
                    const queryResult = querySubgraph.data.data.withdrawals;
                    const result = queryResult[0].timestamp;
                    return Number(result);
                }
            } catch (error) {
                console.error("Failed to fetch latest event from thegraph");
            }
        }
  
        async function queryFromGraph(timestamp) {
            try {
                const variables = {
                    currency: currency.toString(),
                    amount: amount.toString(),
                    timestamp: timestamp
                }
                if (type === "deposit") {
                    const query = {
                        query: `
                            query($currency: String, $amount: String, $timestamp: Int){
                                deposits(orderBy: timestamp, first: 1000, where: {currency: $currency, amount: $amount, timestamp_gt: $timestamp}) {
                                blockNumber
                                transactionHash
                                commitment
                                index
                                timestamp
                                }
                            }
                        `,
                        variables
                    }
                    const querySubgraph = await axios.post(subgraph, query, options);
                    const queryResult = querySubgraph.data.data.deposits;
                    const mapResult = queryResult.map(({ blockNumber, transactionHash, commitment, index, timestamp }) => {
                        return {
                            blockNumber: Number(blockNumber),
                            transactionHash,
                            commitment,
                            leafIndex: Number(index),
                            timestamp
                        }
                    });
                    return mapResult;
                } else {
                    const query = {
                        query: `
                        query($currency: String, $amount: String, $timestamp: Int){
                            withdrawals(orderBy: timestamp, first: 1000, where: {currency: $currency, amount: $amount, timestamp_gt: $timestamp}) {
                            blockNumber
                            transactionHash
                            nullifier
                            to
                            fee
                            }
                        }
                        `,
                        variables
                    }
                    const querySubgraph = await axios.post(subgraph, query, options);
                    const queryResult = querySubgraph.data.data.withdrawals;
                    const mapResult = queryResult.map(({ blockNumber, transactionHash, nullifier, to, fee }) => {
                        return {
                            blockNumber: Number(blockNumber),
                            transactionHash,
                            nullifierHash: nullifier,
                            to,
                            fee
                        }
                    });
                    return mapResult;
                }
            } catch (error) {
                console.error(error);
            }
        }
  
        async function updateCache(toUpdate) {
            await fetch(`${SERVER_BASE}tornadoCache`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json;charset=utf-8'},
                body : JSON.stringify({
                    fname: `cache/${netName.toLowerCase()}/${type}s_${currency}_${amount}.json`,
                    to_update: toUpdate
                })
            });
        }
  
        async function fetchGraphEvents() {
            console.log("Querying latest events from TheGraph");
            const latestTimestamp = await queryLatestTimestamp();
            if (latestTimestamp) {
                const getCachedBlock = await web3.eth.getBlock(startBlock);
                const cachedTimestamp = getCachedBlock.timestamp;

                let toUpdate = []
                for (let i = cachedTimestamp; i < latestTimestamp;) {
                    const result = await queryFromGraph(i);
                    if (Object.keys(result).length === 0) {
                        i = latestTimestamp;
                    } else {
                        if (type === "deposit") {
                            const resultBlock = result[result.length - 1].blockNumber;
                            const resultTimestamp = result[result.length - 1].timestamp;
                            toUpdate = toUpdate.concat(result);
                            i = resultTimestamp;
                            console.log("Fetched", amount, currency.toUpperCase(), type, "events to block:", Number(resultBlock));
                        } else {
                            const resultBlock = result[result.length - 1].blockNumber;
                            const getResultBlock = await web3.eth.getBlock(resultBlock);
                            const resultTimestamp = getResultBlock.timestamp;
                            toUpdate = toUpdate.concat(result);
                            i = resultTimestamp;
                            console.log("Fetched", amount, currency.toUpperCase(), type, "events to block:", Number(resultBlock));
                        }
                    }
                }
                await updateCache(toUpdate);

            } else {
                console.log("Fallback to web3 events");
                await syncEvents();
            }
        }
        await fetchGraphEvents();
    }
    if (!subgraph) {
        await syncGraphEvents();
    } else {
        await syncEvents();
    }
  
    async function loadUpdatedEvents() {
        const updatedEvents = await (await fetch(`cache/${netName.toLowerCase()}/${type}s_${currency}_${amount}.json`)).json();
        const updatedBlock = updatedEvents[updatedEvents.length - 1].blockNumber;
        console.log("Cache updated for Tornado",type,amount,currency,"instance to block",updatedBlock,"successfully");
        console.log(`Total ${type}s:`, updatedEvents.length);
        return updatedEvents;
    }
    const events = await loadUpdatedEvents();
    return events;
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the tornado, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
 async function generateMerkleProof(deposit, currency, amount) {
    let leafIndex = -1;
    // Get all deposit events from smart contract and assemble merkle tree from them
  
    const cachedEvents = await fetchEvents({ type: 'deposit', currency, amount });
  
    const leaves = cachedEvents
      .sort((a, b) => a.leafIndex - b.leafIndex) // Sort events in chronological order
      .map((e) => {
        const index = toBN(e.leafIndex).toNumber();
  
        if (toBN(e.commitment).eq(toBN(deposit.commitmentHex))) {
            leafIndex = index;
        }
        return toBN(e.commitment).toString(10);
      });
    const tree = new merkleTree(MERKLE_TREE_HEIGHT, leaves);
  
    // Validate that our data is correct
    const root = tree.root();
    let isValidRoot, isSpent;
    if (!multiCall) {
        const callContract = await useMultiCall([[tornadoContract._address, tornadoContract.methods.isKnownRoot(toHex(root)).encodeABI()], [tornadoContract._address, tornadoContract.methods.isSpent(toHex(deposit.nullifierHash)).encodeABI()]])
        isValidRoot = web3.eth.abi.decodeParameter('bool', callContract[0]);
        isSpent = web3.eth.abi.decodeParameter('bool', callContract[1]);
    } else {
        isValidRoot = await tornadoContract.methods.isKnownRoot(toHex(root)).call();
        isSpent = await tornadoContract.methods.isSpent(toHex(deposit.nullifierHash)).call();
    }
    assert(isValidRoot === true, 'Merkle tree is corrupted');
    assert(isSpent === false, 'The note is already spent');
    assert(leafIndex >= 0, 'The deposit is not found in the tree');
  
    // Compute merkle proof of our commitment
    const { pathElements, pathIndices } = tree.path(leafIndex);
    return { root, pathElements, pathIndices };
  }


/**
 * SOURCE: LINK TO GITHUB
 * 
 * Generate SNARK proof for withdrawal
 * @param deposit Deposit object
 * @param recipient Funds recipient
 */
 async function generateProof(deposit, currency, amount, recipient, relayerAddr) {
    // Compute merkle proof of our commitment
    console.log("Generating ZK proof");
    console.log("recipient ", recipient);
    const { root, pathElements, pathIndices } = await generateMerkleProof(deposit, currency, amount);
  
    // Prepare circuit input
    const input = {
        // Public snark inputs
        root: root,
        nullifierHash: deposit.nullifierHash,
        recipient: bigInt(recipient),
        relayer: bigInt(relayerAddr),
        fee: bigInt(100000),
        refund: bigInt(0),
    
        // Private snark inputs
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices
    }
  
    console.log('Generating SNARK proof');
    console.time('Proof time');
    const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key);
    const { proof } = websnarkUtils.toSolidityInput(proofData);
    console.timeEnd('Proof time');
  
    const args = [
        toHex(input.root),
        toHex(input.nullifierHash),
        toHex(input.recipient, 20),
        toHex(input.relayer, 20),
        toHex(input.fee),
        toHex(input.refund)
    ];
  
    return { proof, args };
}

/**
 * Do an ETH withdrawal to the contract address
 * @param noteString Note to withdraw
 */
async function withdrawProof(noteString, relayerAddr) {
    console.log("Withdrawing");
    const { currency, amount, netId, deposit } = parseNote(noteString);

    if (netId !== 5) {
        console.log("Note for different chain");
    }

    let recip = window.CONTRACT_ADDR;


    return await generateProof(deposit, currency, amount, recip, relayerAddr);

    // await printETHBalance({ address: recip, name: 'recipient' });
}

async function commitToProof(relayerURL, n, k, identifiers, commitment) {
    const resp = await axios.post(relayerURL + 'commit', {
        publicIds: {
            n: n,
            k: k,
            identifiers: identifiers
        },
        commitment: commitment
    })

    return resp.data;
}

async function anonymousPayment(relayerURL, proof, args) {
    const resp = await axios.post(relayerURL + 'pay', {
        contract: tornadoInstance,
        proof,
        args
    });

    return resp.data;
}

async function confirmPayment(relayerURL, commitment, tokenId=0) {
    const resp = await axios.post(relayerURL + 'confirm', {
        commitment: commitment,
        tokenId: tokenId
    });

    return resp.data;
}

async function initOwnershipProof(relayerURL, commitment, tokenId, address) {
    const resp = await axios.post(relayerURL + 'initProof', {
        commitment: commitment,
        tokenId: tokenId,
        address: address
    });

    return resp.data;
}

async function proveOwnershipCommit(relayerURL, commitment, x) {
    const resp = await axios.post(relayerURL + 'proveCommit', {
        commitment: commitment,
        x: x
    });

    return resp.data;
}

async function proveOwnershipVerify(relayerURL, commitment, y) {
    const resp = await axios.post(relayerURL + 'proveVerify', {
        commitment: commitment,
        y: y
    });

    return resp.data;
}

init();
