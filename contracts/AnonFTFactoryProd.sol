// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "witnet-solidity-bridge/contracts/UsingWitnet.sol";
import "witnet-solidity-bridge/contracts/requests/WitnetRequest.sol";



contract AnonFTFactoryProd is ERC721, Ownable, UsingWitnet {
	using Counters for Counters.Counter;
	

	event LogNewProvableQuery(bytes description);
    event LogResult(string result);
	event Log(string message);
	event Mint(uint256 tokenId);

	struct IdentityData {
		uint256 n;
		uint256 k;
		int256[] identifiers;
	}

	Counters.Counter private _lastId;

	// Mapping from tokenId to NFT identifying information
	mapping (uint256 => IdentityData) anonymousId;
	mapping (bytes32 => IdentityData) commitments;
	mapping (uint256 => address) oraclePayments;

	// AnonFT escrow account
	address holder;

	constructor(address holderAddr, WitnetRequestBoard wrb) UsingWitnet(wrb) ERC721("AnonFTFactory", "ANFT") {
		holder = holderAddr;
	}

	modifier verifyIdentifiers(uint256 n, uint256 k, int256[] memory identifiers) {
		require(n != 0, "N identifier cannot be equal to 0");
		require(k != 0, "K identifier cannot be equal to 0");
		require(identifiers.length == k, "There must be exactly k identifiers");
		_;
	}

	function mint(uint256 n, uint256 k, int256[] memory identifiers) private verifyIdentifiers(n, k, identifiers) {
		// Generic ERC721 mint
		_lastId.increment();
		uint256 newId = _lastId.current();
		_safeMint(address(this), newId);

		updateOwnership(newId, n, k, identifiers);

		emit Mint(newId);
	}

	function transfer(address to, uint256 tokenId, uint256 n, uint256 k, int256[] calldata identifiers) external verifyIdentifiers(n, k, identifiers) {
		removeOwnership(tokenId);

		_safeTransfer(msg.sender, to, tokenId, "");

		updateOwnership(tokenId, n, k, identifiers);
	}

	function removeOwnership(uint256 tokenId) private {
		delete anonymousId[tokenId];
	}

	function updateOwnership(uint256 tokenId, uint256 n, uint256 k, int256[] memory identifiers) private {
		anonymousId[tokenId] = IdentityData(n, k, identifiers);
	}

	function getLastID() public view returns (uint256) {
		return _lastId.current();
	}

	function getOwnershipDataFor(uint256 tokenId) public view returns (IdentityData memory) {
		return anonymousId[tokenId];
	}

	/*
	 * Registers commitment for a Tornado snark proof for verification of receipt later on
	 * @param snarkStub generated proof to withdraw from Tornado truncated to 32 bytes
	 * @param ...       public identifier parameters
	 */
	function commitID(bytes32 snarkStub, uint256 n, uint256 k, int256[] calldata identifiers) external verifyIdentifiers(n, k, identifiers) {
		require(commitments[snarkStub].n == 0, "This proof already has a commitment");

		commitments[snarkStub] = IdentityData(n, k, identifiers);
	}

	/*
	 * Retrieves the commited values for a Tornado proof
	 * @param snarkStup generated proof to withdraw from Tornado truncated to 32 bytes
	 */
	function checkCommitment(bytes32 snarkStub) external view returns (IdentityData memory) {
		return commitments[snarkStub];
	}

	/*
	 * Function to receive funds: only callable by the Tornado payment contract
	 */
	receive() external payable {
		require(msg.sender == address(0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7));
		
	}

	// /* <====================== Interactions with oracle ========================> */

	// /* 
	//  * Gets only the relevant byte information to confirm the previous commitment made in commitID()
	//  * @param str the input bytestring of a transaction retrieved by the oracle
	//  */
	// function extractProof(string memory str) private pure returns (bytes32) {
	// 	bytes memory strBytes = bytes(str);
	// 	bytes32 ret;
	// 	for (uint i = 0; i < 32; i++) {
    // 		ret |= bytes32(strBytes[256 + i] & 0xFF) >> (i * 8);
  	// 	}
	// 	return ret;
	// }

	// /*
	//  * Called by the oracle to return the response for request string provided in request()
	//  * If the response corresponds to a previous commitment, repays original caller and mints new NFT
	//  * Otherwise reverts
	//  */
	// function getResponse(uint256 queryId) external {
	// 	require(_witnetCheckResultAvailability(queryId), "Response not available yet");
	// 	require(oraclePayments[queryId] != address(0), "Query was not registered on this contract");

	// 	Witnet.Result memory result = _witnetReadResult(queryId);

	// 	require(witnet.isOk(result), "Request failed");
	// 	emit LogResult(witnet.asString(result));
    //     bytes32 proof = extractProof(witnet.asString(result));
		
	// 	require(commitments[proof].n != 0, "No commitment exists for this proof");

	// 	mint(commitments[proof].n, commitments[proof].k, commitments[proof].identifiers);

	// 	oraclePayments[queryId].call{value: 500000000000};

	// 	delete oraclePayments[queryId];
	// 	delete commitments[proof];
    // }

	// /*
	//  * Function called by the oracle to return the response for request string provided in request()
	//  */
	// function request(bytes32 txHash) external payable returns (uint256) {
	// 	WitnetRequest req = new WitnetRequest(
	// 		bytes(
	// 			abi.encodePacked(
	// 				hex"68747470733a2f2f6170692d676f65726c692e65746865727363616e2e696f2f6170693f6d6f64756c653d70726f787926616374696f6e3d6574685f6765745472616e73616374696f6e427948617368267478686173683d",
	// 				txHash,
	// 				hex"266170696b65793d44323335574351504133575053463757395549584645374254373854504254533449"
	// 			)
	// 		)
	// 	);

	// 	emit LogNewProvableQuery(req.bytecode());
	// 	// _witnetEstimateReward(_gasPrice);
	// 	witnet.estimateReward(tx.gasprice);
		
	// 	(uint256 queryId, ) = _witnetPostRequest(req);
	// 	oraclePayments[queryId] = tx.origin;

	// 	return queryId;
    // }
}
