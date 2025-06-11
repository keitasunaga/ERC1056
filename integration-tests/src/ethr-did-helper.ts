import { ethers } from 'ethers';

class EthrDidHelper {
  private ethrDID: any;
  private registryAddress: string;
  private wallet: any;

  constructor(ethrDID: any, registryAddress: string, wallet: any) {
    this.ethrDID = ethrDID;
    this.registryAddress = registryAddress;
    this.wallet = wallet;
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

        // 現在のnonceを取得
        const currentNonce = await this.wallet.getNonce();
        console.log(`Current nonce for revokeDelegate: ${currentNonce}`);

        // nonceを明示的に指定してトランザクションを送信
        const tx = await contract.revokeDelegate.populateTransaction(
          this.wallet.address,
          delegateTypeBytes32,
          delegateAddress
        );

        // トランザクションオプションを設定
        const signedTx = await this.wallet.sendTransaction({
          ...tx,
          nonce: currentNonce
        });

        // トランザクション完了を待つ
        await signedTx.wait();
      }

      console.log('Delegate revoked successfully');
    } catch (error) {
      console.error('Failed to revoke delegate:', error);
      throw error;
    }
  }
}

export default EthrDidHelper; 