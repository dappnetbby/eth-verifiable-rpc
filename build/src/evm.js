"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVM2 = exports.VerifiableEthExecEnv = void 0;
const ethers = __importStar(require("ethers"));
const vm_1 = require("@ethereumjs/vm");
const evm_1 = require("@ethereumjs/evm");
const util_1 = require("@ethereumjs/util");
class VerifiableEthExecEnv extends vm_1.EEI {
    constructor(stateManager, common, blockchain, stateRoot, blockNumber, provider) {
        super(stateManager, common, blockchain);
        this.warm = {};
        this.warm2 = {};
        this.warm3 = {};
        this._provider = provider;
        this.stateRoot = stateRoot;
        this.blockNumber = blockNumber;
    }
    async _getProof({ address, storageKeys }) {
        const { stateRoot, blockNumber } = this;
        const proof = await this._provider.send('eth_getProof', [
            address,
            storageKeys || [],
            blockNumber
        ]);
        const success = await this._stateManager.verifyProof(proof);
        if (!success)
            throw new Error("proof invalid");
        return proof;
    }
    /**
     * Gets the account associated with `address`. Returns an empty account if the account does not exist.
     * @param address - Address of the `account` to get
     */
    async getAccount(address) {
        // Check 1st load.
        if (this.warm[address.toString()]) {
            return await this._stateManager.getAccount(address);
        }
        this.warm[address.toString()] = true;
        // Skip 0x0 address.
        if (address.toString() == ethers.constants.AddressZero) {
            return await this._stateManager.getAccount(address);
        }
        // Lookup from RPC.
        const res = await this._getProof({ address: address.toString() });
        const account = await util_1.Account.fromAccountData({
            ...res,
            storageRoot: res.storageHash
        });
        await this._stateManager.putAccount(address, account);
        return account;
    }
    /**
     * Gets the code corresponding to the provided `address`.
     * @param address - Address to get the `code` for
     * @returns {Promise<Buffer>} -  Resolves with the code corresponding to the provided address.
     * Returns an empty `Buffer` if the account has no associated code.
     */
    async getContractCode(address) {
        // Check 1st load.
        if (this.warm2[address.toString()]) {
            return await this._stateManager.getContractCode(address);
        }
        this.warm2[address.toString()] = true;
        // Lookup from RPC.
        const res = await this._getProof({ address: address.toString() });
        const code = await this._provider.send('eth_getCode', [
            address.toString(),
            this.blockNumber
        ]);
        const buf = Buffer.from(code.slice(2), 'hex');
        await this._stateManager.putContractCode(address, buf);
        return buf;
    }
    /**
     * Gets the storage value associated with the provided `address` and `key`. This method returns
     * the shortest representation of the stored value.
     * @param address -  Address of the account to get the storage for
     * @param key - Key in the account's storage to get the value for. Must be 32 bytes long.
     * @returns {Promise<Buffer>} - The storage value for the account
     * corresponding to the provided address at the provided key.
     * If this does not exist an empty `Buffer` is returned.
     */
    async getContractStorage(address, key) {
        // Check 1st load.
        const id = `${address.toString()}-${key.toString('hex')}`;
        if (this.warm3[id]) {
            return await this._stateManager.getContractStorage(address, key);
        }
        this.warm3[id] = true;
        // Lookup from RPC.
        const res = await this._getProof({ address: address.toString(), storageKeys: ['0x' + key.toString('hex')] });
        const value = Buffer.from(res.slice(2), 'hex');
        // const decoded = Buffer.from(RLP.decode(Uint8Array.from(value ?? [])) as Uint8Array)
        this._stateManager.putContractStorage(address, key, value);
        return value;
    }
    // 
    // EEI.
    // 
    // None of these are actually used AFAICS.
    // Which is why they weren't fixed to use the `this._getProof` API.
    /**
     * Returns balance of the given account.
     * @param address - Address of account
     */
    async getExternalBalance(address) {
        console.log('getExternalBalance', address.toString());
        // const account = await this.getAccount(address)
        // return account.balance
        const balance = await this._provider.getBalance(address.toString());
        return BigInt(balance.toString());
    }
    /**
     * Get size of an account’s code.
     * @param address - Address of account
     */
    async getExternalCodeSize(address) {
        console.log('getExternalCodeSize', address.toString());
        // const code = await this.getContractCode(address)
        // return BigInt(code.length)
        const code = await this.getExternalCode(address);
        return BigInt(code.length);
    }
    /**
     * Returns code of an account.
     * @param address - Address of account
     */
    async getExternalCode(address) {
        console.log('getExternalCode', address.toString());
        const code = await this._provider.send('eth_getCode', [
            address.toString(),
            'latest'
        ]);
        console.log(code);
        return Buffer.from(code.slice(2), 'hex');
    }
    /**
     * Returns Gets the hash of one of the 256 most recent complete blocks.
     * @param num - Number of block
     */
    async getBlockHash(num) {
        const res = await this._provider.getBlock(num.toString());
        return BigInt(res.hash);
    }
    // /**
    //  * Storage 256-bit value into storage of an address
    //  * @param address Address to store into
    //  * @param key Storage key
    //  * @param value Storage value
    //  */
    // async storageStore(address: Address, key: Buffer, value: Buffer): Promise<void> {
    //     await this.putContractStorage(address, key, value)
    // }
    /**
     * Loads a 256-bit value to memory from persistent storage.
     * @param address Address to get storage key value from
     * @param key Storage key
     * @param original If true, return the original storage value (default: false)
     */
    async storageLoad(address, key, original = false) {
        // TODO: 1st load. Though this probably doesn't matter.
        const proof = await this._getProof({ address: address.toString(), storageKeys: ['0x' + key.toString('hex')] });
        const value = proof.storageProof[0].value;
        return Buffer.from(value.slice(2), 'hex');
        // if (original) {
        //     return this.getOriginalContractStorage(address, key)
        // } else {
        //     // return this.getContractStorage(address, key)
        //     const res = await this._provider.send('eth_getStorageAt', [
        //         address.toString(),
        //         '0x' + key.toString('hex'),
        //         'latest'
        //     ])
        //     return Buffer.from(res.slice(2), 'hex')
        // }
    }
}
exports.VerifiableEthExecEnv = VerifiableEthExecEnv;
class EVM2 extends evm_1.EVM {
    constructor(opts) {
        super(opts);
    }
}
exports.EVM2 = EVM2;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2V2bS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFnQztBQUdoQyx1Q0FBb0M7QUFDcEMseUNBQXFDO0FBS3JDLDJDQUEwQztBQXdCMUMsTUFBYSxvQkFBcUIsU0FBUSxRQUFHO0lBUXpDLFlBQVksWUFBMEIsRUFBRSxNQUFjLEVBQUUsVUFBc0IsRUFBRSxTQUFpQixFQUFFLFdBQW1CLEVBQUUsUUFBMEM7UUFDOUosS0FBSyxDQUFDLFlBQVksRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUE7UUFQakMsU0FBSSxHQUF5QixFQUFFLENBQUE7UUFDL0IsVUFBSyxHQUF5QixFQUFFLENBQUE7UUFDaEMsVUFBSyxHQUF5QixFQUFFLENBQUE7UUFNdEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUE7UUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUE7UUFDMUIsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUE7SUFDbEMsQ0FBQztJQUVELEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUErQztRQUNqRixNQUFNLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQTtRQUV2QyxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtZQUNwRCxPQUFPO1lBQ1AsV0FBVyxJQUFJLEVBQUU7WUFDakIsV0FBVztTQUNkLENBQUMsQ0FBQTtRQUVGLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFZLENBQUMsS0FBSyxDQUFDLENBQUE7UUFDNUQsSUFBSSxDQUFDLE9BQU87WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFBO1FBRTlDLE9BQU8sS0FBSyxD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QUFDLENBQUMsRUFBRSxDQUFDLENBQUE7UUFDOUcsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7UUFDekMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDekMsa0JBQWtCO1FBQ2xCLDJEQUEyRDtRQUMzRCxXQUFXO1FBQ1gsc0RBQXNEO1FBQ3RELGtFQUFrRTtRQUNsRSw4QkFBOEI7UUFDOUIsc0NBQXNDO1FBQ3RDLG1CQUFtQjtRQUNuQixTQUFTO1FBQ1QsOENBQThDO1FBQzlDLElBQUk7SUFDUixDQUFDO0NBQ0o7QUFyTUQsb0RBcU1DO0FBRUQsTUFBYSxJQUFLLFNBQVEsU0FBRztJQUN6QixZQUFZLElBQWE7UUFDckIsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ2YsQ0FBQztDQUNKO0FBSkQsb0JBSUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBldGhlcnMgZnJvbSAnZXRoZXJzJ1xuaW1wb3J0IHsgQmxvY2tjaGFpbiB9IGZyb20gJ0BldGhlcmV1bWpzL2Jsb2NrY2hhaW4nXG5pbXBvcnQgeyBDaGFpbiwgQ29tbW9uLCBIYXJkZm9yayB9IGZyb20gJ0BldGhlcmV1bWpzL2NvbW1vbidcbmltcG9ydCB7IEVFSSB9IGZyb20gJ0BldGhlcmV1bWpzL3ZtJ1xuaW1wb3J0IHsgRVZNIH0gZnJvbSAnQGV0aGVyZXVtanMvZXZtJ1xuaW1wb3J0IHsgRVZNT3B0cyB9IGZyb20gJ0BldGhlcmV1bWpzL2V2bS9zcmMvZXZtJ1xuaW1wb3J0IHsgRGVmYXVsdFN0YXRlTWFuYWdlciB9IGZyb20gJ0BldGhlcmV1bWpzL3N0YXRlbWFuYWdlcidcbmltcG9ydCB0eXBlIHsgU3RhdGVNYW5hZ2VyIH0gZnJvbSAnQGV0aGVyZXVtanMvc3RhdGVtYW5hZ2VyJ1xuaW1wb3J0IHsgQWRkcmVzcyB9IGZyb20gJ0BldGhlcmV1bWpzL3V0aWwnXG5pbXBvcnQgeyBBY2NvdW50IH0gZnJvbSAnQGV0aGVyZXVtanMvdXRpbCdcblxuZXhwb3J0IGludGVyZmFjZSBIb29rZWRTdGF0ZUFjY2VzcyB7XG4gICAgLy8gYWNjb3VudEV4aXN0cyhhZGRyZXNzOiBBZGRyZXNzKTogUHJvbWlzZTxib29sZWFuPlxuICAgIGdldEFjY291bnQoYWRkcmVzczogQWRkcmVzcyk6IFByb21pc2U8QWNjb3VudD5cbiAgICAvLyBwdXRBY2NvdW50KGFkZHJlc3M6IEFkZHJlc3MsIGFjY291bnQ6IEFjY291bnQpOiBQcm9taXNlPHZvaWQ+XG4gICAgLy8gYWNjb3VudElzRW1wdHkoYWRkcmVzczogQWRkcmVzcyk6IFByb21pc2U8Ym9vbGVhbj5cbiAgICAvLyBkZWxldGVBY2NvdW50KGFkZHJlc3M6IEFkZHJlc3MpOiBQcm9taXNlPHZvaWQ+XG4gICAgLy8gbW9kaWZ5QWNjb3VudEZpZWxkcyhhZGRyZXNzOiBBZGRyZXNzLCBhY2NvdW50RmllbGRzOiBBY2NvdW50RmllbGRzKTogUHJvbWlzZTx2b2lkPlxuICAgIC8vIHB1dENvbnRyYWN0Q29kZShhZGRyZXNzOiBBZGRyZXNzLCB2YWx1ZTogQnVmZmVyKTogUHJvbWlzZTx2b2lkPlxuICAgIGdldENvbnRyYWN0Q29kZShhZGRyZXNzOiBBZGRyZXNzKTogUHJvbWlzZTxCdWZmZXI+XG4gICAgZ2V0Q29udHJhY3RTdG9yYWdlKGFkZHJlc3M6IEFkZHJlc3MsIGtleTogQnVmZmVyKTogUHJvbWlzZTxCdWZmZXI+XG4gICAgLy8gcHV0Q29udHJhY3RTdG9yYWdlKGFkZHJlc3M6IEFkZHJlc3MsIGtleTogQnVmZmVyLCB2YWx1ZTogQnVmZmVyKTogUHJvbWlzZTx2b2lkPlxuICAgIC8vIGNsZWFyQ29udHJhY3RTdG9yYWdlKGFkZHJlc3M6IEFkZHJlc3MpOiBQcm9taXNlPHZvaWQ+XG4gICAgLy8gY2hlY2twb2ludCgpOiBQcm9taXNlPHZvaWQ+XG4gICAgLy8gY29tbWl0KCk6IFByb21pc2U8dm9pZD5cbiAgICAvLyByZXZlcnQoKTogUHJvbWlzZTx2b2lkPlxuICAgIC8vIGdldFN0YXRlUm9vdCgpOiBQcm9taXNlPEJ1ZmZlcj5cbiAgICAvLyBzZXRTdGF0ZVJvb3Qoc3RhdGVSb290OiBCdWZmZXIpOiBQcm9taXNlPHZvaWQ+XG4gICAgLy8gZ2V0UHJvb2Y/KGFkZHJlc3M6IEFkZHJlc3MsIHN0b3JhZ2VTbG90czogQnVmZmVyW10pOiBQcm9taXNlPFByb29mPlxuICAgIC8vIHZlcmlmeVByb29mPyhwcm9vZjogUHJvb2YpOiBQcm9taXNlPGJvb2xlYW4+XG4gICAgLy8gaGFzU3RhdGVSb290KHJvb3Q6IEJ1ZmZlcik6IFByb21pc2U8Ym9vbGVhbj5cbn1cblxuZXhwb3J0IGNsYXNzIFZlcmlmaWFibGVFdGhFeGVjRW52IGV4dGVuZHMgRUVJIGltcGxlbWVudHMgSG9va2VkU3RhdGVBY2Nlc3Mge1xuICAgIHByb3RlY3RlZCBfcHJvdmlkZXI6IGV0aGVycy5wcm92aWRlcnMuSnNvblJwY1Byb3ZpZGVyXG4gICAgcHJvdGVjdGVkIHdhcm06IFJlY29yZDxhbnksIGJvb2xlYW4+ID0ge31cbiAgICBwcm90ZWN0ZWQgd2FybTI6IFJlY29yZDxhbnksIGJvb2xlYW4+ID0ge31cbiAgICBwcm90ZWN0ZWQgd2FybTM6IFJlY29yZDxhbnksIGJvb2xlYW4+ID0ge31cbiAgICBwcm90ZWN0ZWQgc3RhdGVSb290OiBzdHJpbmc7XG4gICAgcHJvdGVjdGVkIGJsb2NrTnVtYmVyOiBzdHJpbmdcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRlTWFuYWdlcjogU3RhdGVNYW5hZ2VyLCBjb21tb246IENvbW1vbiwgYmxvY2tjaGFpbjogQmxvY2tjaGFpbiwgc3RhdGVSb290OiBzdHJpbmcsIGJsb2NrTnVtYmVyOiBzdHJpbmcsIHByb3ZpZGVyOiBldGhlcnMucHJvdmlkZXJzLkpzb25ScGNQcm92aWRlcikge1xuICAgICAgICBzdXBlcihzdGF0ZU1hbmFnZXIsIGNvbW1vbiwgYmxvY2tjaGFpbilcbiAgICAgICAgdGhpcy5fcHJvdmlkZXIgPSBwcm92aWRlclxuICAgICAgICB0aGlzLnN0YXRlUm9vdCA9IHN0YXRlUm9vdFxuICAgICAgICB0aGlzLmJsb2NrTnVtYmVyID0gYmxvY2tOdW1iZXJcbiAgICB9XG5cbiAgICBhc3luYyBfZ2V0UHJvb2YoeyBhZGRyZXNzLCBzdG9yYWdlS2V5cyB9OiB7IGFkZHJlc3M6IHN0cmluZywgc3RvcmFnZUtleXM/OiBzdHJpbmdbXSB9KSB7XG4gICAgICAgIGNvbnN0IHsgc3RhdGVSb290LCBibG9ja051bWJlciB9ID0gdGhpc1xuXG4gICAgICAgIGNvbnN0IHByb29mID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIuc2VuZCgnZXRoX2dldFByb29mJywgW1xuICAgICAgICAgICAgYWRkcmVzcyxcbiAgICAgICAgICAgIHN0b3JhZ2VLZXlzIHx8IFtdLFxuICAgICAgICAgICAgYmxvY2tOdW1iZXJcbiAgICAgICAgXSlcblxuICAgICAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgdGhpcy5fc3RhdGVNYW5hZ2VyLnZlcmlmeVByb29mIShwcm9vZilcbiAgICAgICAgaWYgKCFzdWNjZXNzKSB0aHJvdyBuZXcgRXJyb3IoXCJwcm9vZiBpbnZhbGlkXCIpXG5cbiAgICAgICAgcmV0dXJuIHByb29mXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgYWNjb3VudCBhc3NvY2lhdGVkIHdpdGggYGFkZHJlc3NgLiBSZXR1cm5zIGFuIGVtcHR5IGFjY291bnQgaWYgdGhlIGFjY291bnQgZG9lcyBub3QgZXhpc3QuXG4gICAgICogQHBhcmFtIGFkZHJlc3MgLSBBZGRyZXNzIG9mIHRoZSBgYWNjb3VudGAgdG8gZ2V0XG4gICAgICovXG4gICAgYXN5bmMgZ2V0QWNjb3VudChhZGRyZXNzOiBBZGRyZXNzKTogUHJvbWlzZTxBY2NvdW50PiB7XG4gICAgICAgIC8vIENoZWNrIDFzdCBsb2FkLlxuICAgICAgICBpZiAodGhpcy53YXJtW2FkZHJlc3MudG9TdHJpbmcoKV0pIHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLl9zdGF0ZU1hbmFnZXIuZ2V0QWNjb3VudChhZGRyZXNzKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMud2FybVthZGRyZXNzLnRvU3RyaW5nKCldID0gdHJ1ZVxuXG4gICAgICAgIC8vIFNraXAgMHgwIGFkZHJlc3MuXG4gICAgICAgIGlmIChhZGRyZXNzLnRvU3RyaW5nKCkgPT0gZXRoZXJzLmNvbnN0YW50cy5BZGRyZXNzWmVybykge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuX3N0YXRlTWFuYWdlci5nZXRBY2NvdW50KGFkZHJlc3MpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBMb29rdXAgZnJvbSBSUEMuXG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuX2dldFByb29mKHsgYWRkcmVzczogYWRkcmVzcy50b1N0cmluZygpIH0pXG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBBY2NvdW50LmZyb21BY2NvdW50RGF0YSh7XG4gICAgICAgICAgICAuLi5yZXMsXG4gICAgICAgICAgICBzdG9yYWdlUm9vdDogcmVzLnN0b3JhZ2VIYXNoXG4gICAgICAgIH0pXG4gICAgICAgIGF3YWl0IHRoaXMuX3N0YXRlTWFuYWdlci5wdXRBY2NvdW50KGFkZHJlc3MsIGFjY291bnQpXG5cbiAgICAgICAgcmV0dXJuIGFjY291bnRcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBjb2RlIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByb3ZpZGVkIGBhZGRyZXNzYC5cbiAgICAgKiBAcGFyYW0gYWRkcmVzcyAtIEFkZHJlc3MgdG8gZ2V0IHRoZSBgY29kZWAgZm9yXG4gICAgICogQHJldHVybnMge1Byb21pc2U8QnVmZmVyPn0gLSAgUmVzb2x2ZXMgd2l0aCB0aGUgY29kZSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcm92aWRlZCBhZGRyZXNzLlxuICAgICAqIFJldHVybnMgYW4gZW1wdHkgYEJ1ZmZlcmAgaWYgdGhlIGFjY291bnQgaGFzIG5vIGFzc29jaWF0ZWQgY29kZS5cbiAgICAgKi9cbiAgICBhc3luYyBnZXRDb250cmFjdENvZGUoYWRkcmVzczogQWRkcmVzcyk6IFByb21pc2U8QnVmZmVyPiB7XG4gICAgICAgIC8vIENoZWNrIDFzdCBsb2FkLlxuICAgICAgICBpZiAodGhpcy53YXJtMlthZGRyZXNzLnRvU3RyaW5nKCldKSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5fc3RhdGVNYW5hZ2VyLmdldENvbnRyYWN0Q29kZShhZGRyZXNzKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMud2FybTJbYWRkcmVzcy50b1N0cmluZygpXSA9IHRydWVcblxuXG4gICAgICAgIC8vIExvb2t1cCBmcm9tIFJQQy5cbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5fZ2V0UHJvb2YoeyBhZGRyZXNzOiBhZGRyZXNzLnRvU3RyaW5nKCkgfSlcbiAgICAgICAgY29uc3QgY29kZSA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnNlbmQoJ2V0aF9nZXRDb2RlJywgW1xuICAgICAgICAgICAgYWRkcmVzcy50b1N0cmluZygpLFxuICAgICAgICAgICAgdGhpcy5ibG9ja051bWJlclxuICAgICAgICBdKVxuXG4gICAgICAgIGNvbnN0IGJ1ZiA9IEJ1ZmZlci5mcm9tKGNvZGUuc2xpY2UoMiksICdoZXgnKVxuICAgICAgICBhd2FpdCB0aGlzLl9zdGF0ZU1hbmFnZXIucHV0Q29udHJhY3RDb2RlKGFkZHJlc3MsIGJ1ZilcblxuICAgICAgICByZXR1cm4gYnVmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgc3RvcmFnZSB2YWx1ZSBhc3NvY2lhdGVkIHdpdGggdGhlIHByb3ZpZGVkIGBhZGRyZXNzYCBhbmQgYGtleWAuIFRoaXMgbWV0aG9kIHJldHVybnNcbiAgICAgKiB0aGUgc2hvcnRlc3QgcmVwcmVzZW50YXRpb24gb2YgdGhlIHN0b3JlZCB2YWx1ZS5cbiAgICAgKiBAcGFyYW0gYWRkcmVzcyAtICBBZGRyZXNzIG9mIHRoZSBhY2NvdW50IHRvIGdldCB0aGUgc3RvcmFnZSBmb3JcbiAgICAgKiBAcGFyYW0ga2V5IC0gS2V5IGluIHRoZSBhY2NvdW50J3Mgc3RvcmFnZSB0byBnZXQgdGhlIHZhbHVlIGZvci4gTXVzdCBiZSAzMiBieXRlcyBsb25nLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPEJ1ZmZlcj59IC0gVGhlIHN0b3JhZ2UgdmFsdWUgZm9yIHRoZSBhY2NvdW50XG4gICAgICogY29ycmVzcG9uZGluZyB0byB0aGUgcHJvdmlkZWQgYWRkcmVzcyBhdCB0aGUgcHJvdmlkZWQga2V5LlxuICAgICAqIElmIHRoaXMgZG9lcyBub3QgZXhpc3QgYW4gZW1wdHkgYEJ1ZmZlcmAgaXMgcmV0dXJuZWQuXG4gICAgICovXG4gICAgYXN5bmMgZ2V0Q29udHJhY3RTdG9yYWdlKGFkZHJlc3M6IEFkZHJlc3MsIGtleTogQnVmZmVyKTogUHJvbWlzZTxCdWZmZXI+IHtcbiAgICAgICAgLy8gQ2hlY2sgMXN0IGxvYWQuXG4gICAgICAgIGNvbnN0IGlkID0gYCR7YWRkcmVzcy50b1N0cmluZygpfS0ke2tleS50b1N0cmluZygnaGV4Jyl9YFxuICAgICAgICBpZiAodGhpcy53YXJtM1tpZF0pIHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLl9zdGF0ZU1hbmFnZXIuZ2V0Q29udHJhY3RTdG9yYWdlKGFkZHJlc3MsIGtleSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLndhcm0zW2lkXSA9IHRydWVcblxuICAgICAgICAvLyBMb29rdXAgZnJvbSBSUEMuXG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuX2dldFByb29mKHsgYWRkcmVzczogYWRkcmVzcy50b1N0cmluZygpLCBzdG9yYWdlS2V5czogWycweCcgKyBrZXkudG9TdHJpbmcoJ2hleCcpXSB9KVxuICAgICAgICBjb25zdCB2YWx1ZSA9IEJ1ZmZlci5mcm9tKHJlcy5zbGljZSgyKSwgJ2hleCcpXG5cbiAgICAgICAgLy8gY29uc3QgZGVjb2RlZCA9IEJ1ZmZlci5mcm9tKFJMUC5kZWNvZGUoVWludDhBcnJheS5mcm9tKHZhbHVlID8/IFtdKSkgYXMgVWludDhBcnJheSlcbiAgICAgICAgdGhpcy5fc3RhdGVNYW5hZ2VyLnB1dENvbnRyYWN0U3RvcmFnZShhZGRyZXNzLCBrZXksIHZhbHVlKVxuICAgICAgICByZXR1cm4gdmFsdWVcbiAgICB9XG5cbiAgICAvLyBcbiAgICAvLyBFRUkuXG4gICAgLy8gXG5cbiAgICAvLyBOb25lIG9mIHRoZXNlIGFyZSBhY3R1YWxseSB1c2VkIEFGQUlDUy5cbiAgICAvLyBXaGljaCBpcyB3aHkgdGhleSB3ZXJlbid0IGZpeGVkIHRvIHVzZSB0aGUgYHRoaXMuX2dldFByb29mYCBBUEkuXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGJhbGFuY2Ugb2YgdGhlIGdpdmVuIGFjY291bnQuXG4gICAgICogQHBhcmFtIGFkZHJlc3MgLSBBZGRyZXNzIG9mIGFjY291bnRcbiAgICAgKi9cbiAgICBhc3luYyBnZXRFeHRlcm5hbEJhbGFuY2UoYWRkcmVzczogQWRkcmVzcyk6IFByb21pc2U8YmlnaW50PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdnZXRFeHRlcm5hbEJhbGFuY2UnLCBhZGRyZXNzLnRvU3RyaW5nKCkpXG4gICAgICAgIC8vIGNvbnN0IGFjY291bnQgPSBhd2FpdCB0aGlzLmdldEFjY291bnQoYWRkcmVzcylcbiAgICAgICAgLy8gcmV0dXJuIGFjY291bnQuYmFsYW5jZVxuICAgICAgICBjb25zdCBiYWxhbmNlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIuZ2V0QmFsYW5jZShhZGRyZXNzLnRvU3RyaW5nKCkpXG4gICAgICAgIHJldHVybiBCaWdJbnQoYmFsYW5jZS50b1N0cmluZygpKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBzaXplIG9mIGFuIGFjY291bnTigJlzIGNvZGUuXG4gICAgICogQHBhcmFtIGFkZHJlc3MgLSBBZGRyZXNzIG9mIGFjY291bnRcbiAgICAgKi9cbiAgICBhc3luYyBnZXRFeHRlcm5hbENvZGVTaXplKGFkZHJlc3M6IEFkZHJlc3MpOiBQcm9taXNlPGJpZ2ludD4ge1xuICAgICAgICBjb25zb2xlLmxvZygnZ2V0RXh0ZXJuYWxDb2RlU2l6ZScsIGFkZHJlc3MudG9TdHJpbmcoKSlcbiAgICAgICAgLy8gY29uc3QgY29kZSA9IGF3YWl0IHRoaXMuZ2V0Q29udHJhY3RDb2RlKGFkZHJlc3MpXG4gICAgICAgIC8vIHJldHVybiBCaWdJbnQoY29kZS5sZW5ndGgpXG4gICAgICAgIGNvbnN0IGNvZGUgPSBhd2FpdCB0aGlzLmdldEV4dGVybmFsQ29kZShhZGRyZXNzKVxuICAgICAgICByZXR1cm4gQmlnSW50KGNvZGUubGVuZ3RoKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgY29kZSBvZiBhbiBhY2NvdW50LlxuICAgICAqIEBwYXJhbSBhZGRyZXNzIC0gQWRkcmVzcyBvZiBhY2NvdW50XG4gICAgICovXG4gICAgYXN5bmMgZ2V0RXh0ZXJuYWxDb2RlKGFkZHJlc3M6IEFkZHJlc3MpOiBQcm9taXNlPEJ1ZmZlcj4ge1xuICAgICAgICBjb25zb2xlLmxvZygnZ2V0RXh0ZXJuYWxDb2RlJywgYWRkcmVzcy50b1N0cmluZygpKVxuICAgICAgICBjb25zdCBjb2RlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIuc2VuZCgnZXRoX2dldENvZGUnLCBbXG4gICAgICAgICAgICBhZGRyZXNzLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAnbGF0ZXN0J1xuICAgICAgICBdKVxuICAgICAgICBjb25zb2xlLmxvZyhjb2RlKVxuICAgICAgICByZXR1cm4gQnVmZmVyLmZyb20oY29kZS5zbGljZSgyKSwgJ2hleCcpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBHZXRzIHRoZSBoYXNoIG9mIG9uZSBvZiB0aGUgMjU2IG1vc3QgcmVjZW50IGNvbXBsZXRlIGJsb2Nrcy5cbiAgICAgKiBAcGFyYW0gbnVtIC0gTnVtYmVyIG9mIGJsb2NrXG4gICAgICovXG4gICAgYXN5bmMgZ2V0QmxvY2tIYXNoKG51bTogYmlnaW50KTogUHJvbWlzZTxiaWdpbnQ+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIuZ2V0QmxvY2sobnVtLnRvU3RyaW5nKCkpXG4gICAgICAgIHJldHVybiBCaWdJbnQocmVzLmhhc2gpXG4gICAgfVxuXG4gICAgLy8gLyoqXG4gICAgLy8gICogU3RvcmFnZSAyNTYtYml0IHZhbHVlIGludG8gc3RvcmFnZSBvZiBhbiBhZGRyZXNzXG4gICAgLy8gICogQHBhcmFtIGFkZHJlc3MgQWRkcmVzcyB0byBzdG9yZSBpbnRvXG4gICAgLy8gICogQHBhcmFtIGtleSBTdG9yYWdlIGtleVxuICAgIC8vICAqIEBwYXJhbSB2YWx1ZSBTdG9yYWdlIHZhbHVlXG4gICAgLy8gICovXG4gICAgLy8gYXN5bmMgc3RvcmFnZVN0b3JlKGFkZHJlc3M6IEFkZHJlc3MsIGtleTogQnVmZmVyLCB2YWx1ZTogQnVmZmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gICAgIGF3YWl0IHRoaXMucHV0Q29udHJhY3RTdG9yYWdlKGFkZHJlc3MsIGtleSwgdmFsdWUpXG4gICAgLy8gfVxuXG4gICAgLyoqXG4gICAgICogTG9hZHMgYSAyNTYtYml0IHZhbHVlIHRvIG1lbW9yeSBmcm9tIHBlcnNpc3RlbnQgc3RvcmFnZS5cbiAgICAgKiBAcGFyYW0gYWRkcmVzcyBBZGRyZXNzIHRvIGdldCBzdG9yYWdlIGtleSB2YWx1ZSBmcm9tXG4gICAgICogQHBhcmFtIGtleSBTdG9yYWdlIGtleVxuICAgICAqIEBwYXJhbSBvcmlnaW5hbCBJZiB0cnVlLCByZXR1cm4gdGhlIG9yaWdpbmFsIHN0b3JhZ2UgdmFsdWUgKGRlZmF1bHQ6IGZhbHNlKVxuICAgICAqL1xuICAgIGFzeW5jIHN0b3JhZ2VMb2FkKGFkZHJlc3M6IEFkZHJlc3MsIGtleTogQnVmZmVyLCBvcmlnaW5hbCA9IGZhbHNlKTogUHJvbWlzZTxCdWZmZXI+IHtcbiAgICAgICAgLy8gVE9ETzogMXN0IGxvYWQuIFRob3VnaCB0aGlzIHByb2JhYmx5IGRvZXNuJ3QgbWF0dGVyLlxuICAgICAgICBjb25zdCBwcm9vZiA9IGF3YWl0IHRoaXMuX2dldFByb29mKHsgYWRkcmVzczogYWRkcmVzcy50b1N0cmluZygpLCBzdG9yYWdlS2V5czogWycweCcgKyBrZXkudG9TdHJpbmcoJ2hleCcpXSB9KVxuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb29mLnN0b3JhZ2VQcm9vZlswXS52YWx1ZVxuICAgICAgICByZXR1cm4gQnVmZmVyLmZyb20odmFsdWUuc2xpY2UoMiksICdoZXgnKVxuICAgICAgICAvLyBpZiAob3JpZ2luYWwpIHtcbiAgICAgICAgLy8gICAgIHJldHVybiB0aGlzLmdldE9yaWdpbmFsQ29udHJhY3RTdG9yYWdlKGFkZHJlc3MsIGtleSlcbiAgICAgICAgLy8gfSBlbHNlIHtcbiAgICAgICAgLy8gICAgIC8vIHJldHVybiB0aGlzLmdldENvbnRyYWN0U3RvcmFnZShhZGRyZXNzLCBrZXkpXG4gICAgICAgIC8vICAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5zZW5kKCdldGhfZ2V0U3RvcmFnZUF0JywgW1xuICAgICAgICAvLyAgICAgICAgIGFkZHJlc3MudG9TdHJpbmcoKSxcbiAgICAgICAgLy8gICAgICAgICAnMHgnICsga2V5LnRvU3RyaW5nKCdoZXgnKSxcbiAgICAgICAgLy8gICAgICAgICAnbGF0ZXN0J1xuICAgICAgICAvLyAgICAgXSlcbiAgICAgICAgLy8gICAgIHJldHVybiBCdWZmZXIuZnJvbShyZXMuc2xpY2UoMiksICdoZXgnKVxuICAgICAgICAvLyB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVZNMiBleHRlbmRzIEVWTSB7XG4gICAgY29uc3RydWN0b3Iob3B0czogRVZNT3B0cykge1xuICAgICAgICBzdXBlcihvcHRzKVxuICAgIH1cbn0iXX0=