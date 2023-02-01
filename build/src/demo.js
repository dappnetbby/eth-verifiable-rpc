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
const ethers = __importStar(require("ethers"));
const blockchain_1 = require("@ethereumjs/blockchain");
const common_1 = require("@ethereumjs/common");
const statemanager_1 = require("@ethereumjs/statemanager");
const util_1 = require("@ethereumjs/util");
const evm_1 = require("./evm");
async function main() {
    const provider = new ethers.providers.InfuraProvider();
    const common = new common_1.Common({ chain: common_1.Chain.Mainnet, hardfork: common_1.Hardfork.London });
    const stateManager = new statemanager_1.DefaultStateManager();
    const blockchain = await blockchain_1.Blockchain.create();
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
    const eei = new evm_1.VerifiableEthExecEnv(stateManager, common, blockchain, rawBlock.stateRoot, ethers.utils.hexValue(latestBlock.number), provider);
    const evm = new evm_1.EVM2({
        common,
        eei,
    });
    // Construct tornadocash ENS lookup.
    //
    //
    // (base) ➜  verifiable-rpc git:(master) ✗ cast abi-encode "contenthash(bytes32 node)(bytes memory)" $(cast --from-ascii "tornadocash.eth")
    // 0x746f726e61646f636173682e6574680000000000000000000000000000000000
    const encodeCall = (address, sig, params) => {
        const iface = new ethers.utils.Interface([sig]);
        const fnName = sig.split('(')[0].replace('function ', '');
        const calldata = iface.encodeFunctionData(fnName, params);
        const msg = {
            from: ethers.constants.AddressZero,
            to: address,
            data: calldata,
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
    // const iface = new ethers.utils.Interface([
    //     "function addr(bytes32 node) public view returns (address)",
    //     "function contenthash(bytes32 node) external view returns (bytes memory)"
    // ])
    // const CONTRACT_ADDRESS = '0xd3ddccdd3b25a8a7423b5bee360a42146eb4baf3'
    // const calldata = iface.encodeFunctionData("contenthash", ["0xe6ae31d630cc7a8279c0f1c7cbe6e7064814c47d1785fa2703d9ae511ee2be0c"])
    // Get vitalik.eth's DAI balance.
    const msg = encodeCall("0x6b175474e89094c44da98b954eedeac495271d0f", "function balanceOf(address) public view returns (uint256)", ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]);
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
        const { execResult: res } = await evm.runCall(msg);
        console.log(res.exceptionError);
        console.log(`Returned: ${res.returnValue.toString('hex')}`);
        console.log(`gasUsed: ${res.executionGasUsed.toString()}`);
    }
    catch (err) {
        console.log(err);
    }
}
main();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVtby5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9kZW1vLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBZ0M7QUFDaEMsdURBQW1EO0FBQ25ELCtDQUE0RDtBQUk1RCwyREFBOEQ7QUFFOUQsMkNBQTBDO0FBRTFDLCtCQUFrRDtBQUlsRCxLQUFLLFVBQVUsSUFBSTtJQUNmLE1BQU0sUUFBUSxHQUFHLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsQ0FBQTtJQUd0RCxNQUFNLE1BQU0sR0FBRyxJQUFJLGVBQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxjQUFLLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxpQkFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUE7SUFDOUUsTUFBTSxZQUFZLEdBQUcsSUFBSSxrQ0FBbUIsRUFBRSxDQUFBO0lBQzlDLE1BQU0sVUFBVSxHQUFHLE1BQU0sdUJBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQTtJQUU1Qyx3QkFBd0I7SUFDeEIsMkJBQTJCO0lBQzNCLHFFQUFxRTtJQUNyRSx5REFBeUQ7SUFDekQsMkdBQTJHO0lBQzNHLE1BQU0sV0FBVyxHQUFHLE1BQU0sUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0RCxNQUFNLFFBQVEsR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUU7UUFDekQsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQztRQUN6QyxJQUFJO0tBQ1AsQ0FBQyxDQUFDO0lBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSwwQkFBb0IsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxR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Q0EsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsR0FBRyxNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDbEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUE7UUFDL0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQTtRQUMzRCxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksR0FBRyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQTtLQUU3RDtJQUFDLE9BQU0sR0FBRyxFQUFFO1FBQ1QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtLQUNuQjtBQUVMLENBQUM7QUFFRCxJQUFJLEVBQUUsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGV0aGVycyBmcm9tICdldGhlcnMnXG5pbXBvcnQgeyBCbG9ja2NoYWluIH0gZnJvbSAnQGV0aGVyZXVtanMvYmxvY2tjaGFpbidcbmltcG9ydCB7IENoYWluLCBDb21tb24sIEhhcmRmb3JrIH0gZnJvbSAnQGV0aGVyZXVtanMvY29tbW9uJ1xuaW1wb3J0IHsgRUVJIH0gZnJvbSAnQGV0aGVyZXVtanMvdm0nXG5pbXBvcnQgeyBFVk0gfSBmcm9tICdAZXRoZXJldW1qcy9ldm0nXG5pbXBvcnQgeyBFVk1PcHRzIH0gZnJvbSAnQGV0aGVyZXVtanMvZXZtL3NyYy9ldm0nXG5pbXBvcnQgeyBEZWZhdWx0U3RhdGVNYW5hZ2VyIH0gZnJvbSAnQGV0aGVyZXVtanMvc3RhdGVtYW5hZ2VyJ1xuaW1wb3J0IHR5cGUgeyBTdGF0ZU1hbmFnZXIgfSBmcm9tICdAZXRoZXJldW1qcy9zdGF0ZW1hbmFnZXInXG5pbXBvcnQgeyBBZGRyZXNzIH0gZnJvbSAnQGV0aGVyZXVtanMvdXRpbCdcbmltcG9ydCB7IEFjY291bnQgfSBmcm9tICdAZXRoZXJldW1qcy91dGlsJ1xuaW1wb3J0IHsgRVZNMiwgVmVyaWZpYWJsZUV0aEV4ZWNFbnYgfSBmcm9tICcuL2V2bSdcblxuXG5cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKSB7XG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgZXRoZXJzLnByb3ZpZGVycy5JbmZ1cmFQcm92aWRlcigpXG5cblxuICAgIGNvbnN0IGNvbW1vbiA9IG5ldyBDb21tb24oeyBjaGFpbjogQ2hhaW4uTWFpbm5ldCwgaGFyZGZvcms6IEhhcmRmb3JrLkxvbmRvbiB9KVxuICAgIGNvbnN0IHN0YXRlTWFuYWdlciA9IG5ldyBEZWZhdWx0U3RhdGVNYW5hZ2VyKClcbiAgICBjb25zdCBibG9ja2NoYWluID0gYXdhaXQgQmxvY2tjaGFpbi5jcmVhdGUoKVxuICAgIFxuICAgIC8vIENDOiBNRVJHRVdBUCBDT0RFQkFTRVxuICAgIC8vIEZldGNoIGxhdGVzdCBzdGF0ZSByb290LlxuICAgIC8vIFdlIG5lZWQgdG8gdXNlIGV0aF9nZXRCbG9ja0J5TnVtYmVyIHRvIGdldCB0aGUgcmF3QmxvY2suc3RhdGVSb290LlxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2V0aGVycy1pby9ldGhlcnMuanMvaXNzdWVzLzY2N1xuICAgIC8vIGNvbnN0IHJhd0Jsb2NrID0gYXdhaXQgZ2V0TGF0ZXN0QmxvY2tXaXRoTkNvbmZpcm1hdGlvbnMoY2hhaW5Db25maWcucHJvdmlkZXIsIGNoYWluQ29uZmlnLmNvbmZpcm1hdGlvbnMpXG4gICAgY29uc3QgbGF0ZXN0QmxvY2sgPSBhd2FpdCBwcm92aWRlci5nZXRCbG9jayhcImxhdGVzdFwiKTtcbiAgICBjb25zdCByYXdCbG9jayA9IGF3YWl0IHByb3ZpZGVyLnNlbmQoXCJldGhfZ2V0QmxvY2tCeU51bWJlclwiLCBbXG4gICAgICAgIGV0aGVycy51dGlscy5oZXhWYWx1ZShsYXRlc3RCbG9jay5udW1iZXIpLFxuICAgICAgICB0cnVlLFxuICAgIF0pO1xuXG4gICAgY29uc3QgZWVpID0gbmV3IFZlcmlmaWFibGVFdGhFeGVjRW52KHN0YXRlTWFuYWdlciwgY29tbW9uLCBibG9ja2NoYWluLCByYXdCbG9jay5zdGF0ZVJvb3QsIGV0aGVycy51dGlscy5oZXhWYWx1ZShsYXRlc3RCbG9jay5udW1iZXIpLCBwcm92aWRlcilcblxuICAgIGNvbnN0IGV2bSA9IG5ldyBFVk0yKHtcbiAgICAgICAgY29tbW9uLFxuICAgICAgICBlZWksXG4gICAgfSlcblxuICAgIC8vIENvbnN0cnVjdCB0b3JuYWRvY2FzaCBFTlMgbG9va3VwLlxuICAgIC8vXG4gICAgLy9cbiAgICAvLyAoYmFzZSkg4p6cICB2ZXJpZmlhYmxlLXJwYyBnaXQ6KG1hc3Rlcikg4pyXIGNhc3QgYWJpLWVuY29kZSBcImNvbnRlbnRoYXNoKGJ5dGVzMzIgbm9kZSkoYnl0ZXMgbWVtb3J5KVwiICQoY2FzdCAtLWZyb20tYXNjaWkgXCJ0b3JuYWRvY2FzaC5ldGhcIilcbiAgICAvLyAweDc0NmY3MjZlNjE2NDZmNjM2MTczNjgyZTY1NzQ2ODAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBcbiAgICBjb25zdCBlbmNvZGVDYWxsID0gKGFkZHJlc3M6IHN0cmluZywgc2lnOiBzdHJpbmcsIHBhcmFtczogYW55W10pID0+IHtcbiAgICAgICAgY29uc3QgaWZhY2UgPSBuZXcgZXRoZXJzLnV0aWxzLkludGVyZmFjZShbc2lnXSlcbiAgICAgICAgY29uc3QgZm5OYW1lID0gc2lnLnNwbGl0KCcoJylbMF0ucmVwbGFjZSgnZnVuY3Rpb24gJywgJycpXG4gICAgICAgIGNvbnN0IGNhbGxkYXRhID0gaWZhY2UuZW5jb2RlRnVuY3Rpb25EYXRhKFxuICAgICAgICAgICAgZm5OYW1lLCBcbiAgICAgICAgICAgIHBhcmFtc1xuICAgICAgICApXG4gICAgICAgIGNvbnN0IG1zZyA9IHtcbiAgICAgICAgICAgIGZyb206IGV0aGVycy5jb25zdGFudHMuQWRkcmVzc1plcm8sXG4gICAgICAgICAgICB0bzogYWRkcmVzcyxcbiAgICAgICAgICAgIGRhdGE6IGNhbGxkYXRhLFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW5jb2RlIGZvciBldm0gbGliLlxuICAgICAgICBjb25zdCBtc2dDb2RlZCA9IHtcbiAgICAgICAgICAgIHRvOiBBZGRyZXNzLmZyb21TdHJpbmcobXNnLnRvKSxcbiAgICAgICAgICAgIGNhbGxlcjogQWRkcmVzcy5mcm9tU3RyaW5nKG1zZy5mcm9tKSxcbiAgICAgICAgICAgIGRhdGE6IEJ1ZmZlci5mcm9tKG1zZy5kYXRhLnNsaWNlKDIpLCAnaGV4JyksXG5cbiAgICAgICAgICAgIC8vIEdhcy5cbiAgICAgICAgICAgIGdhc0xpbWl0OiBldGhlcnMuY29uc3RhbnRzLk1heFVpbnQyNTYudG9CaWdJbnQoKSxcbiAgICAgICAgICAgIGdhc1JlZnVuZDogZXRoZXJzLmNvbnN0YW50cy5NYXhVaW50MjU2LnRvQmlnSW50KCksXG4gICAgICAgICAgICBnYXNQcmljZTogQmlnSW50KDB4MSksXG4gICAgICAgICAgICBza2lwQmFsYW5jZTogdHJ1ZSxcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtc2dDb2RlZFxuICAgIH1cblxuICAgIC8vIGNvbnN0IGlmYWNlID0gbmV3IGV0aGVycy51dGlscy5JbnRlcmZhY2UoW1xuICAgIC8vICAgICBcImZ1bmN0aW9uIGFkZHIoYnl0ZXMzMiBub2RlKSBwdWJsaWMgdmlldyByZXR1cm5zIChhZGRyZXNzKVwiLFxuICAgIC8vICAgICBcImZ1bmN0aW9uIGNvbnRlbnRoYXNoKGJ5dGVzMzIgbm9kZSkgZXh0ZXJuYWwgdmlldyByZXR1cm5zIChieXRlcyBtZW1vcnkpXCJcbiAgICAvLyBdKVxuICAgIC8vIGNvbnN0IENPTlRSQUNUX0FERFJFU1MgPSAnMHhkM2RkY2NkZDNiMjVhOGE3NDIzYjViZWUzNjBhNDIxNDZlYjRiYWYzJ1xuICAgIC8vIGNvbnN0IGNhbGxkYXRhID0gaWZhY2UuZW5jb2RlRnVuY3Rpb25EYXRhKFwiY29udGVudGhhc2hcIiwgW1wiMHhlNmFlMzFkNjMwY2M3YTgyNzljMGYxYzdjYmU2ZTcwNjQ4MTRjNDdkMTc4NWZhMjcwM2Q5YWU1MTFlZTJiZTBjXCJdKVxuXG4gICAgLy8gR2V0IHZpdGFsaWsuZXRoJ3MgREFJIGJhbGFuY2UuXG4gICAgY29uc3QgbXNnID0gZW5jb2RlQ2FsbChcbiAgICAgICAgXCIweDZiMTc1NDc0ZTg5MDk0YzQ0ZGE5OGI5NTRlZWRlYWM0OTUyNzFkMGZcIixcbiAgICAgICAgXCJmdW5jdGlvbiBiYWxhbmNlT2YoYWRkcmVzcykgcHVibGljIHZpZXcgcmV0dXJucyAodWludDI1NilcIixcbiAgICAgICAgW1wiMHhkOGRBNkJGMjY5NjRhRjlEN2VFZDllMDNFNTM0MTVEMzdhQTk2MDQ1XCJdXG4gICAgKVxuICAgIFxuICAgIC8vIExvb2t1cCB0b3JuYWRvY2FzaC5ldGhcbiAgICAvLyBjb25zdCBtc2cgPSBlbmNvZGVDYWxsKFxuICAgIC8vICAgICBcIjB4ZDNkZGNjZGQzYjI1YThhNzQyM2I1YmVlMzYwYTQyMTQ2ZWI0YmFmM1wiLCBcbiAgICAvLyAgICAgXCJmdW5jdGlvbiBjb250ZW50aGFzaChieXRlczMyIG5vZGUpIGV4dGVybmFsIHZpZXcgcmV0dXJucyAoYnl0ZXMgbWVtb3J5KVwiLCBcbiAgICAvLyAgICAgW1wiMHhlNmFlMzFkNjMwY2M3YTgyNzljMGYxYzdjYmU2ZTcwNjQ4MTRjNDdkMTc4NWZhMjcwM2Q5YWU1MTFlZTJiZTBjXCJdXG4gICAgLy8gKVxuICAgIFxuICAgIFxuXG4gICAgLy8gY29uc3Qgc29sYyA9IHJlcXVpcmUoJ3NvbGMnKTtcblxuICAgIC8vIGNvbnN0IGlucHV0ID0ge1xuICAgIC8vICAgICBsYW5ndWFnZTogJ1NvbGlkaXR5JyxcbiAgICAvLyAgICAgc291cmNlczoge1xuICAgIC8vICAgICAgICAgJ3Rlc3Quc29sJzoge1xuICAgIC8vICAgICAgICAgICAgIGNvbnRlbnQ6ICdjb250cmFjdCBDIHsgZnVuY3Rpb24gZigpIHB1YmxpYyB7IH0gfSdcbiAgICAvLyAgICAgICAgIH1cbiAgICAvLyAgICAgfSxcbiAgICAvLyAgICAgc2V0dGluZ3M6IHtcbiAgICAvLyAgICAgICAgIG91dHB1dFNlbGVjdGlvbjoge1xuICAgIC8vICAgICAgICAgICAgICcqJzoge1xuICAgIC8vICAgICAgICAgICAgICAgICAnKic6IFsnKiddXG4gICAgLy8gICAgICAgICAgICAgfVxuICAgIC8vICAgICAgICAgfVxuICAgIC8vICAgICB9XG4gICAgLy8gfTtcblxuICAgIC8vIGNvbnN0IG91dHB1dCA9IEpTT04ucGFyc2Uoc29sYy5jb21waWxlKEpTT04uc3RyaW5naWZ5KGlucHV0KSkpO1xuXG5cblxuICAgIC8vIGNvbnN0IGNhbGxkYXRhID0gaWZhY2UuZW5jb2RlRnVuY3Rpb25EYXRhKFwiY29udGVudGhhc2hcIiwgW2V0aGVycy51dGlscy5mb3JtYXRCeXRlczMyU3RyaW5nKFwidml0YWxpay5ldGhcIildKVxuXG4gICAgXG5cbiAgICAvLyBjb25zdCBpZmFjZSA9IG5ldyBldGhlcnMudXRpbHMuSW50ZXJmYWNlKFtcbiAgICAvLyAgICAgXCJmdW5jdGlvbiBnZXRDb3VudCh1aW50MjU2KSBwdWJsaWMgdmlldyByZXR1cm5zICh1aW50MjU2KVwiXG4gICAgLy8gXSlcbiAgICAvLyBjb25zdCBDT05UUkFDVF9BRERSRVNTID0gJzB4NWZiZGIyMzE1Njc4YWZlY2IzNjdmMDMyZDkzZjY0MmY2NDE4MGFhMydcbiAgICAvLyAvLyBjb25zdCBjYWxsZGF0YSA9IGlmYWNlLmVuY29kZUZ1bmN0aW9uRGF0YShcImNvbnRlbnRoYXNoXCIsIFtldGhlcnMudXRpbHMuZm9ybWF0Qnl0ZXMzMlN0cmluZyhcInZpdGFsaWsuZXRoXCIpXSlcbiAgICAvLyBjb25zdCBjYWxsZGF0YSA9IGlmYWNlLmVuY29kZUZ1bmN0aW9uRGF0YShcImdldENvdW50XCIsIFtcIjEyM1wiXSlcblxuICAgIC8vIGNvbnN0IG1zZyA9IHtcbiAgICAvLyAgICAgZnJvbTogZXRoZXJzLmNvbnN0YW50cy5BZGRyZXNzWmVybyxcbiAgICAvLyAgICAgdG86IENPTlRSQUNUX0FERFJFU1MsXG4gICAgLy8gICAgIGRhdGE6IGNhbGxkYXRhLFxuICAgIC8vIH1cbiAgICBcblxuICAgIC8vIGNvbnNvbGUubG9nKG1zZylcblxuICAgIC8vIGV2bS5ldmVudHMub24oJ3N0ZXAnLCBhc3luYyBmdW5jdGlvbiAoZGF0YSkge1xuICAgIC8vICAgICAvLyBkYXRhLmdhc0xlZnQgPSBCaWdJbnQoMHhmZmZmZmZmZmZmZmZmZilcbiAgICAvLyAgICAgLy8gTm90ZSB0aGF0IGRhdGEuc3RhY2sgaXMgbm90IGltbXV0YWJsZSwgaS5lLiBpdCBpcyBhIHJlZmVyZW5jZSB0byB0aGUgdm0ncyBpbnRlcm5hbCBzdGFjayBvYmplY3RcbiAgICAvLyAgICAgLy8gY29uc29sZS5sb2coYE9wY29kZTogJHtkYXRhLm9wY29kZS5uYW1lfVxcdFN0YWNrOiAke2RhdGEuc3RhY2t9YClcblxuICAgIC8vICAgICBjb25zb2xlLmxvZyhcbiAgICAvLyAgICAgICAgIChhd2FpdCBzdGF0ZU1hbmFnZXIuZ2V0Q29udHJhY3RDb2RlKFxuICAgIC8vICAgICAgICAgICAgIEFkZHJlc3MuZnJvbVN0cmluZygnMHg1ZmJkYjIzMTU2NzhhZmVjYjM2N2YwMzJkOTNmNjQyZjY0MTgwYWEzJykpXG4gICAgLy8gICAgICAgICApLnRvU3RyaW5nKCdoZXgnKVxuICAgIC8vICAgICApXG4gICAgLy8gfSlcblxuXG4gICAgLy8gY29uc29sZS5sb2cobXNnQ29kZWQpXG4gICAgXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBleGVjUmVzdWx0OiByZXMgfSA9IGF3YWl0IGV2bS5ydW5DYWxsKG1zZylcbiAgICAgICAgY29uc29sZS5sb2cocmVzLmV4Y2VwdGlvbkVycm9yKVxuICAgICAgICBjb25zb2xlLmxvZyhgUmV0dXJuZWQ6ICR7cmVzLnJldHVyblZhbHVlLnRvU3RyaW5nKCdoZXgnKX1gKVxuICAgICAgICBjb25zb2xlLmxvZyhgZ2FzVXNlZDogJHtyZXMuZXhlY3V0aW9uR2FzVXNlZC50b1N0cmluZygpfWApXG5cbiAgICB9IGNhdGNoKGVycikge1xuICAgICAgICBjb25zb2xlLmxvZyhlcnIpXG4gICAgfVxuICAgIFxufVxuXG5tYWluKCkiXX0=