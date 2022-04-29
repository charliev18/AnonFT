let message = 'Hello, JavaScript!';

let heading = document.createElement('h4');
heading.textContent = message;

document.body.appendChild(heading);

var web3 = new Web3('http://localhost:8545');
const eth = new Eth(web3.currentProvider);


