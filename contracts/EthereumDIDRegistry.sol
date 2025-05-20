// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.28;

/**
 * @title EthereumDIDRegistry
 * @dev ERC-1056 (Ethereum Lightweight Identity) の仕様に基づく、軽量なブロックチェーンIDのキーおよび属性管理のためのレジストリです。
 */
contract EthereumDIDRegistry {
    // 署名付きメッセージのためのアクションタイプ定数
    bytes32 internal constant CHANGE_OWNER_ACTION =
        keccak256(abi.encodePacked("changeOwner"));
    bytes32 internal constant ADD_DELEGATE_ACTION =
        keccak256(abi.encodePacked("addDelegate"));
    bytes32 internal constant REVOKE_DELEGATE_ACTION =
        keccak256(abi.encodePacked("revokeDelegate"));
    bytes32 internal constant SET_ATTRIBUTE_ACTION =
        keccak256(abi.encodePacked("setAttribute"));
    bytes32 internal constant REVOKE_ATTRIBUTE_ACTION =
        keccak256(abi.encodePacked("revokeAttribute"));

    // IDアドレスからそのオーナーへのマッピング。0の場合、ID自体がオーナーとなります。
    mapping(address => address) internal owners;

    // IDアドレス => デリゲートタイプ => デリゲートアドレス => 有効期限のマッピング
    mapping(address => mapping(bytes32 => mapping(address => uint)))
        internal delegates;

    // IDアドレス => 属性名 => 属性値 => 有効期限のマッピング
    // 注意: 属性値をマッピングキーに含めることで、同じ属性名に対して複数の値を許容します。
    // しかし、ERC-1056は通常、属性名ごとに1つの値を期待します。
    // 標準の `setAttribute` は同じ名前の以前の属性を(事実上)取り消します。
    // EIPに準拠するため、値は取り消しキーの一部です。
    mapping(address => mapping(bytes32 => mapping(bytes => uint)))
        internal attributes;

    // IDアドレスから最後の変更があったブロック番号へのマッピング。
    mapping(address => uint) public changed;

    // イベント
    event DIDOwnerChanged(
        address indexed identity,
        address owner,
        uint previousChange
    );

    event DIDDelegateChanged(
        address indexed identity,
        bytes32 delegateType,
        address delegate,
        uint validTo,
        uint previousChange
    );

    event DIDAttributeChanged(
        address indexed identity,
        bytes32 name,
        bytes value, // EIPは "bytes value" を指定しており、イベントの一部であることを示唆しています。
        uint validTo,
        uint previousChange
    );

    // IDの現在のオーナーを取得するためのヘルパー関数
    function _getCurrentOwner(
        address identity
    ) internal view returns (address) {
        address owner = owners[identity];
        if (owner == address(0)) {
            return identity; // デフォルトではID自体
        }
        return owner;
    }

    // 署名検証のためのヘルパー関数 (メッセージデータ準備)
    // @dev 署名のためのデータを準備します。EIP-191準拠。
    // @param identity IDのアドレス。
    // @param actionHash 実行されるアクションのハッシュ（アクションタイプとアクション固有データのハッシュ）。
    // @return 署名対象のメッセージハッシュ。
    function _prepareMessageData(
        address identity,
        bytes32 actionHash
    ) internal view returns (bytes32) {
        // リプレイ攻撃防止のためのノンス。IDの最後の変更ブロック番号を使用します。
        uint nonce = changed[identity];
        // ペイロードハッシュを構築: コントラクトアドレス + ノンス + アクションハッシュ
        bytes32 payloadHash = keccak256(
            abi.encodePacked(address(this), nonce, actionHash)
        );
        // EIP-191プレフィックス付きメッセージハッシュを構築
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    payloadHash
                )
            );
    }

    // 署名検証のためのヘルパー関数
    // @dev 署名を検証します。
    // @param identity IDのアドレス。
    // @param messageHash _prepareMessageDataから得られた署名対象のメッセージハッシュ。
    // @param v EIP-712署名のVコンポーネント。
    // @param r EIP-712署名のRコンポーネント。
    // @param s EIP-712署名のSコンポーネント。
    function _verifySignature(
        address identity,
        bytes32 messageHash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        address signer = ecrecover(messageHash, v, r, s);
        require(
            signer != address(0),
            "EthereumDIDRegistry: invalid signature (ecrecover failed)"
        );
        require(
            signer == _getCurrentOwner(identity),
            "EthereumDIDRegistry: signer is not the current owner"
        );
    }

    // --- IDオーナーシップ ---
    /**
     * @dev 指定されたIDのオーナーを返します。
     *      オーナーが設定されていない場合は、ID自体をデフォルトとします。
     * @param identity IDのアドレス。
     * @return オーナーのアドレス。
     */
    function identityOwner(address identity) public view returns (address) {
        return _getCurrentOwner(identity);
    }

    /**
     * @dev 指定されたIDのオーナーを新しいアドレスに設定します。
     *      IDの現在のオーナーのみが呼び出し可能です。
     * @param identity IDのアドレス。
     * @param newOwner 新しいオーナーのアドレス。
     */
    function changeOwner(address identity, address newOwner) public {
        address currentOwner = _getCurrentOwner(identity);
        require(
            msg.sender == currentOwner,
            "EthereumDIDRegistry: not current owner"
        );
        require(
            newOwner != address(0),
            "EthereumDIDRegistry: new owner cannot be zero address"
        );

        uint previousChange = changed[identity];
        owners[identity] = newOwner;
        changed[identity] = block.number;
        emit DIDOwnerChanged(identity, newOwner, previousChange);
    }

    /**
     * @dev 署名によって承認された上で、指定されたIDのオーナーを新しいアドレスに設定します。
     * @param identity IDのアドレス。
     * @param sigV EIP-712署名のVコンポーネント。
     * @param sigR EIP-712署名のRコンポーネント。
     * @param sigS EIP-712署名のSコンポーネント。
     * @param newOwner 新しいオーナーのアドレス。
     */
    function changeOwnerSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        address newOwner
    ) public {
        require(
            newOwner != address(0),
            "EthereumDIDRegistry: new owner cannot be zero address for signed change"
        );

        bytes32 actionDataHash = keccak256(abi.encodePacked(newOwner));
        bytes32 actionHash = keccak256(
            abi.encodePacked(CHANGE_OWNER_ACTION, actionDataHash)
        );

        bytes32 messageHash = _prepareMessageData(identity, actionHash);
        _verifySignature(identity, messageHash, sigV, sigR, sigS);

        uint previousChange = changed[identity];
        owners[identity] = newOwner;
        changed[identity] = block.number;
        emit DIDOwnerChanged(identity, newOwner, previousChange);
    }

    // --- デリゲート管理 ---
    /**
     * @dev 指定されたデリゲートが、特定のIDとデリゲートタイプにおいて有効かどうかを確認します。
     * @param identity IDのアドレス。
     * @param delegateType デリゲートのタイプ (例: "did-jwt", "raiden")。
     * @param delegate デリゲートのアドレス。
     * @return デリゲートが有効な場合はtrue、そうでない場合はfalse。
     */
    function validDelegate(
        address identity,
        bytes32 delegateType,
        address delegate
    ) public view returns (bool) {
        return delegates[identity][delegateType][delegate] > block.timestamp;
    }

    /**
     * @dev IDに対して、特定のタイプと有効期間を持つデリゲートを追加します。
     *      IDの現在のオーナーのみが呼び出し可能です。
     * @param identity IDのアドレス。
     * @param delegateType デリゲートのタイプ。
     * @param delegate デリゲートのアドレス。
     * @param validity デリゲートが有効である秒数。
     */
    function addDelegate(
        address identity,
        bytes32 delegateType,
        address delegate,
        uint validity
    ) public {
        require(
            msg.sender == _getCurrentOwner(identity),
            "EthereumDIDRegistry: not current owner"
        );
        require(
            delegate != address(0),
            "EthereumDIDRegistry: delegate cannot be zero address"
        );
        require(
            delegateType != bytes32(0),
            "EthereumDIDRegistry: delegateType cannot be empty"
        );
        require(
            validity > 0,
            "EthereumDIDRegistry: validity must be greater than zero"
        );

        uint validTo = block.timestamp + validity;
        uint previousChange = changed[identity];

        delegates[identity][delegateType][delegate] = validTo;
        changed[identity] = block.number;
        emit DIDDelegateChanged(
            identity,
            delegateType,
            delegate,
            validTo,
            previousChange
        );
    }

    /**
     * @dev 署名によって承認された上で、デリゲートを追加します。
     * @param identity IDのアドレス。
     * @param sigV EIP-712署名のVコンポーネント。
     * @param sigR EIP-712署名のRコンポーネント。
     * @param sigS EIP-712署名のSコンポーネント。
     * @param delegateType デリゲートのタイプ。
     * @param delegate デリゲートのアドレス。
     * @param validity デリゲートが有効である秒数。
     */
    function addDelegateSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        bytes32 delegateType,
        address delegate,
        uint validity
    ) public {
        require(
            delegate != address(0),
            "EthereumDIDRegistry: delegate cannot be zero address for signed add"
        );
        require(
            delegateType != bytes32(0),
            "EthereumDIDRegistry: delegateType cannot be empty for signed add"
        );
        require(
            validity > 0,
            "EthereumDIDRegistry: validity must be greater than zero for signed add"
        );

        bytes32 actionDataHash = keccak256(
            abi.encodePacked(delegateType, delegate, validity)
        );
        bytes32 actionHash = keccak256(
            abi.encodePacked(ADD_DELEGATE_ACTION, actionDataHash)
        );

        bytes32 messageHash = _prepareMessageData(identity, actionHash);
        _verifySignature(identity, messageHash, sigV, sigR, sigS);

        uint validTo = block.timestamp + validity;
        uint previousChange = changed[identity];

        delegates[identity][delegateType][delegate] = validTo;
        changed[identity] = block.number;
        emit DIDDelegateChanged(
            identity,
            delegateType,
            delegate,
            validTo,
            previousChange
        );
    }

    /**
     * @dev IDのデリゲートを取り消します。
     *      IDの現在のオーナーのみが呼び出し可能です。
     * @param identity IDのアドレス。
     * @param delegateType デリゲートのタイプ。
     * @param delegate 取り消すデリゲートのアドレス。
     */
    function revokeDelegate(
        address identity,
        bytes32 delegateType,
        address delegate
    ) public {
        require(
            msg.sender == _getCurrentOwner(identity),
            "EthereumDIDRegistry: not current owner"
        );

        uint previousChange = changed[identity];
        delegates[identity][delegateType][delegate] = 0;
        changed[identity] = block.number;
        emit DIDDelegateChanged(
            identity,
            delegateType,
            delegate,
            0,
            previousChange
        );
    }

    /**
     * @dev 署名によって承認された上で、デリゲートを取り消します。
     * @param identity IDのアドレス。
     * @param sigV EIP-712署名のVコンポーネント。
     * @param sigR EIP-712署名のRコンポーネント。
     * @param sigS EIP-712署名のSコンポーネント。
     * @param delegateType デリゲートのタイプ。
     * @param delegate 取り消すデリゲートのアドレス。
     */
    function revokeDelegateSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        bytes32 delegateType,
        address delegate
    ) public {
        require(
            delegate != address(0),
            "EthereumDIDRegistry: delegate cannot be zero address for signed revoke"
        );
        require(
            delegateType != bytes32(0),
            "EthereumDIDRegistry: delegateType cannot be empty for signed revoke"
        );

        bytes32 actionDataHash = keccak256(
            abi.encodePacked(delegateType, delegate)
        );
        bytes32 actionHash = keccak256(
            abi.encodePacked(REVOKE_DELEGATE_ACTION, actionDataHash)
        );

        bytes32 messageHash = _prepareMessageData(identity, actionHash);
        _verifySignature(identity, messageHash, sigV, sigR, sigS);

        uint previousChange = changed[identity];
        delegates[identity][delegateType][delegate] = 0;
        changed[identity] = block.number;
        emit DIDDelegateChanged(
            identity,
            delegateType,
            delegate,
            0,
            previousChange
        );
    }

    // --- 属性管理 ---
    /**
     * @dev IDに対して、名前、値、有効期間を持つ属性を設定します。
     *      同じ名前を持つ既存の属性は上書きされます（実際には新しい有効期限で新しいエントリが作成されるか、既存のものが更新されます）。
     *      IDの現在のオーナーのみが呼び出し可能です。
     * @param identity IDのアドレス。
     * @param name 属性の名前 (bytes32)。
     * @param value 属性の値 (bytes)。
     * @param validity 属性が有効である秒数。
     */
    function setAttribute(
        address identity,
        bytes32 name,
        bytes calldata value, // bytesにはcalldataを使用
        uint validity
    ) public {
        require(
            msg.sender == _getCurrentOwner(identity),
            "EthereumDIDRegistry: not current owner"
        );
        require(
            name != bytes32(0),
            "EthereumDIDRegistry: attribute name cannot be empty"
        );
        require(
            validity > 0,
            "EthereumDIDRegistry: validity must be greater than zero"
        );

        uint validTo = block.timestamp + validity;
        uint previousChange = changed[identity];

        attributes[identity][name][value] = validTo;
        changed[identity] = block.number;
        emit DIDAttributeChanged(
            identity,
            name,
            value,
            validTo,
            previousChange
        );
    }

    /**
     * @dev 署名によって承認された上で、属性を設定します。
     * @param identity IDのアドレス。
     * @param sigV EIP-712署名のVコンポーネント。
     * @param sigR EIP-712署名のRコンポーネント。
     * @param sigS EIP-712署名のSコンポーネント。
     * @param name 属性の名前。
     * @param value 属性の値。
     * @param validity 属性が有効である秒数。
     */
    function setAttributeSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        bytes32 name,
        bytes calldata value, // bytesにはcalldataを使用
        uint validity
    ) public {
        require(
            name != bytes32(0),
            "EthereumDIDRegistry: attribute name cannot be empty for signed set"
        );
        require(
            validity > 0,
            "EthereumDIDRegistry: validity must be greater than zero for signed set"
        );

        bytes32 actionDataHash = keccak256(
            abi.encodePacked(name, value, validity)
        );
        bytes32 actionHash = keccak256(
            abi.encodePacked(SET_ATTRIBUTE_ACTION, actionDataHash)
        );

        bytes32 messageHash = _prepareMessageData(identity, actionHash);
        _verifySignature(identity, messageHash, sigV, sigR, sigS);

        uint validTo = block.timestamp + validity;
        uint previousChange = changed[identity];

        attributes[identity][name][value] = validTo;
        changed[identity] = block.number;
        emit DIDAttributeChanged(
            identity,
            name,
            value,
            validTo,
            previousChange
        );
    }

    /**
     * @dev IDの属性を取り消します。
     *      IDの現在のオーナーのみが呼び出し可能です。
     * @param identity IDのアドレス。
     * @param name 取り消す属性の名前。
     * @param value 取り消す属性の特定の値 (EIP-1056による)。
     */
    function revokeAttribute(
        address identity,
        bytes32 name,
        bytes calldata value // bytesにはcalldataを使用
    ) public {
        require(
            msg.sender == _getCurrentOwner(identity),
            "EthereumDIDRegistry: not current owner"
        );
        require(
            name != bytes32(0),
            "EthereumDIDRegistry: attribute name cannot be empty for revoke"
        );

        uint previousChange = changed[identity];
        attributes[identity][name][value] = 0;
        changed[identity] = block.number;
        emit DIDAttributeChanged(identity, name, value, 0, previousChange);
    }

    /**
     * @dev 署名によって承認された上で、属性を取り消します。
     * @param identity IDのアドレス。
     * @param sigV EIP-712署名のVコンポーネント。
     * @param sigR EIP-712署名のRコンポーネント。
     * @param sigS EIP-712署名のSコンポーネント。
     * @param name 取り消す属性の名前。
     * @param value 取り消す属性の特定の値。
     */
    function revokeAttributeSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        bytes32 name,
        bytes calldata value // bytesにはcalldataを使用
    ) public {
        require(
            name != bytes32(0),
            "EthereumDIDRegistry: attribute name cannot be empty for signed revoke"
        );

        bytes32 actionDataHash = keccak256(abi.encodePacked(name, value));
        bytes32 actionHash = keccak256(
            abi.encodePacked(REVOKE_ATTRIBUTE_ACTION, actionDataHash)
        );

        bytes32 messageHash = _prepareMessageData(identity, actionHash);
        _verifySignature(identity, messageHash, sigV, sigR, sigS);

        uint previousChange = changed[identity];
        attributes[identity][name][value] = 0;
        changed[identity] = block.number;
        emit DIDAttributeChanged(identity, name, value, 0, previousChange);
    }
}
