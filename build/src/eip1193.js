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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Eip1193Bridge = void 0;
const blockchain_1 = require("@ethereumjs/blockchain");
const common_1 = require("@ethereumjs/common");
const statemanager_1 = require("@ethereumjs/statemanager");
const util_1 = require("@ethereumjs/util");
const evm_1 = require("./evm");
const events_1 = __importDefault(require("events"));
const ethers = __importStar(require("ethers"));
const version = 'idk';
const logger = new ethers.utils.Logger(version);
const encodeCall = (to, data) => {
    const msg = {
        from: ethers.constants.AddressZero,
        to,
        data,
    };
    // Encode for evm lib.
    const msgCoded = {
        to: util_1.Address.fromString(msg.to),
        caller: util_1.Address.fromString(msg.from),
        data: Buffer.from(msg.data.slice(2), 'hex'),
        // Gas.
        gasLimit: ethers.constants.MaxUint256.toBigInt(),
        gasRefund: ethers.constants.MaxUint256.toBigInt(),
        gasPrice: BigInt(0x1),
        skipBalance: true,
    };
    return msgCoded;
};
// Based off of the original ethers.js implementation.
// import { Eip1193Bridge } from "@ethersproject/experimental";
class Eip1193Bridge extends events_1.default {
    constructor(signer, provider) {
        super();
        ethers.utils.defineReadOnly(this, "signer", signer);
        ethers.utils.defineReadOnly(this, "provider", provider || null);
    }
    static async create(provider) {
        const common = new common_1.Common({ chain: common_1.Chain.Mainnet, hardfork: common_1.Hardfork.London });
        const stateManager = new statemanager_1.DefaultStateManager();
        const blockchain = await blockchain_1.Blockchain.create();
        const latestBlock = await provider.getBlock("latest");
        const rawBlock = await provider.send("eth_getBlockByNumber", [
            ethers.utils.hexValue(latestBlock.number),
            true,
        ]);
        const eei = new evm_1.VerifiableEthExecEnv(stateManager, common, blockchain, rawBlock.stateRoot, ethers.utils.hexValue(latestBlock.number), provider);
        const evm = new evm_1.EVM2({
            common,
            eei,
        });
        let bridge = new this(null, provider);
        bridge.evm = evm;
        return bridge;
    }
    request(request) {
        return this._send(request.method, request.params || []);
    }
    // sendAsync?: (request: { method: string, params?: Array<any> }, callback: (error: any, response: any) => void) => void
    // async send(request: { method: string, params?: Array<any> }, callback: (error: any, response: any) => void) {
    // }
    async _send(method, params) {
        function throwUnsupported(message) {
            return logger.throwError(message, ethers.utils.Logger.errors.UNSUPPORTED_OPERATION, {
                method: method,
                params: params
            });
        }
        let coerce = (value) => value;
        switch (method) {
            case "eth_requestAccounts":
                throwUnsupported("verifiable-rpc is read-only");
                return [];
            case "personal_sign":
                throwUnsupported("verifiable-rpc is read-only");
            // Unmodified from ethers.js.
            case "eth_gasPrice": {
                throwUnsupported("verifiable-rpc is read-only");
                const result = await this.provider.getGasPrice();
                return result.toHexString();
            }
            case "eth_accounts": {
                throwUnsupported("verifiable-rpc is read-only");
            }
            case "eth_blockNumber": {
                return await this.provider.getBlockNumber();
            }
            case "eth_chainId": {
                const result = await this.provider.getNetwork();
                return ethers.utils.hexValue(result.chainId);
            }
            case "eth_getBalance": {
                const result = await this.provider.getBalance(params[0], params[1]);
                return result.toHexString();
            }
            case "eth_getStorageAt": {
                return this.provider.getStorageAt(params[0], params[1], params[2]);
            }
            case "eth_getTransactionCount": {
                const result = await this.provider.getTransactionCount(params[0], params[1]);
                return ethers.utils.hexValue(result);
            }
            case "eth_getBlockTransactionCountByHash":
            case "eth_getBlockTransactionCountByNumber": {
                const result = await this.provider.getBlock(params[0]);
                return ethers.utils.hexValue(result.transactions.length);
            }
            case "eth_getCode": {
                const result = await this.provider.getCode(params[0], params[1]);
                return result;
            }
            case "eth_sendRawTransaction": {
                throwUnsupported("verifiable-rpc is read-only");
            }
            case "eth_call": {
                // TODO.
                const req = ethers.providers.JsonRpcProvider.hexlifyTransaction(params[0]);
                const [msg, blockTag] = [req, params[1]];
                console.log(msg, blockTag);
                const $call = encodeCall(msg.to, msg.data);
                try {
                    const { execResult: res } = await this.evm.runCall($call);
                    // console.log(res.exceptionError)
                    // console.log(`Returned: ${res.returnValue.toString('hex')}`)
                    // console.log(`gasUsed: ${res.executionGasUsed.toString()}`)
                    return '0x' + res.returnValue.toString('hex');
                }
                catch (err) {
                    throw err;
                }
                // const res = await this.provider.call(req, params[1]);
                // console.log('res')
                // console.log(res)
            }
            case "estimateGas": {
                if (params[1] && params[1] !== "latest") {
                    throwUnsupported("estimateGas does not support blockTag");
                }
                const req = ethers.providers.JsonRpcProvider.hexlifyTransaction(params[0]);
                const result = await this.provider.estimateGas(req);
                return result.toHexString();
            }
            // @TODO: Transform? No uncles?
            case "eth_getBlockByHash":
            case "eth_getBlockByNumber": {
                if (params[1]) {
                    return await this.provider.getBlockWithTransactions(params[0]);
                }
                else {
                    return await this.provider.getBlock(params[0]);
                }
            }
            case "eth_getTransactionByHash": {
                return await this.provider.getTransaction(params[0]);
            }
            case "eth_getTransactionReceipt": {
                return await this.provider.getTransactionReceipt(params[0]);
            }
            case "eth_sign": {
                throwUnsupported("verifiable-rpc is read-only");
            }
            case "eth_sendTransaction": {
                throwUnsupported("verifiable-rpc is read-only");
            }
            case "eth_getUncleCountByBlockHash":
            case "eth_getUncleCountByBlockNumber":
                {
                    coerce = ethers.utils.hexValue;
                    break;
                }
            case "eth_getTransactionByBlockHashAndIndex":
            case "eth_getTransactionByBlockNumberAndIndex":
            case "eth_getUncleByBlockHashAndIndex":
            case "eth_getUncleByBlockNumberAndIndex":
            case "eth_newFilter":
            case "eth_newBlockFilter":
            case "eth_newPendingTransactionFilter":
            case "eth_uninstallFilter":
            case "eth_getFilterChanges":
            case "eth_getFilterLogs":
            case "eth_getLogs":
                break;
        }
        // If our provider supports send, maybe it can do a better job?
        if ((this.provider).send) {
            const result = await (this.provider).send(method, params);
            return coerce(result);
        }
        return throwUnsupported(`unsupported method: ${method}`);
    }
}
exports.Eip1193Bridge = Eip1193Bridge;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWlwMTE5My5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9laXAxMTkzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFLYix1REFBbUQ7QUFDbkQsK0NBQTREO0FBSTVELDJEQUE4RDtBQUU5RCwyQ0FBMEM7QUFFMUMsK0JBQW1EO0FBRW5ELG9EQUFrQztBQUNsQywrQ0FBZ0M7QUFFaEMsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFBO0FBQ3JCLE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7QUFNaEQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxFQUFVLEVBQUUsSUFBWSxFQUFFLEVBQUU7SUFDNUMsTUFBTSxHQUFHLEdBQUc7UUFDUixJQUFJLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXO1FBQ2xDLEVBQUU7UUFDRixJQUFJO0tBQ1AsQ0FBQTtJQUVELHNCQUFzQjtJQUN0QixNQUFNLFFBQVEsR0FBRztRQUNiLEVBQUUsRUFBRSxjQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDOUIsTUFBTSxFQUFFLGNBQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNwQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUM7UUFFM0MsT0FBTztRQUNQLFFBQVEsRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUU7UUFDaEQsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRTtRQUNqRCxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQztRQUNyQixXQUFXLEVBQUUsSUFBSTtL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UUFFRCxPQUFPLGdCQUFnQixDQUFDLHVCQUF1QixNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzdELENBQUM7Q0FFSjtBQXBNRCxzQ0FvTUMiLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcblxuXG5cblxuaW1wb3J0IHsgQmxvY2tjaGFpbiB9IGZyb20gJ0BldGhlcmV1bWpzL2Jsb2NrY2hhaW4nXG5pbXBvcnQgeyBDaGFpbiwgQ29tbW9uLCBIYXJkZm9yayB9IGZyb20gJ0BldGhlcmV1bWpzL2NvbW1vbidcbmltcG9ydCB7IEVFSSB9IGZyb20gJ0BldGhlcmV1bWpzL3ZtJ1xuaW1wb3J0IHsgRVZNIH0gZnJvbSAnQGV0aGVyZXVtanMvZXZtJ1xuaW1wb3J0IHsgRVZNT3B0cyB9IGZyb20gJ0BldGhlcmV1bWpzL2V2bS9zcmMvZXZtJ1xuaW1wb3J0IHsgRGVmYXVsdFN0YXRlTWFuYWdlciB9IGZyb20gJ0BldGhlcmV1bWpzL3N0YXRlbWFuYWdlcidcbmltcG9ydCB0eXBlIHsgU3RhdGVNYW5hZ2VyIH0gZnJvbSAnQGV0aGVyZXVtanMvc3RhdGVtYW5hZ2VyJ1xuaW1wb3J0IHsgQWRkcmVzcyB9IGZyb20gJ0BldGhlcmV1bWpzL3V0aWwnXG5pbXBvcnQgeyBBY2NvdW50IH0gZnJvbSAnQGV0aGVyZXVtanMvdXRpbCdcbmltcG9ydCB7IEVWTTIsIFZlcmlmaWFibGVFdGhFeGVjRW52IH0gZnJvbSBcIi4vZXZtXCI7XG5cbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSBcImV2ZW50c1wiO1xuaW1wb3J0ICogYXMgZXRoZXJzIGZyb20gJ2V0aGVycydcblxuY29uc3QgdmVyc2lvbiA9ICdpZGsnXG5jb25zdCBsb2dnZXIgPSBuZXcgZXRoZXJzLnV0aWxzLkxvZ2dlcih2ZXJzaW9uKTtcblxuXG5pbXBvcnQgeyBFeHRlcm5hbFByb3ZpZGVyIH0gZnJvbSAnQGV0aGVyc3Byb2plY3QvcHJvdmlkZXJzL3NyYy50cy93ZWIzLXByb3ZpZGVyJ1xuXG5cbmNvbnN0IGVuY29kZUNhbGwgPSAodG86IHN0cmluZywgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbXNnID0ge1xuICAgICAgICBmcm9tOiBldGhlcnMuY29uc3RhbnRzLkFkZHJlc3NaZXJvLFxuICAgICAgICB0byxcbiAgICAgICAgZGF0YSxcbiAgICB9XG5cbiAgICAvLyBFbmNvZGUgZm9yIGV2bSBsaWIuXG4gICAgY29uc3QgbXNnQ29kZWQgPSB7XG4gICAgICAgIHRvOiBBZGRyZXNzLmZyb21TdHJpbmcobXNnLnRvKSxcbiAgICAgICAgY2FsbGVyOiBBZGRyZXNzLmZyb21TdHJpbmcobXNnLmZyb20pLFxuICAgICAgICBkYXRhOiBCdWZmZXIuZnJvbShtc2cuZGF0YS5zbGljZSgyKSwgJ2hleCcpLFxuXG4gICAgICAgIC8vIEdhcy5cbiAgICAgICAgZ2FzTGltaXQ6IGV0aGVycy5jb25zdGFudHMuTWF4VWludDI1Ni50b0JpZ0ludCgpLFxuICAgICAgICBnYXNSZWZ1bmQ6IGV0aGVycy5jb25zdGFudHMuTWF4VWludDI1Ni50b0JpZ0ludCgpLFxuICAgICAgICBnYXNQcmljZTogQmlnSW50KDB4MSksXG4gICAgICAgIHNraXBCYWxhbmNlOiB0cnVlLFxuICAgIH1cblxuICAgIHJldHVybiBtc2dDb2RlZFxufVxuXG5cbi8vIEJhc2VkIG9mZiBvZiB0aGUgb3JpZ2luYWwgZXRoZXJzLmpzIGltcGxlbWVudGF0aW9uLlxuLy8gaW1wb3J0IHsgRWlwMTE5M0JyaWRnZSB9IGZyb20gXCJAZXRoZXJzcHJvamVjdC9leHBlcmltZW50YWxcIjtcbmV4cG9ydCBjbGFzcyBFaXAxMTkzQnJpZGdlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIGltcGxlbWVudHMgRXh0ZXJuYWxQcm92aWRlciB7XG4gICAgcmVhZG9ubHkgc2lnbmVyOiBldGhlcnMuU2lnbmVyO1xuICAgIHJlYWRvbmx5IHByb3ZpZGVyOiBldGhlcnMucHJvdmlkZXJzLlByb3ZpZGVyO1xuICAgIFxuICAgIGV2bTogRVZNMlxuXG4gICAgY29uc3RydWN0b3Ioc2lnbmVyOiBldGhlcnMuU2lnbmVyLCBwcm92aWRlcj86IGV0aGVycy5wcm92aWRlcnMuUHJvdmlkZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgZXRoZXJzLnV0aWxzLmRlZmluZVJlYWRPbmx5KHRoaXMsIFwic2lnbmVyXCIsIHNpZ25lcik7XG4gICAgICAgIGV0aGVycy51dGlscy5kZWZpbmVSZWFkT25seSh0aGlzLCBcInByb3ZpZGVyXCIsIHByb3ZpZGVyIHx8IG51bGwpO1xuICAgIH1cblxuICAgIHN0YXRpYyBhc3luYyBjcmVhdGUocHJvdmlkZXI6IGV0aGVycy5wcm92aWRlcnMuSnNvblJwY1Byb3ZpZGVyKTogUHJvbWlzZTxFaXAxMTkzQnJpZGdlPiB7XG4gICAgICAgIGNvbnN0IGNvbW1vbiA9IG5ldyBDb21tb24oeyBjaGFpbjogQ2hhaW4uTWFpbm5ldCwgaGFyZGZvcms6IEhhcmRmb3JrLkxvbmRvbiB9KVxuICAgICAgICBjb25zdCBzdGF0ZU1hbmFnZXIgPSBuZXcgRGVmYXVsdFN0YXRlTWFuYWdlcigpXG4gICAgICAgIGNvbnN0IGJsb2NrY2hhaW4gPSBhd2FpdCBCbG9ja2NoYWluLmNyZWF0ZSgpXG4gICAgICAgIGNvbnN0IGxhdGVzdEJsb2NrID0gYXdhaXQgcHJvdmlkZXIuZ2V0QmxvY2soXCJsYXRlc3RcIik7XG4gICAgICAgIGNvbnN0IHJhd0Jsb2NrID0gYXdhaXQgcHJvdmlkZXIuc2VuZChcImV0aF9nZXRCbG9ja0J5TnVtYmVyXCIsIFtcbiAgICAgICAgICAgIGV0aGVycy51dGlscy5oZXhWYWx1ZShsYXRlc3RCbG9jay5udW1iZXIpLFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgXSk7XG4gICAgICAgIGNvbnN0IGVlaSA9IG5ldyBWZXJpZmlhYmxlRXRoRXhlY0VudihcbiAgICAgICAgICAgIHN0YXRlTWFuYWdlcixcbiAgICAgICAgICAgIGNvbW1vbixcbiAgICAgICAgICAgIGJsb2NrY2hhaW4sXG4gICAgICAgICAgICByYXdCbG9jay5zdGF0ZVJvb3QsXG4gICAgICAgICAgICBldGhlcnMudXRpbHMuaGV4VmFsdWUobGF0ZXN0QmxvY2subnVtYmVyKSxcbiAgICAgICAgICAgIHByb3ZpZGVyXG4gICAgICAgIClcblxuICAgICAgICBjb25zdCBldm0gPSBuZXcgRVZNMih7XG4gICAgICAgICAgICBjb21tb24sXG4gICAgICAgICAgICBlZWksXG4gICAgICAgIH0pXG5cbiAgICAgICAgbGV0IGJyaWRnZSA9IG5ldyB0aGlzKG51bGwsIHByb3ZpZGVyKTtcbiAgICAgICAgYnJpZGdlLmV2bSA9IGV2bVxuXG4gICAgICAgIHJldHVybiBicmlkZ2VcbiAgICB9XG5cbiAgICByZXF1ZXN0KHJlcXVlc3Q6IHsgbWV0aG9kOiBzdHJpbmcsIHBhcmFtcz86IEFycmF5PGFueT4gfSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zZW5kKHJlcXVlc3QubWV0aG9kLCByZXF1ZXN0LnBhcmFtcyB8fCBbXSk7XG4gICAgfVxuXG4gICAgLy8gc2VuZEFzeW5jPzogKHJlcXVlc3Q6IHsgbWV0aG9kOiBzdHJpbmcsIHBhcmFtcz86IEFycmF5PGFueT4gfSwgY2FsbGJhY2s6IChlcnJvcjogYW55LCByZXNwb25zZTogYW55KSA9PiB2b2lkKSA9PiB2b2lkXG4gICAgLy8gYXN5bmMgc2VuZChyZXF1ZXN0OiB7IG1ldGhvZDogc3RyaW5nLCBwYXJhbXM/OiBBcnJheTxhbnk+IH0sIGNhbGxiYWNrOiAoZXJyb3I6IGFueSwgcmVzcG9uc2U6IGFueSkgPT4gdm9pZCkge1xuXG4gICAgLy8gfVxuXG4gICAgYXN5bmMgX3NlbmQobWV0aG9kOiBzdHJpbmcsIHBhcmFtcz86IEFycmF5PGFueT4pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBmdW5jdGlvbiB0aHJvd1Vuc3VwcG9ydGVkKG1lc3NhZ2U6IHN0cmluZyk6IG5ldmVyIHtcbiAgICAgICAgICAgIHJldHVybiBsb2dnZXIudGhyb3dFcnJvcihtZXNzYWdlLCBldGhlcnMudXRpbHMuTG9nZ2VyLmVycm9ycy5VTlNVUFBPUlRFRF9PUEVSQVRJT04sIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHBhcmFtc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY29lcmNlID0gKHZhbHVlOiBhbnkpID0+IHZhbHVlO1xuXG4gICAgICAgIHN3aXRjaCAobWV0aG9kKSB7XG4gICAgICAgICAgICBjYXNlIFwiZXRoX3JlcXVlc3RBY2NvdW50c1wiOlxuICAgICAgICAgICAgICAgIHRocm93VW5zdXBwb3J0ZWQoXCJ2ZXJpZmlhYmxlLXJwYyBpcyByZWFkLW9ubHlcIilcbiAgICAgICAgICAgICAgICByZXR1cm4gW11cblxuICAgICAgICAgICAgY2FzZSBcInBlcnNvbmFsX3NpZ25cIjpcbiAgICAgICAgICAgICAgICB0aHJvd1Vuc3VwcG9ydGVkKFwidmVyaWZpYWJsZS1ycGMgaXMgcmVhZC1vbmx5XCIpXG5cbiAgICAgICAgICAgIC8vIFVubW9kaWZpZWQgZnJvbSBldGhlcnMuanMuXG4gICAgICAgICAgICBjYXNlIFwiZXRoX2dhc1ByaWNlXCI6IHtcbiAgICAgICAgICAgICAgICB0aHJvd1Vuc3VwcG9ydGVkKFwidmVyaWZpYWJsZS1ycGMgaXMgcmVhZC1vbmx5XCIpXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wcm92aWRlci5nZXRHYXNQcmljZSgpO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQudG9IZXhTdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCJldGhfYWNjb3VudHNcIjoge1xuICAgICAgICAgICAgICAgIHRocm93VW5zdXBwb3J0ZWQoXCJ2ZXJpZmlhYmxlLXJwYyBpcyByZWFkLW9ubHlcIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCJldGhfYmxvY2tOdW1iZXJcIjoge1xuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnByb3ZpZGVyLmdldEJsb2NrTnVtYmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiZXRoX2NoYWluSWRcIjoge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucHJvdmlkZXIuZ2V0TmV0d29yaygpO1xuICAgICAgICAgICAgICAgIHJldHVybiBldGhlcnMudXRpbHMuaGV4VmFsdWUocmVzdWx0LmNoYWluSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcImV0aF9nZXRCYWxhbmNlXCI6IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnByb3ZpZGVyLmdldEJhbGFuY2UocGFyYW1zWzBdLCBwYXJhbXNbMV0pO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQudG9IZXhTdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCJldGhfZ2V0U3RvcmFnZUF0XCI6IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wcm92aWRlci5nZXRTdG9yYWdlQXQocGFyYW1zWzBdLCBwYXJhbXNbMV0sIHBhcmFtc1syXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFwiZXRoX2dldFRyYW5zYWN0aW9uQ291bnRcIjoge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucHJvdmlkZXIuZ2V0VHJhbnNhY3Rpb25Db3VudChwYXJhbXNbMF0sIHBhcmFtc1sxXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV0aGVycy51dGlscy5oZXhWYWx1ZShyZXN1bHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcImV0aF9nZXRCbG9ja1RyYW5zYWN0aW9uQ291bnRCeUhhc2hcIjpcbiAgICAgICAgICAgIGNhc2UgXCJldGhfZ2V0QmxvY2tUcmFuc2FjdGlvbkNvdW50QnlOdW1iZXJcIjoge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucHJvdmlkZXIuZ2V0QmxvY2socGFyYW1zWzBdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXRoZXJzLnV0aWxzLmhleFZhbHVlKHJlc3VsdC50cmFuc2FjdGlvbnMubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCJldGhfZ2V0Q29kZVwiOiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wcm92aWRlci5nZXRDb2RlKHBhcmFtc1swXSwgcGFyYW1zWzFdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcImV0aF9zZW5kUmF3VHJhbnNhY3Rpb25cIjoge1xuICAgICAgICAgICAgICAgIHRocm93VW5zdXBwb3J0ZWQoXCJ2ZXJpZmlhYmxlLXJwYyBpcyByZWFkLW9ubHlcIilcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBjYXNlIFwiZXRoX2NhbGxcIjoge1xuICAgICAgICAgICAgICAgIC8vIFRPRE8uXG4gICAgICAgICAgICAgICAgY29uc3QgcmVxID0gZXRoZXJzLnByb3ZpZGVycy5Kc29uUnBjUHJvdmlkZXIuaGV4bGlmeVRyYW5zYWN0aW9uKHBhcmFtc1swXSk7XG4gICAgICAgICAgICAgICAgY29uc3QgW21zZywgYmxvY2tUYWddID0gW3JlcSwgcGFyYW1zWzFdXVxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1zZywgYmxvY2tUYWcpXG5cbiAgICAgICAgICAgICAgICBjb25zdCAkY2FsbCA9IGVuY29kZUNhbGwobXNnLnRvIGFzIHN0cmluZywgbXNnLmRhdGEgYXMgc3RyaW5nKVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBleGVjUmVzdWx0OiByZXMgfSA9IGF3YWl0IHRoaXMuZXZtLnJ1bkNhbGwoJGNhbGwpXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKHJlcy5leGNlcHRpb25FcnJvcilcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYFJldHVybmVkOiAke3Jlcy5yZXR1cm5WYWx1ZS50b1N0cmluZygnaGV4Jyl9YClcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGdhc1VzZWQ6ICR7cmVzLmV4ZWN1dGlvbkdhc1VzZWQudG9TdHJpbmcoKX1gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJzB4JyArIHJlcy5yZXR1cm5WYWx1ZS50b1N0cmluZygnaGV4JylcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMucHJvdmlkZXIuY2FsbChyZXEsIHBhcmFtc1sxXSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ3JlcycpXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2cocmVzKVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIGNhc2UgXCJlc3RpbWF0ZUdhc1wiOiB7XG4gICAgICAgICAgICAgICAgaWYgKHBhcmFtc1sxXSAmJiBwYXJhbXNbMV0gIT09IFwibGF0ZXN0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3dVbnN1cHBvcnRlZChcImVzdGltYXRlR2FzIGRvZXMgbm90IHN1cHBvcnQgYmxvY2tUYWdcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcmVxID0gZXRoZXJzLnByb3ZpZGVycy5Kc29uUnBjUHJvdmlkZXIuaGV4bGlmeVRyYW5zYWN0aW9uKHBhcmFtc1swXSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wcm92aWRlci5lc3RpbWF0ZUdhcyhyZXEpO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQudG9IZXhTdHJpbmcoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQFRPRE86IFRyYW5zZm9ybT8gTm8gdW5jbGVzP1xuICAgICAgICAgICAgY2FzZSBcImV0aF9nZXRCbG9ja0J5SGFzaFwiOlxuICAgICAgICAgICAgY2FzZSBcImV0aF9nZXRCbG9ja0J5TnVtYmVyXCI6IHtcbiAgICAgICAgICAgICAgICBpZiAocGFyYW1zWzFdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnByb3ZpZGVyLmdldEJsb2NrV2l0aFRyYW5zYWN0aW9ucyhwYXJhbXNbMF0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnByb3ZpZGVyLmdldEJsb2NrKHBhcmFtc1swXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBcImV0aF9nZXRUcmFuc2FjdGlvbkJ5SGFzaFwiOiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucHJvdmlkZXIuZ2V0VHJhbnNhY3Rpb24ocGFyYW1zWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgXCJldGhfZ2V0VHJhbnNhY3Rpb25SZWNlaXB0XCI6IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5wcm92aWRlci5nZXRUcmFuc2FjdGlvblJlY2VpcHQocGFyYW1zWzBdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2FzZSBcImV0aF9zaWduXCI6IHtcbiAgICAgICAgICAgICAgICB0aHJvd1Vuc3VwcG9ydGVkKFwidmVyaWZpYWJsZS1ycGMgaXMgcmVhZC1vbmx5XCIpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhc2UgXCJldGhfc2VuZFRyYW5zYWN0aW9uXCI6IHtcbiAgICAgICAgICAgICAgICB0aHJvd1Vuc3VwcG9ydGVkKFwidmVyaWZpYWJsZS1ycGMgaXMgcmVhZC1vbmx5XCIpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhc2UgXCJldGhfZ2V0VW5jbGVDb3VudEJ5QmxvY2tIYXNoXCI6XG4gICAgICAgICAgICBjYXNlIFwiZXRoX2dldFVuY2xlQ291bnRCeUJsb2NrTnVtYmVyXCI6XG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBjb2VyY2UgPSBldGhlcnMudXRpbHMuaGV4VmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2FzZSBcImV0aF9nZXRUcmFuc2FjdGlvbkJ5QmxvY2tIYXNoQW5kSW5kZXhcIjpcbiAgICAgICAgICAgIGNhc2UgXCJldGhfZ2V0VHJhbnNhY3Rpb25CeUJsb2NrTnVtYmVyQW5kSW5kZXhcIjpcbiAgICAgICAgICAgIGNhc2UgXCJldGhfZ2V0VW5jbGVCeUJsb2NrSGFzaEFuZEluZGV4XCI6XG4gICAgICAgICAgICBjYXNlIFwiZXRoX2dldFVuY2xlQnlCbG9ja051bWJlckFuZEluZGV4XCI6XG4gICAgICAgICAgICBjYXNlIFwiZXRoX25ld0ZpbHRlclwiOlxuICAgICAgICAgICAgY2FzZSBcImV0aF9uZXdCbG9ja0ZpbHRlclwiOlxuICAgICAgICAgICAgY2FzZSBcImV0aF9uZXdQZW5kaW5nVHJhbnNhY3Rpb25GaWx0ZXJcIjpcbiAgICAgICAgICAgIGNhc2UgXCJldGhfdW5pbnN0YWxsRmlsdGVyXCI6XG4gICAgICAgICAgICBjYXNlIFwiZXRoX2dldEZpbHRlckNoYW5nZXNcIjpcbiAgICAgICAgICAgIGNhc2UgXCJldGhfZ2V0RmlsdGVyTG9nc1wiOlxuICAgICAgICAgICAgY2FzZSBcImV0aF9nZXRMb2dzXCI6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBvdXIgcHJvdmlkZXIgc3VwcG9ydHMgc2VuZCwgbWF5YmUgaXQgY2FuIGRvIGEgYmV0dGVyIGpvYj9cbiAgICAgICAgaWYgKCg8YW55Pih0aGlzLnByb3ZpZGVyKSkuc2VuZCkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgKDxhbnk+KHRoaXMucHJvdmlkZXIpKS5zZW5kKG1ldGhvZCwgcGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiBjb2VyY2UocmVzdWx0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aHJvd1Vuc3VwcG9ydGVkKGB1bnN1cHBvcnRlZCBtZXRob2Q6ICR7bWV0aG9kfWApO1xuICAgIH1cblxufVxuIl19