// SPDX-License-Identifier: MIT
pragma solidity >=0.4.2;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";



contract AnonFTFactory is ERC721, Ownable {
	using Counters for Counters.Counter;

	Counters.Counter private _lastId;

	// event Transfer(address indexed _from, address indexed _to, uint256 _value);

	constructor() ERC721("AnonFTFactory", "ANFT") {
		_lastId.reset();
	}

	function mint(address to) public returns (uint256){
		_lastId.increment();
		uint256 newId = _lastId.current();
		_safeMint(to, newId);
		return newId;
	}

	function getLastID() public view returns (uint256) {
		return _lastId.current();
	}
}
