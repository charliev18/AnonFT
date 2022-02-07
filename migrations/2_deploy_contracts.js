const AnonFTFactory = artifacts.require("AnonFTFactory");

module.exports = function(deployer) {
  deployer.deploy(AnonFTFactory);
};
