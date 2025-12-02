import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import { getKamiByIndex } from './kamiService.js';

const World = loadAbi('World.json');
const components = loadIds('components.json');

const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const WORLD_ADDRESS = '0x2729174c265dbBd8416C6449E0E813E88f43D0E7';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const world = new ethers.Contract(WORLD_ADDRESS, World.abi, provider);

export async function computeAccountIdFromAddress(walletAddress: string): Promise<bigint> {
    return BigInt(walletAddress);
}

export async function getKamisByAccountId(accountId: string): Promise<any[]> {
    // OwnsKamiID component
    const IDOwnsKamiComponent = loadAbi('IDOwnsKamiComponent.json');
    const componentId = (components as any).OwnsKamiID.encodedID;
    const componentAddress = await getComponentAddress(componentId);
    const contract = new ethers.Contract(componentAddress, IDOwnsKamiComponent.abi, provider);
    
    const entities = await contract.getFunction('getEntitiesWithValue(uint256)')(BigInt(accountId));
    
    const kamis = [];
    for (const entityId of entities) {
        const index = await getKamiIndex(entityId);
        if (index !== null) {
            const kamiData = await getKamiByIndex(index);
            kamis.push(kamiData);
        }
    }
    return kamis;
}

async function getComponentAddress(componentId: string): Promise<string> {
    const systemsRegistryAddress = await world.components();
    const abi = loadAbi('IDOwnsKamiComponent.json'); 
    const registry = new ethers.Contract(systemsRegistryAddress, abi.abi, provider);
    const addresses = await registry.getFunction('getEntitiesWithValue(bytes)')(componentId);
    if (addresses.length > 0) {
        const id = BigInt(addresses[0]);
        return ethers.getAddress('0x' + id.toString(16).padStart(40, '0'));
    }
    throw new Error('Component not found');
}

async function getKamiIndex(entityId: bigint): Promise<number | null> {
    // Map EntityID -> Index using KamiIndex component
    // Note: Use 'KamiIndex' from components.json
    const componentId = (components as any).KamiIndex.encodedID;
    const address = await getComponentAddress(componentId);
    // KamiIndex usually maps EntityID => Index (uint32)
    const abi = loadAbi('Uint32Component.json'); 
    const contract = new ethers.Contract(address, abi.abi, provider);
    
    const has = await contract.has(entityId);
    if (has) {
        return Number(await contract.getFunction('get(uint256)')(entityId));
    }
    return null;
}

export async function getAccountById(accountId: string): Promise<any> {
    return { id: accountId, currStamina: 100 }; 
}

export async function getAccountByAddress(address: string): Promise<any> {
    const id = await computeAccountIdFromAddress(address);
    return getAccountById(id.toString());
}