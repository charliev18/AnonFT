// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IAnonFT.sol";
import "./AnonFTHolder.sol";
import "./AnonFTVerifier.sol";


abstract contract FiatShamirAnonFT is IAnonFT {

    event Challenge(uint256);

    struct VerifyStatus {
		uint256 tokenId;	// ID of the token to prove owernship of
		uint256 x;			// Prover committed x value for proof
		uint256 t;			// Number of remaining proof rounds to verify
		uint256 challenge;	// Stored challenge for verification
	}

    // Security parameter stating probability of cheating is 2^(-securityParam)
	uint256 securityParam;

    // Mapping from tokenId to NFT identifying information
	mapping (uint256 => IdentityData) internal anonymousId;

    // Mapping from purchase commitments to identity data for verifying payments
	mapping (uint256 => IdentityData) internal commitments;

    // Mapping from purchase commitments to verification status for transfers
	mapping (uint256 => VerifyStatus) internal verifyStatus;

    // AnonFT escrow contract
	AnonFTHolder internal holder;

	// AnonFT proof verifier contract
	AnonFTVerifier internal verifier;

    /**
	 * Used for external functions receiving public identifiers, ensure input is correctly formatted
	 * @param vals      anonymous identifiers to be embedded on the anonymous NFT
	 */
	modifier verifyIdentifiers(IdentityData memory vals) {
		require(vals.n != 0, "N identifier cannot be equal to 0");
		require(vals.k != 0, "K identifier cannot be equal to 0");
		require(vals.identifiers.length == vals.k, "There must be exactly k identifiers");
		_;
	}

    /**
	 * Ensures commitment has been registered and payment has been received
	 * @param commitment 	commitment to check
	 */
	modifier commited(uint256 commitment) {
		require(commitments[commitment].n != 0, "Commitment has not been registered");
		_;
	}

    /**
	 * Used for external functions performing verifications on token identifiers
	 * @param tokenId 	ID of token to check
	 */
	modifier tokenExists(uint256 tokenId) {
		require(anonymousId[tokenId].n != 0, "Specified token does not exist");
		_;
	}

    /**
	 * Returns the public identifiers for the input token ID
	 * @param tokenId	ID of token to query
	 */
	function identifiersFor(uint256 tokenId) public view virtual returns (IdentityData memory) {
		return anonymousId[tokenId];
	}

    /**
	 * Registers commitment for a Tornado snark proof for verification of receipt later on
	 * @param commitment	    commitment ID for linking multiple transactions
	 * @param ownershipData     Fiat Shamir anonymous identifiers
     * @param data              optional additional calldata
	 */
	function commit(uint256 commitment, IdentityData memory ownershipData, bytes memory data) external virtual verifyIdentifiers(ownershipData) {
		commitments[commitment] = ownershipData;
    }

    function proveOwnership(uint256 commitId, bytes memory data) external virtual {}

    /**
	 * Confirms the commitment to transfer an existing token, only callable after payment from Tornado has been received
	 * @param commitId	commitment key to claim and transfer token for
	 */ 
    function claimTransfer(uint256 commitId) external virtual {}

    /*
     * Allows implementing contract to override behaviour upon a successful verification
     */
    function onVerification(uint256 commitment) internal virtual {}

    /**
	 * Retrieves the commited values for a given commitment
	 * @param commitment	commitment to query
	 */
	function checkCommitment(uint256 commitment) external view returns (IdentityData memory) {
		return commitments[commitment];
	}

    /**
	 * Commits prover commitment and on-chain challenge, emits challenge for user to query
	 * @param commitment	commitment ID for linking multiple transactions
	 * @param x				Prover generated commitment
	 */
	function receiveChallenge(uint256 commitment, uint256 x) external {
		require(verifyStatus[commitment].tokenId != 0, "Proof has not yet been initialised");

		verifyStatus[commitment].x = x;
		verifyStatus[commitment].challenge = verifier.generateRandomBools();

		emit Challenge(verifyStatus[commitment].challenge);
	}

	/**
	 * Completes the second round of a verification
	 * @param commitment	commitment ID for linking multiple transactions
	 * @param y				Prover computed response
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
			verifyStatus[commitment].t--;
			
			// User has been verified if t reaches 0
			if (verifyStatus[commitment].t == 0) {
				onVerification(commitment);
				delete verifyStatus[commitment];
			}
		} else {
			// Resets proof if any verification fails
			delete verifyStatus[commitment];
		}
	}
}

