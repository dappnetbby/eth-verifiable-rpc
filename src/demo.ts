import * as ethers from 'ethers'
import { Blockchain } from '@ethereumjs/blockchain'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { EEI } from '@ethereumjs/vm'
import { EVM } from '@ethereumjs/evm'
import { EVMOpts } from '@ethereumjs/evm/src/evm'
import { DefaultStateManager } from '@ethereumjs/statemanager'
import type { StateManager } from '@ethereumjs/statemanager'
import { Address } from '@ethereumjs/util'
import { Account } from '@ethereumjs/util'
import { EVM2, VerifiableEthExecEnv } from './evm'



async function main() {
    const provider = new ethers.providers.InfuraProvider()


    const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })
    const stateManager = new DefaultStateManager()
    const blockchain = await Blockchain.create()
    
    // CC: MERGEWAP CODEBASE
    // Fetch latest state root.
    // We need to use eth_getBlockByNumber to get the rawBlock.stateRoot.
    // See: https://github.com/ethers-io/ethers.js/issues/667
    // const rawBlock = await getLatestBlockWithNConfirmations(chainConfig.provider, chainConfig.confirmations)
    const latestBlock = await provider.getBlock("latest");
    const rawBlock = await provider.send("eth_getBlockByNumber", [
        ethers.utils.hexValue(latestBlock.number),
        true,
    ]);

    const eei = new VerifiableEthExecEnv(stateManager, common, blockchain, rawBlock.stateRoot, ethers.utils.hexValue(latestBlock.number), provider)

    const evm = new EVM2({
        common,
        eei,
    })

    // Construct tornadocash ENS lookup.
    //
    //
    // (base) ➜  verifiable-rpc git:(master) ✗ cast abi-encode "contenthash(bytes32 node)(bytes memory)" $(cast --from-ascii "tornadocash.eth")
    // 0x746f726e61646f636173682e6574680000000000000000000000000000000000
    const encodeCall = (address: string, sig: string, params: any[]) => {
        const iface = new ethers.utils.Interface([sig])
        const fnName = sig.split('(')[0].replace('function ', '')
        const calldata = iface.encodeFunctionData(
            fnName, 
            params
        )
        const msg = {
            from: ethers.constants.AddressZero,
            to: address,
            data: calldata,
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

    // const iface = new ethers.utils.Interface([
    //     "function addr(bytes32 node) public view returns (address)",
    //     "function contenthash(bytes32 node) external view returns (bytes memory)"
    // ])
    // const CONTRACT_ADDRESS = '0xd3ddccdd3b25a8a7423b5bee360a42146eb4baf3'
    // const calldata = iface.encodeFunctionData("contenthash", ["0xe6ae31d630cc7a8279c0f1c7cbe6e7064814c47d1785fa2703d9ae511ee2be0c"])

    // Get vitalik.eth's DAI balance.
    const msg = encodeCall(
        "0x6b175474e89094c44da98b954eedeac495271d0f",
        "function balanceOf(address) public view returns (uint256)",
        ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]
    )
    
    // Lookup tornadocash.eth
    // const msg = encodeCall(
    //     "0xd3ddccdd3b25a8a7423b5bee360a42146eb4baf3", 
    //     "function contenthash(bytes32 node) external view returns (bytes memory)", 
    //     ["0xe6ae31d630cc7a8279c0f1c7cbe6e7064814c47d1785fa2703d9ae511ee2be0c"]
    // )
    
    

    // const solc = require('solc');

    // const input = {
    //     language: 'Solidity',
    //     sources: {
    //         'test.sol': {
    //             content: 'contract C { function f() public { } }'
    //         }
    //     },
    //     settings: {
    //         outputSelection: {
    //             '*': {
    //                 '*': ['*']
    //             }
    //         }
    //     }
    // };

    // const output = JSON.parse(solc.compile(JSON.stringify(input)));



    // const calldata = iface.encodeFunctionData("contenthash", [ethers.utils.formatBytes32String("vitalik.eth")])

    

    // const iface = new ethers.utils.Interface([
    //     "function getCount(uint256) public view returns (uint256)"
    // ])
    // const CONTRACT_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3'
    // // const calldata = iface.encodeFunctionData("contenthash", [ethers.utils.formatBytes32String("vitalik.eth")])
    // const calldata = iface.encodeFunctionData("getCount", ["123"])

    // const msg = {
    //     from: ethers.constants.AddressZero,
    //     to: CONTRACT_ADDRESS,
    //     data: calldata,
    // }
    

    // console.log(msg)

    // evm.events.on('step', async function (data) {
    //     // data.gasLeft = BigInt(0xffffffffffffff)
    //     // Note that data.stack is not immutable, i.e. it is a reference to the vm's internal stack object
    //     // console.log(`Opcode: ${data.opcode.name}\tStack: ${data.stack}`)

    //     console.log(
    //         (await stateManager.getContractCode(
    //             Address.fromString('0x5fbdb2315678afecb367f032d93f642f64180aa3'))
    //         ).toString('hex')
    //     )
    // })


    // console.log(msgCoded)
    
    try {
        const { execResult: res } = await evm.runCall(msg)
        console.log(res.exceptionError)
        console.log(`Returned: ${res.returnValue.toString('hex')}`)
        console.log(`gasUsed: ${res.executionGasUsed.toString()}`)

    } catch(err) {
        console.log(err)
    }
    
}

main()