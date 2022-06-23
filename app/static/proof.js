
/**
 * Encapsulates all functions and data relevant to proofs.
 * Should be included in any site that operates an off-chain proof of NFT ownership
 */


const SERVER_BASE = "http://localhost:8080/";

const proofCached = {};


/**
 * Unpacks server response and caches values in the window for use by other files
 * @param  json: JSON response from server
 */
function cacheValues(json) {
    for (const value of Object.values(json)) {
        Object.assign(proofCached, value);
    }
    console.log(proofCached);
}


/**
 * Communicates relevant request to server
 * @param  endpoint: URL endpoint to be called
 * @param  req: request body in the form of a dictionary
 * @returns: Response object
 */
async function retrieveFromServer(endpoint, req) {
    return await fetch(SERVER_BASE + endpoint, req)
}


/**
 * Packages setup parameters into valid server request
 * @params: See FiatShamir README
 * @returns: Response object
 */
async function setup(p, q, k) {
    return await retrieveFromServer(
        'setup',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                p : p,
                q : q,
                k : k
            })
        }
    );
}


/**
 * Packages prover first action parameters into valid server request
 * @params: See FiatShamir README
 * @returns: Response object
 */
async function prove1(n, k, witnesses) {
    return await retrieveFromServer(
        'prove1',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                n : n,
                k : k,
                witnesses : witnesses
            })
        }
    );
}


/**
 * Packages prover second acction parameters into valid server request
 * @params: See FiatShamir README
 * @returns: Response object
 */
async function prove2(n, k, r, challenge, witnesses) {
    return await retrieveFromServer(
        'prove2',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                n : n,
                k : k,
                r : r,
                challenge : challenge,
                witnesses : witnesses
            })
        }
    );
}


/**
 * Packages verifier first action parameters into valid server request
 * @params: See FiatShamir README
 * @returns: Response object
 */
async function verify1(k) {
    return await retrieveFromServer(
        'verify1',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                k : k
            })
        }
    );
}


/**
 * Packages verifier second action parameters into valid server request
 * @params: See FiatShamir README
 * @returns: Response object
 */
async function verify2(n, k, identifiers, x, y, challenge) {
    return await retrieveFromServer(
        'verify2',
        {
            method : 'POST',
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            body : JSON.stringify({
                n : n,
                k : k,
                identifiers : identifiers,
                x : x,
                y : y,
                challenge : challenge
            })
        }
    );
}
