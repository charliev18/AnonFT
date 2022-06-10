const AnonFTVerifier = artifacts.require("AnonFTVerifier");
const AnonFTHolder = artifacts.require("AnonFTHolder");
const AnonFTFactory = artifacts.require("AnonFTFactory");
const AnonFTFactoryProd = artifacts.require("AnonFTFactoryProd");

module.exports = function(deployer, network) {
  // deployer.deploy(AnonFTVerifier);
  // deployer.deploy(AnonFTHolder).then(function() {
  if (network == "mainnet") {
    deployer.deploy(AnonFTFactoryProd, 0x0);
  } else {
    // console.log(AnonFTHolder.address);
    deployer.deploy(AnonFTFactory);
  }
  // })
};
