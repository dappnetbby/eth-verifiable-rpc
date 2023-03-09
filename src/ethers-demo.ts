import { ethers } from "ethers";
import { VerifiedProvider } from "./verified-provider";

async function main() {
    // const baseProvider = new ethers.providers.InfuraProvider()
    const baseProvider = new ethers.providers.AlchemyProvider("homestead", "_sv2oRLgzKmeCMYaFUE7BdJjA2sgheGu")
    const verifiedProvider = await VerifiedProvider.create(baseProvider)
    
    const ens = new ethers.Contract(
        "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41", // ENS Registry
        [
            "function contenthash(bytes32 node) external view returns (bytes memory)", 
        ],
        verifiedProvider
    )
    
    async function bench(i: number) {
        console.time(`#${i} lookup`)
        const res = await ens.contenthash("0xe6ae31d630cc7a8279c0f1c7cbe6e7064814c47d1785fa2703d9ae511ee2be0c")
        console.log(res)
        console.timeEnd(`#${i} lookup`)
        if(i > 0) bench(i-1)
    }

    await bench(0)
    
    // console.time('2nd lookup')
    // const res2 = await ens.contenthash("0xe6ae31d630cc7a8279c0f1c7cbe6e7064814c47d1785fa2703d9ae511ee2be0c")
    // console.timeEnd('2nd lookup')
    // console.log(res)
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
})