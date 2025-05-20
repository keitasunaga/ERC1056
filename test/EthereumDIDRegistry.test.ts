import { ethers, network } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { EthereumDIDRegistry } from "../typechain-types";
import { ContractTransaction, Signature } from "ethers";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE_DAY = 24 * 60 * 60; // seconds in a day

// Action type constants (mirroring contract's constants)
const CHANGE_OWNER_ACTION = ethers.keccak256(ethers.toUtf8Bytes("changeOwner"));
const ADD_DELEGATE_ACTION = ethers.keccak256(ethers.toUtf8Bytes("addDelegate"));
const REVOKE_DELEGATE_ACTION = ethers.keccak256(ethers.toUtf8Bytes("revokeDelegate"));
const SET_ATTRIBUTE_ACTION = ethers.keccak256(ethers.toUtf8Bytes("setAttribute"));
const REVOKE_ATTRIBUTE_ACTION = ethers.keccak256(ethers.toUtf8Bytes("revokeAttribute"));


describe("EthereumDIDRegistry (ERC1056)", function () {
  let registry: EthereumDIDRegistry;
  let identity: SignerWithAddress;
  let newOwner: SignerWithAddress;
  let delegate: SignerWithAddress;
  let otherAccount: SignerWithAddress;
  let registryAddress: string;

  beforeEach(async function () {
    [identity, newOwner, delegate, otherAccount] = await ethers.getSigners();
    const RegistryFactory = await ethers.getContractFactory("EthereumDIDRegistry");
    registry = await RegistryFactory.deploy() as EthereumDIDRegistry;
    registryAddress = await registry.getAddress();
  });

  // Helper to build the full action hash that is signed
  // actionTypeHash: e.g. CHANGE_OWNER_ACTION
  // packedActionParams: keccak256(abi.encodePacked(param1, param2, ...))
  function buildFullActionHash(actionTypeHash: string, packedActionParams: string): string {
    return ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [actionTypeHash, packedActionParams]);
  }

  async function preparePayloadHash(
    identityAddress: string,
    actionFullHash: string,
    nonceOverride?: bigint
  ): Promise<string> {
    const nonce = nonceOverride !== undefined ? nonceOverride : await registry.changed(identityAddress);
    // This is keccak256(abi.encodePacked(address(this), nonce, actionFullHash))
    const payloadHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32"],
      [registryAddress, nonce, actionFullHash]
    );
    return payloadHash;
  }

  async function signData(signer: SignerWithAddress, payloadHashToSign: string): Promise<{ v: number, r: string, s: string }> {
    const flatSignature = await signer.signMessage(ethers.getBytes(payloadHashToSign));
    const sig = Signature.from(flatSignature);
    return { v: sig.v, r: sig.r, s: sig.s };
  }


  describe("オーナーシップ管理 (Ownership Management)", function () {
    it("デフォルトではID自体がオーナーであるべき", async function () {
      expect(await registry.identityOwner(identity.address)).to.equal(identity.address);
    });

    it("現在のオーナーはオーナーを変更できるべき", async function () {
      const previousChange = await registry.changed(identity.address);
      await expect(registry.connect(identity).changeOwner(identity.address, newOwner.address))
        .to.emit(registry, "DIDOwnerChanged")
        .withArgs(identity.address, newOwner.address, previousChange);
      expect(await registry.identityOwner(identity.address)).to.equal(newOwner.address);
      expect(await registry.changed(identity.address)).to.be.gt(previousChange);
    });

    it("オーナー以外はオーナーを変更できないべき", async function () {
      await expect(
        registry.connect(otherAccount).changeOwner(identity.address, newOwner.address)
      ).to.be.revertedWith("EthereumDIDRegistry: not current owner");
    });

    it("オーナーをゼロアドレスに変更できないべき", async function () {
      await expect(
        registry.connect(identity).changeOwner(identity.address, ZERO_ADDRESS)
      ).to.be.revertedWith("EthereumDIDRegistry: new owner cannot be zero address");
    });

    describe("changeOwnerSigned (署名によるオーナー変更)", function () {
      it("署名によってオーナーはオーナーを変更できるべき", async function () {
        const packedNewOwner = ethers.solidityPackedKeccak256(["address"], [newOwner.address]);
        const actionFullHash = buildFullActionHash(CHANGE_OWNER_ACTION, packedNewOwner);

        const currentChanged = await registry.changed(identity.address);
        const messageHash = await preparePayloadHash(identity.address, actionFullHash, currentChanged);
        const { v, r, s } = await signData(identity, messageHash);

        await expect(registry.connect(otherAccount).changeOwnerSigned(identity.address, v, r, s, newOwner.address))
          .to.emit(registry, "DIDOwnerChanged")
          .withArgs(identity.address, newOwner.address, currentChanged);
        expect(await registry.identityOwner(identity.address)).to.equal(newOwner.address);
      });

      it("不正な署名ではオーナーを変更できないべき", async function () {
        const packedNewOwner = ethers.solidityPackedKeccak256(["address"], [newOwner.address]);
        const actionFullHash = buildFullActionHash(CHANGE_OWNER_ACTION, packedNewOwner);
        const messageHash = await preparePayloadHash(identity.address, actionFullHash);
        const { v, r, s } = await signData(otherAccount, messageHash);

        await expect(
          registry.connect(otherAccount).changeOwnerSigned(identity.address, v, r, s, newOwner.address)
        ).to.be.revertedWith("EthereumDIDRegistry: signer is not the current owner");
      });
      it("署名によってオーナーをゼロアドレスに変更できないべき", async function () {
        const packedNewOwner = ethers.solidityPackedKeccak256(["address"], [ZERO_ADDRESS]);
        const actionFullHash = buildFullActionHash(CHANGE_OWNER_ACTION, packedNewOwner);
        const messageHash = await preparePayloadHash(identity.address, actionFullHash);
        const { v, r, s } = await signData(identity, messageHash);

        await expect(
          registry.connect(otherAccount).changeOwnerSigned(identity.address, v, r, s, ZERO_ADDRESS)
        ).to.be.revertedWith("EthereumDIDRegistry: new owner cannot be zero address for signed change");
      });
    });
  });

  describe("デリゲート管理 (Delegate Management)", function () {
    const delegateType = ethers.encodeBytes32String("testDelegate");
    const validity = ONE_DAY;

    it("デリゲートを追加できるべき", async function () {
      const previousChange = await registry.changed(identity.address);
      const tx = await registry.connect(identity).addDelegate(identity.address, delegateType, delegate.address, validity);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const expectedValidTo = block!.timestamp + validity;

      await expect(tx)
        .to.emit(registry, "DIDDelegateChanged")
        .withArgs(identity.address, delegateType, delegate.address, expectedValidTo, previousChange);

      expect(await registry.validDelegate(identity.address, delegateType, delegate.address)).to.be.true;
    });

    it("オーナー以外はデリゲートを追加できないべき", async function () {
      await expect(
        registry.connect(otherAccount).addDelegate(identity.address, delegateType, delegate.address, validity)
      ).to.be.revertedWith("EthereumDIDRegistry: not current owner");
    });

    it("デリゲートをゼロアドレスで追加できないべき", async function () {
      await expect(
        registry.connect(identity).addDelegate(identity.address, delegateType, ZERO_ADDRESS, validity)
      ).to.be.revertedWith("EthereumDIDRegistry: delegate cannot be zero address");
    });

    it("デリゲートを空のタイプで追加できないべき", async function () {
      await expect(
        registry.connect(identity).addDelegate(identity.address, ethers.ZeroHash, delegate.address, validity)
      ).to.be.revertedWith("EthereumDIDRegistry: delegateType cannot be empty");
    });

    it("デリゲートをゼロの有効期間で追加できないべき", async function () {
      await expect(
        registry.connect(identity).addDelegate(identity.address, delegateType, delegate.address, 0)
      ).to.be.revertedWith("EthereumDIDRegistry: validity must be greater than zero");
    });

    it("有効なデリゲートを正しく報告すべき", async function () {
      await registry.connect(identity).addDelegate(identity.address, delegateType, delegate.address, validity);
      expect(await registry.validDelegate(identity.address, delegateType, delegate.address)).to.be.true;
    });

    it("期限切れのデリゲートは無効と報告すべき", async function () {
      await registry.connect(identity).addDelegate(identity.address, delegateType, delegate.address, validity);
      await network.provider.send("evm_increaseTime", [validity + 1]);
      await network.provider.send("evm_mine");
      expect(await registry.validDelegate(identity.address, delegateType, delegate.address)).to.be.false;
    });

    it("追加されていないデリゲートは無効と報告すべき", async function () {
      expect(await registry.validDelegate(identity.address, delegateType, otherAccount.address)).to.be.false;
    });

    it("デリゲートを取り消せるべき", async function () {
      await registry.connect(identity).addDelegate(identity.address, delegateType, delegate.address, validity);
      const previousChange = await registry.changed(identity.address);

      await expect(registry.connect(identity).revokeDelegate(identity.address, delegateType, delegate.address))
        .to.emit(registry, "DIDDelegateChanged")
        .withArgs(identity.address, delegateType, delegate.address, 0, previousChange);
      expect(await registry.validDelegate(identity.address, delegateType, delegate.address)).to.be.false;
    });

    it("オーナー以外はデリゲートを取り消せないべき", async function () {
      await registry.connect(identity).addDelegate(identity.address, delegateType, delegate.address, validity);
      await expect(
        registry.connect(otherAccount).revokeDelegate(identity.address, delegateType, delegate.address)
      ).to.be.revertedWith("EthereumDIDRegistry: not current owner");
    });

    describe("addDelegateSigned (署名によるデリゲート追加)", function () {
      it("署名によってデリゲートを追加できるべき", async function () {
        const packedParams = ethers.solidityPackedKeccak256(["bytes32", "address", "uint256"], [delegateType, delegate.address, validity]);
        const actionFullHash = buildFullActionHash(ADD_DELEGATE_ACTION, packedParams);

        const currentChanged = await registry.changed(identity.address);
        const messageHash = await preparePayloadHash(identity.address, actionFullHash, currentChanged);
        const { v, r, s } = await signData(identity, messageHash);

        const tx = await registry.connect(otherAccount).addDelegateSigned(identity.address, v, r, s, delegateType, delegate.address, validity);
        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt!.blockNumber);
        const expectedValidTo = block!.timestamp + validity;

        await expect(tx)
          .to.emit(registry, "DIDDelegateChanged")
          .withArgs(identity.address, delegateType, delegate.address, expectedValidTo, currentChanged);

        expect(await registry.validDelegate(identity.address, delegateType, delegate.address)).to.be.true;
      });
    });

    describe("revokeDelegateSigned (署名によるデリゲート取り消し)", function () {
      it("署名によってデリゲートを取り消せるべき", async function () {
        await registry.connect(identity).addDelegate(identity.address, delegateType, delegate.address, validity);

        const packedParams = ethers.solidityPackedKeccak256(["bytes32", "address"], [delegateType, delegate.address]);
        const actionFullHash = buildFullActionHash(REVOKE_DELEGATE_ACTION, packedParams);

        const currentChanged = await registry.changed(identity.address);
        const messageHash = await preparePayloadHash(identity.address, actionFullHash, currentChanged);
        const { v, r, s } = await signData(identity, messageHash);

        await expect(registry.connect(otherAccount).revokeDelegateSigned(identity.address, v, r, s, delegateType, delegate.address))
          .to.emit(registry, "DIDDelegateChanged")
          .withArgs(identity.address, delegateType, delegate.address, 0, currentChanged);
        expect(await registry.validDelegate(identity.address, delegateType, delegate.address)).to.be.false;
      });
    });
  });

  describe("属性管理 (Attribute Management)", function () {
    const attrName = ethers.encodeBytes32String("testAttr");
    const attrValue = ethers.toUtf8Bytes("testValue");
    const validity = ONE_DAY;

    it("属性を設定できるべき", async function () {
      const previousChange = await registry.changed(identity.address);
      const tx = await registry.connect(identity).setAttribute(identity.address, attrName, attrValue, validity);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const expectedValidTo = block!.timestamp + validity;

      await expect(tx)
        .to.emit(registry, "DIDAttributeChanged")
        .withArgs(identity.address, attrName, ethers.hexlify(attrValue), expectedValidTo, previousChange);
    });

    it("オーナー以外は属性を設定できないべき", async function () {
      await expect(
        registry.connect(otherAccount).setAttribute(identity.address, attrName, attrValue, validity)
      ).to.be.revertedWith("EthereumDIDRegistry: not current owner");
    });

    it("属性を空の名前で設定できないべき", async function () {
      await expect(
        registry.connect(identity).setAttribute(identity.address, ethers.ZeroHash, attrValue, validity)
      ).to.be.revertedWith("EthereumDIDRegistry: attribute name cannot be empty");
    });

    it("属性をゼロの有効期間で設定できないべき", async function () {
      await expect(
        registry.connect(identity).setAttribute(identity.address, attrName, attrValue, 0)
      ).to.be.revertedWith("EthereumDIDRegistry: validity must be greater than zero");
    });

    it("属性を取り消せるべき", async function () {
      await registry.connect(identity).setAttribute(identity.address, attrName, attrValue, validity);
      const previousChange = await registry.changed(identity.address);

      await expect(registry.connect(identity).revokeAttribute(identity.address, attrName, attrValue))
        .to.emit(registry, "DIDAttributeChanged")
        .withArgs(identity.address, attrName, ethers.hexlify(attrValue), 0, previousChange);
    });

    it("オーナー以外は属性を取り消せないべき", async function () {
      await registry.connect(identity).setAttribute(identity.address, attrName, attrValue, validity);
      await expect(
        registry.connect(otherAccount).revokeAttribute(identity.address, attrName, attrValue)
      ).to.be.revertedWith("EthereumDIDRegistry: not current owner");
    });


    describe("setAttributeSigned (署名による属性設定)", function () {
      it("署名によって属性を設定できるべき", async function () {
        const packedParams = ethers.solidityPackedKeccak256(["bytes32", "bytes", "uint256"], [attrName, attrValue, validity]);
        const actionFullHash = buildFullActionHash(SET_ATTRIBUTE_ACTION, packedParams);

        const currentChanged = await registry.changed(identity.address);
        const messageHash = await preparePayloadHash(identity.address, actionFullHash, currentChanged);
        const { v, r, s } = await signData(identity, messageHash);

        const tx = await registry.connect(otherAccount).setAttributeSigned(identity.address, v, r, s, attrName, attrValue, validity);
        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt!.blockNumber);
        const expectedValidTo = block!.timestamp + validity;

        await expect(tx)
          .to.emit(registry, "DIDAttributeChanged")
          .withArgs(identity.address, attrName, ethers.hexlify(attrValue), expectedValidTo, currentChanged);
      });
    });

    describe("revokeAttributeSigned (署名による属性取り消し)", function () {
      it("署名によって属性を取り消せるべき", async function () {
        await registry.connect(identity).setAttribute(identity.address, attrName, attrValue, validity);

        const packedParams = ethers.solidityPackedKeccak256(["bytes32", "bytes"], [attrName, attrValue]);
        const actionFullHash = buildFullActionHash(REVOKE_ATTRIBUTE_ACTION, packedParams);

        const currentChanged = await registry.changed(identity.address);
        const messageHash = await preparePayloadHash(identity.address, actionFullHash, currentChanged);
        const { v, r, s } = await signData(identity, messageHash);

        await expect(registry.connect(otherAccount).revokeAttributeSigned(identity.address, v, r, s, attrName, attrValue))
          .to.emit(registry, "DIDAttributeChanged")
          .withArgs(identity.address, attrName, ethers.hexlify(attrValue), 0, currentChanged);
      });
    });
  });

  describe("Changed (ノンス) 更新テスト", function () {
    it("状態変更関数呼び出しの度に 'changed' が更新されるべき", async function () {
      const initialChanged = await registry.changed(identity.address);
      expect(initialChanged).to.equal(0);

      await registry.connect(identity).changeOwner(identity.address, newOwner.address);
      const changedAfterOwner = await registry.changed(identity.address);
      expect(changedAfterOwner).to.be.gt(initialChanged);

      const delegateType = ethers.encodeBytes32String("nonceTestDelegate");
      await registry.connect(newOwner).addDelegate(identity.address, delegateType, delegate.address, ONE_DAY);
      const changedAfterDelegate = await registry.changed(identity.address);
      expect(changedAfterDelegate).to.be.gt(changedAfterOwner);

      const attrName = ethers.encodeBytes32String("nonceTestAttr");
      const attrValueLocal = ethers.toUtf8Bytes("nonceTestValue");
      await registry.connect(newOwner).setAttribute(identity.address, attrName, attrValueLocal, ONE_DAY);
      const changedAfterAttribute = await registry.changed(identity.address);
      expect(changedAfterAttribute).to.be.gt(changedAfterDelegate);

      await registry.connect(newOwner).revokeDelegate(identity.address, delegateType, delegate.address);
      const changedAfterRevokeDelegate = await registry.changed(identity.address);
      expect(changedAfterRevokeDelegate).to.be.gt(changedAfterAttribute);

      await registry.connect(newOwner).revokeAttribute(identity.address, attrName, attrValueLocal);
      const changedAfterRevokeAttribute = await registry.changed(identity.address);
      expect(changedAfterRevokeAttribute).to.be.gt(changedAfterRevokeDelegate);
    });
  });
}); 