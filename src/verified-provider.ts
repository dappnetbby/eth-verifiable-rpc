import { ethers } from "ethers"
import { Eip1193Bridge } from "./eip1193"

export class VerifiedProvider {
    static async create(baseProvider: ethers.providers.JsonRpcProvider) {
        const bridge = await Eip1193Bridge.create(baseProvider)
        const provider = new ethers.providers.Web3Provider(bridge)
        return provider
    }
}