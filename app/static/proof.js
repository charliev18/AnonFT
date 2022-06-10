
const SERVER_BASE = "http://localhost:8080/";

const proofCached = {};

function cacheValues(json) {
    for (const value of Object.values(json)) {
        Object.assign(proofCached, value);
    }
    console.log(proofCached);
}

/*
 * Communicates relevant request to server
 */
async function retrieveFromServer(endpoint, req) {
    return await fetch(SERVER_BASE + endpoint, req)
}

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
