// SPDX-License-Identifier: MIT
// TESTNET ONLY — Do not deploy to mainnet without an audit.
//
// RewardVault: brands fund per-campaign treasuries; workers claim approved
// rewards by submitting an EIP-712 voucher signed by the backend operator.
//
// Flow:
//   1. Brand calls fundCampaign(campaignId) payable to lock GEN.
//   2. Backend approves a submission and signs a ClaimVoucher off-chain.
//   3. Worker calls claim(voucher, signature). Vault verifies signature +
//      nonce, decrements campaign balance, transfers GEN to msg.sender.
//
// Deploy with operator = address derived from OPERATOR_PRIVATE_KEY.
pragma solidity ^0.8.24;

contract RewardVault {
    string public constant NAME = "ProofFlowRewardVault";
    string public constant VERSION = "1";

    bytes32 private constant CLAIM_TYPEHASH = keccak256(
        "ClaimVoucher(bytes32 campaignId,bytes32 submissionId,address worker,uint256 amount,uint256 deadline,bytes32 nonce)"
    );
    bytes32 private immutable DOMAIN_SEPARATOR;

    address public operator;
    address public owner;
    mapping(bytes32 => uint256) public campaignBalance; // campaignId => GEN
    mapping(address => address) public campaignCreator; // (campaignId hash -> creator) — left for indexer
    mapping(bytes32 => bool) public usedNonces;

    event CampaignFunded(bytes32 indexed campaignId, address indexed funder, uint256 amount);
    event Claimed(bytes32 indexed campaignId, bytes32 indexed submissionId, address indexed worker, uint256 amount);
    event Withdrawn(bytes32 indexed campaignId, address indexed to, uint256 amount);

    constructor(address _operator) {
        owner = msg.sender;
        operator = _operator;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(NAME)),
            keccak256(bytes(VERSION)),
            block.chainid,
            address(this)
        ));
    }

    function fundCampaign(bytes32 campaignId) external payable {
        require(msg.value > 0, "no value");
        campaignBalance[campaignId] += msg.value;
        emit CampaignFunded(campaignId, msg.sender, msg.value);
    }

    function claim(
        bytes32 campaignId,
        bytes32 submissionId,
        address worker,
        uint256 amount,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "expired");
        require(!usedNonces[nonce], "used");
        require(msg.sender == worker, "not worker");
        require(campaignBalance[campaignId] >= amount, "underfunded");

        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH, campaignId, submissionId, worker, amount, deadline, nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = _recover(digest, signature);
        require(signer == operator, "bad sig");

        usedNonces[nonce] = true;
        campaignBalance[campaignId] -= amount;

        (bool ok, ) = worker.call{value: amount}("");
        require(ok, "transfer failed");
        emit Claimed(campaignId, submissionId, worker, amount);
    }

    function withdrawUnused(bytes32 campaignId, address payable to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        require(campaignBalance[campaignId] >= amount, "insufficient");
        campaignBalance[campaignId] -= amount;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdrawn(campaignId, to, amount);
    }

    function setOperator(address _operator) external {
        require(msg.sender == owner, "not owner");
        operator = _operator;
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        require(sig.length == 65, "bad sig len");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }
}
