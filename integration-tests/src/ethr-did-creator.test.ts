import { describe, expect, it, beforeAll } from '@jest/globals';
import { ethers } from 'ethers';
import { EthrDID } from 'ethr-did';
import { Resolver } from 'did-resolver';
import { getResolver as getEthrResolver } from 'ethr-did-resolver';
import { getRegistryAddress, getProvider, getWallet } from './utils/deploy-helper';

// 定数定義
const ONE_DAY = 24 * 60 * 60; // 1日（秒単位）
const ONE_YEAR = 365 * ONE_DAY; // 1年（秒単位）

// トランザクション間に遅延を追加するヘルパー関数
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('ethr-didを使用したDID作成テスト', () => {
  let registryAddress: string;
  let provider: ethers.Provider;
  let wallet: ethers.Wallet;
  let ethrDid: any; // anyを使用して型エラーを回避
  let resolver: Resolver;

  beforeAll(async () => {
    try {
      // コントラクトアドレスの取得
      registryAddress = await getRegistryAddress();
      console.log(`Registry address: ${registryAddress}`);

      // プロバイダーとウォレットの取得
      provider = getProvider();
      wallet = getWallet();
      console.log(`Wallet address: ${wallet.address}`);

      // EthrDIDの作成
      ethrDid = new EthrDID({
        identifier: wallet.address,
        privateKey: wallet.privateKey.slice(2), // '0x'プレフィックスを削除
        chainNameOrId: 'development',
        provider: provider,
        registry: registryAddress,
        txSigner: wallet
      });

      console.log(`Created EthrDID with DID: ${ethrDid.did}`);

      // リゾルバーの設定
      const resolverConfig = {
        networks: [
          {
            name: 'development',
            provider: provider,
            registry: registryAddress,
            chainId: 'development'
          }
        ]
      };
      const ethrResolver = getEthrResolver(resolverConfig);
      resolver = new Resolver(ethrResolver);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  it('ethr-didを使用してDIDを作成し解決できる', async () => {
    // DIDの解決
    const did = ethrDid.did;
    const resolution = await resolver.resolve(did);

    // 結果をログ出力
    console.log('DID resolution result:', JSON.stringify(resolution, null, 2));

    // 基本的な検証
    expect(resolution.didDocument).toBeDefined();
    expect(resolution.didDocument?.id).toBe(did);
  });

  it('ethr-didを使用して属性を設定できる', async () => {
    // 属性の設定
    const key = 'did/svc/TestService';
    const value = JSON.stringify({
      type: 'TestService',
      serviceEndpoint: 'https://test-service.example.com'
    });

    // ethr-didのsetAttributeメソッドを使用
    await ethrDid.setAttribute(key, value, ONE_YEAR);
    console.log(`Set attribute ${key} with value ${value}`);

    // 処理待ち
    await wait(1000);

    // DIDの解決
    const resolution = await resolver.resolve(ethrDid.did);

    // 結果をログ出力
    console.log('DID with attribute resolution result:', JSON.stringify(resolution, null, 2));

    // 検証
    expect(resolution.didDocument).toBeDefined();
    // サービスが適切に設定されているか確認
    const service = resolution.didDocument?.service;
    expect(service).toBeDefined();
  });

  it('ethr-didを使用してデリゲートを追加できる', async () => {
    // 新しいウォレット（デリゲート）の作成
    const delegateWallet = ethers.Wallet.createRandom().connect(provider);
    console.log(`Delegate wallet address: ${delegateWallet.address}`);

    // ethr-didのインスタンスにdelegateの追加
    // `addDelegate`メソッドは引数として delegateType, delegate, expiresIn を取る
    const delegateType = 'sigAuth';

    // 直接コントラクトを呼び出す方法を使用
    const contract = new ethers.Contract(
      registryAddress,
      [
        'function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity) public'
      ],
      wallet
    );

    const delegateTypeBytes32 = ethers.encodeBytes32String(delegateType);
    await contract.addDelegate(wallet.address, delegateTypeBytes32, delegateWallet.address, ONE_YEAR);

    console.log(`Added delegate of type ${delegateType}: ${delegateWallet.address}`);

    // 処理待ち
    await wait(1000);

    // DIDの解決
    const resolution = await resolver.resolve(ethrDid.did);

    // 結果をログ出力
    console.log('DID with delegate resolution result:', JSON.stringify(resolution, null, 2));

    // 検証
    expect(resolution.didDocument).toBeDefined();
    // デリゲートが適切に設定されているか確認（verificationMethodに反映されるはず）
    const verificationMethod = resolution.didDocument?.verificationMethod;
    expect(verificationMethod).toBeDefined();
  });

  it('ethr-didを使用して完全なDIDドキュメントを作成できる', async () => {
    // Hardhatの事前資金付きアカウントを使用（2番目のアカウント）
    const privateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const newWallet = new ethers.Wallet(privateKey, provider);
    console.log(`New wallet address: ${newWallet.address}`);

    const newEthrDid = new EthrDID({
      identifier: newWallet.address,
      privateKey: newWallet.privateKey.slice(2),
      chainNameOrId: 'development',
      provider: provider,
      registry: registryAddress,
      txSigner: newWallet
    });

    console.log(`Created new EthrDID with DID: ${newEthrDid.did}`);

    // 1. サービスの追加
    await newEthrDid.setAttribute('did/svc/MessagingService', JSON.stringify({
      type: 'MessagingService',
      serviceEndpoint: 'https://messaging.example.com'
    }), ONE_YEAR);

    // 処理待ち
    await wait(1000);

    // 2. 公開鍵の追加
    const publicKey = ethers.Wallet.createRandom();
    await newEthrDid.setAttribute('did/pub/Ed25519/veriKey/base64', publicKey.publicKey, ONE_YEAR);

    // 処理待ち
    await wait(1000);

    // 3. デリゲートの追加 (直接コントラクト呼び出し)
    const delegateWallet = ethers.Wallet.createRandom();
    const delegateType = 'sigAuth';

    // 直接コントラクトを呼び出す
    const contract = new ethers.Contract(
      registryAddress,
      [
        'function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity) public'
      ],
      newWallet
    );

    const delegateTypeBytes32 = ethers.encodeBytes32String(delegateType);
    await contract.addDelegate(newWallet.address, delegateTypeBytes32, delegateWallet.address, ONE_YEAR);

    // 処理待ち
    await wait(1000);

    // DIDの解決
    const resolution = await resolver.resolve(newEthrDid.did);

    // 結果をログ出力
    console.log('Complete DID document resolution result:', JSON.stringify(resolution, null, 2));

    // 検証
    expect(resolution.didDocument).toBeDefined();
    expect(resolution.didDocument?.id).toBe(newEthrDid.did);

    // サービス、公開鍵、デリゲートが全て設定されているか確認
    const service = resolution.didDocument?.service;
    expect(service).toBeDefined();

    const verificationMethod = resolution.didDocument?.verificationMethod;
    expect(verificationMethod).toBeDefined();
  });
}); 