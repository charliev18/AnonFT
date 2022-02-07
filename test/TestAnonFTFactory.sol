pragma solidity >=0.4.25;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/AnonFTFactory.sol";

contract TestAnonFTFactory {

  function testMintUsingDeployedContract() public {
    AnonFTFactory anonFT = AnonFTFactory(DeployedAddresses.AnonFTFactory());
    uint expected = anonFT.mint(tx.origin);

    Assert.equal(anonFT.getLastID(), expected, "Minted ID and stored last ID value do not match");
  }

}
