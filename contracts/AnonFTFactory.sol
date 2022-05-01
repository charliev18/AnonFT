// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";



contract AnonFTFactory is ERC721, Ownable {
	using Counters for Counters.Counter;

	struct IdentityData {
		uint256 n;
		uint256 k;
		uint256[] identifiers;
	}

	Counters.Counter private _lastId;

	// Mapping from tokenId to NFT identifying information
	mapping (uint256 => IdentityData) anonymousId;

	// event Transfer(address indexed _from, address indexed _to, uint256 _value);

	constructor() ERC721("AnonFTFactory", "ANFT") {
		_lastId.reset();
	}

	function mint(address to, uint256 n, uint256 k, uint256[] calldata identifiers) external returns (uint256) {
		// Generic ERC721 mint
		_lastId.increment();
		uint256 newId = _lastId.current();
		_safeMint(to, newId);

		updateOwnership(newId, n, k, identifiers);

		return newId;
	}

	function transfer(address to, uint256 tokenId, uint256 n, uint256 k, uint256[] calldata identifiers) external {
		removeOwnership(tokenId);

		_safeTransfer(msg.sender, to, tokenId, "");

		updateOwnership(tokenId, n, k, identifiers);
	}

	function removeOwnership(uint256 tokenId) private {
		delete anonymousId[tokenId];
	}

	function updateOwnership(uint256 tokenId, uint256 n, uint256 k, uint256[] memory identifiers) private {
		anonymousId[tokenId] = IdentityData(n, k, identifiers);
	}

	function getLastID() public view returns (uint256) {
		return _lastId.current();
	}

	function getOwnershipDataFor(uint256 tokenId) public view returns (IdentityData memory) {
		return anonymousId[tokenId];
	}
}
