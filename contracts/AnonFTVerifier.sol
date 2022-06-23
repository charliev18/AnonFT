// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SignedMath.sol";

contract AnonFTVerifier {
    using SignedMath for int256;
    using SafeMath for uint256;

    event Log(uint256);
    event IntLog(int256);

    /** 
     * Returns the number of verifications required to reach a given security level for a given k
     * @param securityParam  Desired level of security (t*k)
     * @param k              Public identifier k
     */
    function requiredVerifications(uint256 securityParam, uint256 k) external pure returns(uint256) {
        return SafeMath.div(securityParam + k - 1, k);
    }

    /** 
     * Returns a pseudo-random 256-bit string
     */
    function generateRandomBools() external view returns (uint256) {
        // !!!! Important !!!!
        // Not suitable for production. Must use oracle for randomness instead
        return block.timestamp;
    }

    /** 
     * Returns val % modulo for signed integers
     */
    function signedMod(int256 val, uint256 modulo) public pure returns (uint256) {
        if (val == int(modulo)) {
            return 0;
        } else {
            return modulo - (SignedMath.abs(val) % modulo);
        }
    }

    /** 
     * Verifies the input satisfies the previously generated challenge
     * @param x             value commited by prover before receiving challenge
     * @param y             value calculated by prover off-chain
     * @param n             public identifier for token
     * @param k             public identifier for token
     * @param identifiers   public identifier for token
     * @param challenge     challenge generated in generateRandomBools()
     */ 
    function verify(uint256 x, uint256 y, uint256 n, uint256 k, int256[] calldata identifiers, uint256 challenge) external pure returns (bool) {
        // base = (y * y) % n
        uint256 base = SafeMath.mod(SafeMath.mul(y, y), n);
        
        // 0x1000000....
        uint256 comparator = uint(1);

        for (uint256 i = 0; i < k; i++) {
            // If the first bit of challenge is 1
            if (challenge & comparator == comparator) {
                // base = base * identifiers[i] % n
                if (identifiers[i] < 0) {
                    base = signedMod(int(base) * identifiers[i], n);
                } else {
                    base = SafeMath.mod(base * uint(identifiers[i]), n);
                }
            }

            // Shift challenge to next bit
            challenge = challenge >> 1;
        }

        return base == x || signedMod(int(base) * -1, n) == x;
    }
}

