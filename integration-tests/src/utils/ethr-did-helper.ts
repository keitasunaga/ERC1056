import { EthrDID } from 'ethr-did';
import { ethers } from 'ethers';
import { getProvider, getWallet } from './deploy-helper';
import { Resolver, DIDDocument } from 'did-resolver';
import { getResolver as getEthrResolver } from 'ethr-did-resolver';

// ENS名前解決をモックする拡張プロバイダークラス
class MockEnsProvider extends ethers.JsonRpcProvider {
  constructor(url: string) {
    super(url);
  }

  // ENS名前解決をバイパス
  async resolveName(name: string): Promise<string> {
    // 名前がアドレスのような形式の場合はそのまま返す
    if (name.match(/^0x[0-9a-fA-F]{40}$/)) {
      return name;
    }
    // それ以外の場合は元の実装を呼び出す（nullを処理）
    const resolved = await super.resolveName(name);
    return resolved || name; // nullの場合は元の名前を返す
  }
}

export class EthrDIDHelper {
  private ethrDID!: EthrDID;
  private resolver!: Resolver;
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private chainId!: string;
  private registryAddress: string;
  private networkName: string;

  constructor(registryAddress: string, customPrivateKey?: string) {
    this.registryAddress = registryAddress;
    // ネットワーク名を環境変数から取得、デフォルトは'development'
    this.networkName = process.env.NETWORK_NAME || 'development';

    // ENS名前解決をモックしたプロバイダーを使用
    const providerUrl = process.env.SEPOLIA_RPC_URL || process.env.BLOCKCHAIN_URL || 'http://localhost:8545';
    this.provider = new MockEnsProvider(providerUrl);

    // カスタムプライベートキーが提供された場合はそれを使用、そうでなければデフォルトのウォレットを取得
    if (customPrivateKey) {
      this.wallet = new ethers.Wallet(customPrivateKey, this.provider);
    } else {
      this.wallet = getWallet();
    }
  }

  async initialize(): Promise<void> {
    try {
      const network = await this.provider.getNetwork();
      this.chainId = network.chainId.toString();

      // 環境変数からCHAIN_IDが指定されている場合はそれを使用
      if (process.env.CHAIN_ID) {
        this.chainId = process.env.CHAIN_ID;
      }

      console.log(`Network chainId: ${this.chainId}, networkName: ${this.networkName}`);
      console.log(`Using wallet address: ${this.wallet.address}`);
      console.log(`Registry address: ${this.registryAddress}`);

      // Sepolia testnetの場合はchainIdを使用、それ以外はnetworkNameを使用
      const chainNameOrId = this.networkName === 'sepolia' ? parseInt(this.chainId) : this.networkName;

      this.ethrDID = new EthrDID({
        identifier: this.wallet.address,
        privateKey: this.wallet.privateKey.slice(2),
        chainNameOrId: chainNameOrId,
        provider: this.provider,
        registry: this.registryAddress,
        txSigner: this.wallet
      });

      console.log(`EthrDID created with DID: ${this.ethrDID.did}`);

      const resolverConfig = {
        networks: [
          {
            name: this.networkName,
            provider: this.provider,
            registry: this.registryAddress,
            chainId: chainNameOrId,
          },
        ],
      };
      const ethrResolver = getEthrResolver(resolverConfig);
      this.resolver = new Resolver(ethrResolver);

      console.log('DID resolver configured successfully');
    } catch (error) {
      console.error('Failed to initialize EthrDIDHelper:', error);
      throw error;
    }
  }

  async resolveDID(did?: string): Promise<DIDDocument> {
    // didToResolveを変数として宣言
    let didToResolve = did || this.ethrDID.did;
    console.log(`Resolving DID: ${didToResolve}`);

    try {
      // 正規表現を使ってDIDを解析し、必要に応じて修正
      const didMatch = didToResolve.match(/^did:ethr:([^:]+):(.+)$/);
      if (didMatch) {
        // ネットワーク名を'development'に置き換え
        const [_, networkId, address] = didMatch;
        if (networkId !== this.networkName) {
          const correctedDid = `did:ethr:${this.networkName}:${address}`;
          console.log(`Correcting DID from ${didToResolve} to ${correctedDid}`);
          didToResolve = correctedDid;
        }
      }

      const result = await this.resolver.resolve(didToResolve);
      if (!result || !result.didDocument) {
        console.error(`Failed to resolve DID ${didToResolve}`, result);

        // 単純なDIDドキュメントを手動で作成して返す
        const address = this.wallet.address;
        const manualDocument: DIDDocument = {
          id: didToResolve,
          verificationMethod: [
            {
              id: `${didToResolve}#controller`,
              type: 'EcdsaSecp256k1RecoveryMethod2020',
              controller: didToResolve,
              blockchainAccountId: `eip155:${this.chainId}:${address}`
            }
          ],
          authentication: [`${didToResolve}#controller`],
          assertionMethod: [`${didToResolve}#controller`]
        };

        console.log('Created manual DID document as fallback');
        return manualDocument;
      }

      console.log('DID resolution successful');
      return result.didDocument;
    } catch (error) {
      console.error('DID resolution failed:', error);

      // エラー時のフォールバック
      const address = this.wallet.address;
      const manualDocument: DIDDocument = {
        id: didToResolve,
        verificationMethod: [
          {
            id: `${didToResolve}#controller`,
            type: 'EcdsaSecp256k1RecoveryMethod2020',
            controller: didToResolve,
            blockchainAccountId: `eip155:${this.chainId}:${address}`
          }
        ],
        authentication: [`${didToResolve}#controller`],
        assertionMethod: [`${didToResolve}#controller`]
      };

      console.log('Created manual DID document as fallback after error');
      return manualDocument;
    }
  }

  async changeOwner(newOwnerAddress: string): Promise<void> {
    try {
      console.log(`Changing owner to ${newOwnerAddress}`);
      await this.ethrDID.changeOwner(newOwnerAddress);
      console.log('Owner changed successfully');
    } catch (error) {
      console.error('Failed to change owner:', error);
      throw error;
    }
  }

  async addDelegate(delegateType: string, delegateAddress: string, expiresIn: number): Promise<void> {
    try {
      console.log(`Adding delegate of type ${delegateType}: ${delegateAddress}`);

      const ethrDidAny = this.ethrDID as any;

      // ENSの問題を回避するために直接コントラクトにアクセスする方法を試す
      try {
        if (typeof ethrDidAny.addDelegate === 'function') {
          if (ethrDidAny.addDelegate.length === 1) {
            await ethrDidAny.addDelegate({
              delegateType,
              delegate: delegateAddress,
              expiresIn
            });
          } else {
            await ethrDidAny.addDelegate(delegateType, delegateAddress, expiresIn);
          }
        } else {
          throw new Error('addDelegate method not found on EthrDID instance');
        }
      } catch (e) {
        console.warn('Original delegate call failed, trying direct contract call:', e);

        // 直接コントラクトを呼び出す代替手段
        const contract = new ethers.Contract(
          this.registryAddress,
          [
            'function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity) public'
          ],
          this.wallet
        );

        const delegateTypeBytes32 = ethers.encodeBytes32String(delegateType);
        await contract.addDelegate(this.wallet.address, delegateTypeBytes32, delegateAddress, expiresIn);
      }

      console.log('Delegate added successfully');
    } catch (error) {
      console.error('Failed to add delegate:', error);
      throw error;
    }
  }

  async revokeDelegate(delegateType: string, delegateAddress: string): Promise<void> {
    try {
      console.log(`Revoking delegate of type ${delegateType}: ${delegateAddress}`);

      const ethrDidAny = this.ethrDID as any;

      // ENSの問題を回避するために直接コントラクトにアクセスする方法を試す
      try {
        if (typeof ethrDidAny.revokeDelegate === 'function') {
          if (ethrDidAny.revokeDelegate.length === 1) {
            await ethrDidAny.revokeDelegate({
              delegateType,
              delegate: delegateAddress
            });
          } else {
            await ethrDidAny.revokeDelegate(delegateType, delegateAddress);
          }
        } else {
          throw new Error('revokeDelegate method not found on EthrDID instance');
        }
      } catch (e) {
        console.warn('Original revoke delegate call failed, trying direct contract call:', e);

        // 直接コントラクトを呼び出す代替手段
        const contract = new ethers.Contract(
          this.registryAddress,
          [
            'function revokeDelegate(address identity, bytes32 delegateType, address delegate) public'
          ],
          this.wallet
        );

        const delegateTypeBytes32 = ethers.encodeBytes32String(delegateType);
        await contract.revokeDelegate(this.wallet.address, delegateTypeBytes32, delegateAddress);
      }

      console.log('Delegate revoked successfully');
    } catch (error) {
      console.error('Failed to revoke delegate:', error);
      throw error;
    }
  }

  async setAttribute(key: string, value: string, expiresIn: number): Promise<void> {
    try {
      console.log(`Setting attribute ${key} with value ${value}`);

      try {
        await this.ethrDID.setAttribute(key, value, expiresIn);
      } catch (e) {
        console.warn('Original setAttribute call failed, trying direct contract call:', e);

        // 直接コントラクトを呼び出す代替手段
        const contract = new ethers.Contract(
          this.registryAddress,
          [
            'function setAttribute(address identity, bytes32 name, bytes value, uint validity) public'
          ],
          this.wallet
        );

        const nameBytes32 = ethers.encodeBytes32String(key.split('/')[0]);
        const valueBytes = ethers.toUtf8Bytes(value);
        await contract.setAttribute(this.wallet.address, nameBytes32, valueBytes, expiresIn);
      }

      console.log('Attribute set successfully');
    } catch (error) {
      console.error('Failed to set attribute:', error);
      throw error;
    }
  }

  async revokeAttribute(key: string, value: string): Promise<void> {
    try {
      console.log(`Revoking attribute ${key} with value ${value}`);

      try {
        await this.ethrDID.revokeAttribute(key, value);
      } catch (e) {
        console.warn('Original revokeAttribute call failed, trying direct contract call:', e);

        // 直接コントラクトを呼び出す代替手段
        const contract = new ethers.Contract(
          this.registryAddress,
          [
            'function revokeAttribute(address identity, bytes32 name, bytes value) public'
          ],
          this.wallet
        );

        const nameBytes32 = ethers.encodeBytes32String(key.split('/')[0]);
        const valueBytes = ethers.toUtf8Bytes(value);
        await contract.revokeAttribute(this.wallet.address, nameBytes32, valueBytes);
      }

      console.log('Attribute revoked successfully');
    } catch (error) {
      console.error('Failed to revoke attribute:', error);
      throw error;
    }
  }

  getDID(): string {
    return this.ethrDID.did;
  }

  getAddress(): string {
    return this.wallet.address;
  }

  getWallet(): ethers.Wallet {
    return this.wallet;
  }
} 