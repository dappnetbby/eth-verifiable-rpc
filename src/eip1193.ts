"use strict";




import { Blockchain } from '@ethereumjs/blockchain'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { EEI } from '@ethereumjs/vm'
import { EVM } from '@ethereumjs/evm'
import { EVMOpts } from '@ethereumjs/evm/src/evm'
import { DefaultStateManager } from '@ethereumjs/statemanager'
import type { StateManager } from '@ethereumjs/statemanager'
import { Address } from '@ethereumjs/util'
import { Account } from '@ethereumjs/util'
import { EVM2, VerifiableEthExecEnv } from "./evm";

import EventEmitter from "events";
import * as ethers from 'ethers'

const version = 'idk'
const logger = new ethers.utils.Logger(version);


import { ExternalProvider } from '@ethersproject/providers/src.ts/web3-provider'


const encodeCall = (to: string, data: string) => {
    const msg = {
        from: ethers.constants.AddressZero,
        to,
        data,
    }

    // Encode for evm lib.
    const msgCoded = {
        to: Address.fromString(msg.to),
        caller: Address.fromString(msg.from),
        data: Buffer.from(msg.data.slice(2), 'hex'),

        // Gas.
        gasLimit: ethers.constants.MaxUint256.toBigInt(),
        gasRefund: ethers.constants.MaxUint256.toBigInt(),
        gasPrice: BigInt(0x1),
        skipBalance: true,
    }

    return msgCoded
}


// Based off of the original ethers.js implementation.
// import { Eip1193Bridge } from "@ethersproject/experimental";
export class Eip1193Bridge extends EventEmitter implements ExternalProvider {
    readonly signer: ethers.Signer;
    readonly provider: ethers.providers.Provider;
    
    evm: EVM2

    constructor(signer: ethers.Signer, provider?: ethers.providers.Provider) {
        super();
        ethers.utils.defineReadOnly(this, "signer", signer);
        ethers.utils.defineReadOnly(this, "provider", provider || null);
    }

    static async create(provider: ethers.providers.JsonRpcProvider): Promise<Eip1193Bridge> {
        const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })
        const stateManager = new DefaultStateManager()
        const blockchain = await Blockchain.create()
        const latestBlock = await provider.getBlock("latest");
        const rawBlock = await provider.send("eth_getBlockByNumber", [
            ethers.utils.hexValue(latestBlock.number),
            true,
        ]);
        const eei = new VerifiableEthExecEnv(
            stateManager,
            common,
            blockchain,
            rawBlock.stateRoot,
            ethers.utils.hexValue(latestBlock.number),
            provider
        )

        const evm = new EVM2({
            common,
            eei,
        })

        let bridge = new this(null, provider);
        bridge.evm = evm

        return bridge
    }

    request(request: { method: string, params?: Array<any> }): Promise<any> {
        return this._send(request.method, request.params || []);
    }

    // sendAsync?: (request: { method: string, params?: Array<any> }, callback: (error: any, response: any) => void) => void
    // async send(request: { method: string, params?: Array<any> }, callback: (error: any, response: any) => void) {

    // }

    async _send(method: string, params?: Array<any>): Promise<any> {
        function throwUnsupported(message: string): never {
            return logger.throwError(message, ethers.utils.Logger.errors.UNSUPPORTED_OPERATION, {
                method: method,
                params: params
            });
        }

        let coerce = (value: any) => value;

        switch (method) {
            case "eth_requestAccounts":
                throwUnsupported("verifiable-rpc is read-only")
                return []

            case "personal_sign":
                throwUnsupported("verifiable-rpc is read-only")

            // Unmodified from ethers.js.
            case "eth_gasPrice": {
                throwUnsupported("verifiable-rpc is read-only")
                const result = await this.provider.getGasPrice();
                return result.toHexString();
            }
            case "eth_accounts": {
                throwUnsupported("verifiable-rpc is read-only")
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
                throwUnsupported("verifiable-rpc is read-only")
            }


            case "eth_call": {
                // TODO.
                const req = ethers.providers.JsonRpcProvider.hexlifyTransaction(params[0]);
                const [msg, blockTag] = [req, params[1]]
                console.log(msg, blockTag)

                const $call = encodeCall(msg.to as string, msg.data as string)

                try {
                    const { execResult: res } = await this.evm.runCall($call)
                    // console.log(res.exceptionError)
                    // console.log(`Returned: ${res.returnValue.toString('hex')}`)
                    // console.log(`gasUsed: ${res.executionGasUsed.toString()}`)
                    return '0x' + res.returnValue.toString('hex')
                } catch (err) {
                    throw err
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
                } else {
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
                throwUnsupported("verifiable-rpc is read-only")
            }

            case "eth_sendTransaction": {
                throwUnsupported("verifiable-rpc is read-only")
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
        if ((<any>(this.provider)).send) {
            const result = await (<any>(this.provider)).send(method, params);
            return coerce(result);
        }

        return throwUnsupported(`unsupported method: ${method}`);
    }

}
