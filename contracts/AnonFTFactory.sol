// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./AnonFTVerifier.sol";
import "./AnonFTHolder.sol";


contract AnonFTFactory is ERC721, Ownable {
	using Counters for Counters.Counter;
	
	event Mint(uint256 tokenId);
	event Challenge(uint256);

	struct IdentityData {
		uint256 n;
		uint256 k;
		int256[] identifiers;
	}

	struct VerifyStatus {
		uint256 tokenId;	// ID of the token to prove owernship of
		uint256 x;			// Prover committed x value for proof
		uint256 t;			// Number of remaining proof rounds to verify
		uint256 challenge;	// Stored challenge for verification
	}

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

	// Only for use in testnet to claim commitments
	Counters.Counter private _payments;

	// Security parameter stating probability of cheating is 2^(-securityParam)
	uint256 securityParam;

	// Mapping from tokenId to NFT identifying information
	mapping (uint256 => IdentityData) private anonymousId;

	// Mapping from purchase commitments to verification status for transfers
	mapping (uint256 => VerifyStatus) private verifyStatus;

	// Mapping from purchase commitments to identity data for verifying payments
	mapping (uint256 => IdentityData) private buyCommitments;

	// Mapping from purchase commitments to sale information
	mapping(uint256 => SaleCommit) private sellCommitments;

	// Mapping from tokenIDs to payment information
	mapping(uint256 => PaymentData) private payments;

	// List of all token IDs that have been marked for sale
	uint256[] private forSale;

	// Mapping from tokenIDs to index in forSale array for efficient deletes
	mapping(uint256 => uint256) private forSaleIndex;

	// AnonFT escrow contract
	AnonFTHolder private holder;

	// AnonFT proof verifier contract
	AnonFTVerifier private verifier;

	constructor() ERC721("AnonFTFactory", "ANFT") {
		securityParam = 72;
		holder = new AnonFTHolder();
		verifier = new AnonFTVerifier();
	}

	/*
	 * Used for external functions receiving public identifiers, ensure input is correctly formatted
	 */
	modifier verifyIdentifiers(uint256 n, uint256 k, int256[] memory identifiers) {
		require(n != 0, "N identifier cannot be equal to 0");
		require(k != 0, "K identifier cannot be equal to 0");
		require(identifiers.length == k, "There must be exactly k identifiers");
		_;
	}

	/*
	 * Used for external functions performing verifications on token identifiers
	 */
	modifier tokenExists(uint256 tokenId) {
		require(anonymousId[tokenId].n != 0, "Specified token does not exist");
		_;
	}

	/*
	 * Ensures commitment has been registered and payment has been received
	 */
	modifier paidAndCommited(uint256 commitment) {
		require(_payments.current() != 0, "No payment has been received");
		require(buyCommitments[commitment].n != 0, "Commitment has not been registered");
		_;
	}

	function mintDummy(uint256 n, uint256 k, int256[] memory identifiers) public {
		mint(IdentityData(n, k, identifiers));
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
		_payments.increment();
	}

	/*
	 * Mints a new AnonFT, can only be called internally when a paid for commitment gets claimed
	 */
	function mint(IdentityData memory identifier) private {
		// Generic ERC721 mint
		_lastId.increment();
		uint256 newId = _lastId.current();
		_safeMint(address(holder), newId);

		updateOwnership(newId, identifier);

		emit Mint(newId);
	}

	/*
	 * Transfer an existing AnonFT, can only be called internally when a paid for commitment gets claimed
	 * NOTE: doesn't actually transfer an asset, only updates the public identifiers
	 */
	function transfer(uint256 tokenId, IdentityData memory identifier) private {
		updateOwnership(tokenId, identifier);
		paySeller(tokenId);
		removeForSale(tokenId);
	}

	/*
	 * Updates the ownership values attached to an NFT with new ones, called during a mint or transfer request
	 */
	function updateOwnership(uint256 tokenId, IdentityData memory identifier) private {
		anonymousId[tokenId] = identifier;
	}

	/*
	 * Returns the ID of the last minted NFT
	 */
	function getLastID() public view returns (uint256) {
		return _lastId.current();
	}

	/*
	 * Returns the public identifiers for the input token ID
	 */
	function getOwnershipDataFor(uint256 tokenId) public view returns (IdentityData memory) {
		return anonymousId[tokenId];
	}

	/*
	 * Returns the list of token IDs that have been marked as for sale
	 */
	function getTokensForSale() public view returns (uint256[] memory ids) {
		return forSale;
	}

	function getSaleCommitmentFor(uint256 commitment) public view returns (SaleCommit memory) {
		return sellCommitments[commitment];
	}

	/*******************************************************************************************************************
	 * 									Functions to manage verifying proofs										   *
	 *******************************************************************************************************************/

	function initiateSaleProof(uint256 commitment, uint256 tokenId, address toPay) external tokenExists(tokenId) {
		require(verifyStatus[commitment].tokenId == 0, "Proof has already been initialised");
		// require(toPay != address(0), "Payout address must be owned");
		require(!isForSale(tokenId), "Token is already for sale");

		sellCommitments[commitment].toPay = toPay;
		sellCommitments[commitment].tokenId = tokenId;
		sellCommitments[commitment].amount = DEFAULT_PRICE;
		verifyStatus[commitment].tokenId = tokenId;
		verifyStatus[commitment].t = verifier.requiredVerifications(securityParam, anonymousId[tokenId].k);
	}

	/*
	 * Initiates a new verification round
	 * @param tokenId	ID of the token that the prover is proving ownership of
	 * @param x			Prover generated commitment
	 */
	function receiveChallenge(uint256 commitment, uint256 x) external {
		require(verifyStatus[commitment].tokenId != 0, "Proof has not yet been initialised");

		verifyStatus[commitment].x = x;
		verifyStatus[commitment].challenge = verifier.generateRandomBools();

		emit Challenge(verifyStatus[commitment].challenge);
	}

	/*
	 * Completes the second round of a verification
	 * @param tokenId	ID of the token that the prover is proving ownership of
	 * @param y			Prover computed response
	 */
	function submitVerification(uint256 commitment, uint256 y) external {
		require(verifyStatus[commitment].tokenId != 0, "Proof has not yet been initialised");

		bool response = verifier.verify(verifyStatus[commitment].x, 
										y, 
										anonymousId[verifyStatus[commitment].tokenId].n, 
										anonymousId[verifyStatus[commitment].tokenId].k, 
										anonymousId[verifyStatus[commitment].tokenId].identifiers, 
										verifyStatus[commitment].challenge
		);

		if (response) {
			// TODO: pay the relayer on successful proof
			verifyStatus[commitment].t--;
			
			// User has been verified if t reaches 0, put NFT up for sale
			if (verifyStatus[commitment].t == 0) {
				listForSale(commitment);
				delete verifyStatus[commitment];
			}
		} else {
			// Resets proof if any verification fails
			delete verifyStatus[commitment];
		}
	}

	/*
	 * TODO: DELETE THIS FUNCTION
	 */
	function submitVerificationDummy(uint256 commitment, uint256 y, uint256 challenge) external {
		require(verifyStatus[commitment].tokenId != 0, "Proof has not yet been initialised");

		bool response = verifier.verify(verifyStatus[commitment].x, 
										y, 
										anonymousId[verifyStatus[commitment].tokenId].n, 
										anonymousId[verifyStatus[commitment].tokenId].k, 
										anonymousId[verifyStatus[commitment].tokenId].identifiers, 
										challenge
		);

		if (response) {
			// TODO: pay the relayer on successful proof
			verifyStatus[commitment].t--;
			
			// User has been verified if t reaches 0, put NFT up for sale
			if (verifyStatus[commitment].t == 0) {
				listForSale(commitment);
				delete verifyStatus[commitment];
			}
		} else {
			// Resets proof if any verification fails
			delete verifyStatus[commitment];
		}
	}

	function getNumVerifications(uint256 commitment) external view returns (uint256) {
		return verifyStatus[commitment].t;
	}

	/*******************************************************************************************************************
	 * 									Functions to manage for sale array										   	   *
	 *******************************************************************************************************************/

	/*
	 * Labels an existing ID as being for sale, can only be called internally after caller has verified their identity
	 */
	function listForSale(uint256 commitment) private {
		forSale.push(sellCommitments[commitment].tokenId);
		forSaleIndex[sellCommitments[commitment].tokenId] = forSale.length - 1;

		payments[sellCommitments[commitment].tokenId].amount = sellCommitments[commitment].amount;
		payments[sellCommitments[commitment].tokenId].toPay = sellCommitments[commitment].toPay;

		delete sellCommitments[commitment];
	}

	/* 
	 * Ensures safe access of forSale array without out of bounds indices
	 */
	function isForSale(uint256 tokenId) private view returns (bool) {
		if (forSale.length > 0) {
			return forSale[forSaleIndex[tokenId]] == tokenId;
		}

		return false;
	}

	/*
	 * Deletes the element with value 'tokenId' from the forSale array
	 * Additionally cleans up stored sale data
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

	/*
	 * Registers commitment for a Tornado snark proof for verification of receipt later on
	 */
	function commitID(uint256 commitment, uint256 n, uint256 k, int256[] calldata identifiers) external verifyIdentifiers(n, k, identifiers) {
		buyCommitments[commitment] = IdentityData(n, k, identifiers);
	}

	/*
	 * Retrieves the commited values for a Tornado proof
	 */
	function checkCommitment(uint256 commitment) external view returns (IdentityData memory) {
		return buyCommitments[commitment];
	}

	function paySeller(uint256 tokenId) private {
		payable(payments[tokenId].toPay).transfer(payments[tokenId].amount);
	}

	/*
	 * Function to receive funds
	 */
	receive() external payable {
		_payments.increment();
	}

	/*******************************************************************************************************************
	 * 			The following functions are not production safe, the commitment should come from an oracle			   *
	 *******************************************************************************************************************/

	/*
	 * Confirms the commitment to mint a new token, only callable after payment from Tornado has been received
	 */ 
	function confirmAndMint(uint256 commitment) external paidAndCommited(commitment) {
		_payments.decrement();
		mint(buyCommitments[commitment]);

		delete buyCommitments[commitment];
	}

	/*
	 * Confirms the commitment to transfer an existing token, only callable after payment from Tornado has been received
	 */ 
	function confirmAndTransfer(uint256 tokenId, uint256 commitment) external paidAndCommited(commitment) {
		require (isForSale(tokenId), "Provided tokenID is not for sale");

		_payments.decrement();
		transfer(tokenId, buyCommitments[commitment]);

		delete buyCommitments[commitment];
	}
}
