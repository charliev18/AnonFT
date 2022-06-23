// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./AnonFTVerifier.sol";
import "./AnonFTHolder.sol";
import "./FiatShamirAnonFT.sol";


contract AnonFTMarketplace is FiatShamirAnonFT, ERC721, Ownable {
	using Counters for Counters.Counter;
	
	event Mint(uint256 tokenId);

	struct SaleCommit {
		uint256 tokenId; 	// ID of the token to put up for sale
		address toPay;  	// Address to pay out to
		uint256 amount; 	// Amount of Wei to pay out
	}

	struct PaymentData {
		address toPay;		// Address to pay out to
		uint256 amount;		// Amount of Wei to pay out
	}

	// Default NFT price in Wei
	uint256 DEFAULT_PRICE = 50000000000000000;

	Counters.Counter private _lastId;

	// Mapping from purchase commitments to sale information
	mapping(uint256 => SaleCommit) private sellCommitments;

	// Mapping from tokenIDs to payment information
	mapping(uint256 => PaymentData) private payments;

	// List of all token IDs that have been marked for sale
	uint256[] private forSale;

	// Mapping from tokenIDs to index in forSale array for efficient deletes
	mapping(uint256 => uint256) private forSaleIndex;

	constructor() ERC721("AnonFTMarketplace", "ANFT") {
		securityParam = 1;
		holder = new AnonFTHolder();
		verifier = new AnonFTVerifier();
	}

	/**
	 * Mints a new AnonFT, can only be called internally when a paid for commitment gets claimed
	 * @param identifier	identifier data to embed on new NFT
	 */
	function mint(IdentityData memory identifier) private {
		// Generic ERC721 mint
		_lastId.increment();
		uint256 newId = _lastId.current();
		_safeMint(address(holder), newId);

		updateOwnership(newId, identifier);

		emit Mint(newId);
	}

	/**
	 * Transfer an existing AnonFT, can only be called internally when a paid for commitment gets claimed
	 * NOTE: doesn't actually transfer an asset, only updates the public identifiers
	 * @param tokenId 		id of token to transfer
	 * @param identifier	new identifier data to embed on NFT	
	 */
	function transfer(uint256 tokenId, IdentityData memory identifier) private {
		updateOwnership(tokenId, identifier);
		paySeller(tokenId);
		removeForSale(tokenId);
	}

	/**
	 * Updates the ownership values attached to an NFT with new ones, called during a mint or transfer request
	 * @param tokenId 		id of token to update ownership for
	 * @param identifier	new identifier data to embed on NFT
	 */
	function updateOwnership(uint256 tokenId, IdentityData memory identifier) private {
		anonymousId[tokenId] = identifier;
	}

	/**
	 * Returns the ID of the last minted NFT
	 */
	function getLastID() public view returns (uint256) {
		return _lastId.current();
	}

	/**
	 * Returns the list of token IDs that have been marked as for sale
	 */
	function getTokensForSale() public view returns (uint256[] memory ids) {
		return forSale;
	}

	/**
	 * Returns sale data struct for the specified commitment
	 * @param commitment	commitment to check sale progress for
	 */
	function getSaleCommitmentFor(uint256 commitment) public view returns (SaleCommit memory) {
		return sellCommitments[commitment];
	}

	/*******************************************************************************************************************
	 * 									Functions to manage verifying proofs										   *
	 *******************************************************************************************************************/

	/**
	 * Initiates new on-chain proof of ownership for a sale request
	 * @param commitment	commitment ID for linking multiple transactions
	 * @param tokenId		ID of the token being proved
	 * @param toPay			Ethereum address of the seller
	 */
	function initiateSaleProof(uint256 commitment, uint256 tokenId, address toPay) external tokenExists(tokenId) {
		require(verifyStatus[commitment].tokenId == 0, "Proof has already been initialised");
		require(toPay != address(0), "Payout address must be owned");
		require(!isForSale(tokenId), "Token is already for sale");

		sellCommitments[commitment].toPay = toPay;
		sellCommitments[commitment].tokenId = tokenId;
		sellCommitments[commitment].amount = DEFAULT_PRICE;
		verifyStatus[commitment].tokenId = tokenId;
		verifyStatus[commitment].t = verifier.requiredVerifications(securityParam, anonymousId[tokenId].k);
	}


	/** 
	 * Returns the number of remaining proof rounds required for completed verification
	 * @param commitment	commitment ID to query
	 */
	function getNumVerifications(uint256 commitment) external view returns (uint256) {
		return verifyStatus[commitment].t;
	}

	/*******************************************************************************************************************
	 * 									Functions to manage for sale array										   	   *
	 *******************************************************************************************************************/

	/**
	 * Labels an existing ID as being for sale, can only be called internally after caller has verified their identity
	 * @param commitment	commitment ID for linking multiple transactions
	 */
	function onVerification(uint256 commitment) internal override {
		forSale.push(sellCommitments[commitment].tokenId);
		forSaleIndex[sellCommitments[commitment].tokenId] = forSale.length - 1;

		payments[sellCommitments[commitment].tokenId].amount = sellCommitments[commitment].amount;
		payments[sellCommitments[commitment].tokenId].toPay = sellCommitments[commitment].toPay;

		delete sellCommitments[commitment];
	}

	/** 
	 * Ensures safe access of forSale array without out of bounds indices
	 * @param tokenId	ID of the token being queried
	 */
	function isForSale(uint256 tokenId) private view returns (bool) {
		if (forSale.length > 0) {
			return forSale[forSaleIndex[tokenId]] == tokenId;
		}

		return false;
	}

	/**
	 * Deletes the element with value 'tokenId' from the forSale array
	 * Additionally cleans up stored sale data
	 * @param tokenId	ID of the token being removed from for sale list
	 */ 
	function removeForSale(uint256 tokenId) private {
		require (isForSale(tokenId), "Provided token is not for sale");

		// Overwrites the token being removed with the last element in the array
		uint256 swapId = forSale[forSale.length - 1];
		forSale[forSaleIndex[tokenId]] = swapId;
		forSale.pop();

		// Resets the swapped token's saved index
		forSaleIndex[swapId] = forSaleIndex[tokenId];
		delete forSaleIndex[tokenId];
	}
	
	/*******************************************************************************************************************
	 * 									Functions to manage ETH transactions										   *
	 *******************************************************************************************************************/

	/**
	 * Retrieves the commited values for a Tornado proof
	 * @param tokenId	commitment to query
	 */
	function paySeller(uint256 tokenId) private {
		payable(payments[tokenId].toPay).transfer(payments[tokenId].amount);
	}

	/**
	 * Function to receive funds
	 */
	receive() external payable {}

	/*******************************************************************************************************************
	 * 			The following functions are not production safe, the commitment should come from an oracle			   *
	 *******************************************************************************************************************/

	/**
	 * Confirms the commitment to mint a new token, only callable after payment from Tornado has been received
	 * @param commitment	commitment key to claim and mint new token for
	 */ 
	function claimMint(uint256 commitment) external commited(commitment) {
		mint(commitments[commitment]);

		delete commitments[commitment];
	}

	/**
	 * Confirms the commitment to transfer an existing token, only callable after payment from Tornado has been received
	 * @param tokenId		relevant tokenId to purchase
	 * @param commitment	commitment key to claim and transfer token for
	 */ 
	function claimTransfer(uint256 tokenId, uint256 commitment) external commited(commitment) {
		require (isForSale(tokenId), "Provided tokenID is not for sale");

		transfer(tokenId, commitments[commitment]);

		delete commitments[commitment];
	}
}
