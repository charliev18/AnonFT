// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IAnonFT is IERC721 {
    struct IdentityData {
		uint256 n;
		uint256 k;
		int256[] identifiers;
	}

    /**
     * @dev Returns the anonymous identifiers of the `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function identifiersFor(uint256 tokenId) external view returns (IdentityData memory identifiers);

    /**
     * @dev Commits `ownershipData` and `data` in mapping against `commitId`
     *
     * Requirements:
     *
     * - `commitId` must not exist already.
     */
    function commit(uint256 commitId, IdentityData memory ownershipData, bytes memory data) external;

    /**
     * @dev proves ownership for anonymous identifiers embeded in token related to `commitId`
     *
     * Requirements:
     *
     * - `commitId` must exist.
     */
    function proveOwnership(uint256 commitId, bytes memory data) external;

    /**
     * @dev claims commitment and executes transfer on token related to `commitId`. Deletes commitment
     *
     * Requirements:
     *
     * - `commitId` must exist.
     */
    function claimTransfer(uint256 commitId) external;
}
