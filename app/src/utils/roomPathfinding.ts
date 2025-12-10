// Room data extracted from mapping/room_connection_map.tsx
export interface RoomNode {
    id: number;
    name: string;
    exits: number[];
    z: number;
}

export const ROOMS: RoomNode[] = [
    { id: 1, name: "Misty Riverside", exits: [20], z: 1 },
    { id: 2, name: "Tunnel of Trees", exits: [13], z: 1 },
    { id: 3, name: "Torii Gate", exits: [], z: 1 },
    { id: 4, name: "Vending Machine", exits: [], z: 1 },
    { id: 5, name: "Restricted Area", exits: [], z: 1 },
    { id: 6, name: "Labs Entrance", exits: [28], z: 1 },
    { id: 9, name: "Forest: Old Growth", exits: [], z: 1 },
    { id: 10, name: "Forest: Insect Node", exits: [], z: 1 },
    { id: 11, name: "Temple by the Waterfall", exits: [24, 15], z: 1 },
    { id: 12, name: "Scrap Confluence", exits: [], z: 1 },
    { id: 13, name: "Convenience Store", exits: [2], z: 2 },
    { id: 15, name: "Temple Cave", exits: [11], z: 3 },
    { id: 16, name: "Techno Temple", exits: [], z: 3 },
    { id: 18, name: "Cave Crossroads", exits: [67, 76], z: 3 },
    { id: 19, name: "Temple of the Wheel", exits: [74], z: 3 },
    { id: 25, name: "Lost Skeleton", exits: [], z: 1 },
    { id: 26, name: "Trash-Strewn Graves", exits: [], z: 1 },
    { id: 29, name: "Misty Forest Path", exits: [], z: 1 },
    { id: 30, name: "Scrapyard Entrance", exits: [], z: 1 },
    { id: 31, name: "Scrapyard Exit", exits: [], z: 1 },
    { id: 32, name: "Road To Labs", exits: [], z: 1 },
    { id: 33, name: "Forest Entrance", exits: [], z: 1 },
    { id: 34, name: "Deeper Into Scrap", exits: [], z: 1 },
    { id: 35, name: "Elder Path", exits: [], z: 1 },
    { id: 36, name: "Parting Path", exits: [], z: 1 },
    { id: 37, name: "Hollow Path", exits: [], z: 1 },
    { id: 47, name: "Scrap Paths", exits: [], z: 1 },
    { id: 48, name: "Murky Forest Path", exits: [], z: 1 },
    { id: 49, name: "Clearing", exits: [], z: 1 },
    { id: 50, name: "Ancient Forest Entrance", exits: [], z: 1 },
    { id: 51, name: "Scrap-Littered Undergrowth", exits: [], z: 1 },
    { id: 52, name: "Airplane Crash", exits: [54], z: 1 },
    { id: 53, name: "Blooming Tree", exits: [], z: 1 },
    { id: 54, name: "Plane Interior", exits: [52], z: 2 },
    { id: 55, name: "Shady Path", exits: [], z: 1 },
    { id: 56, name: "Butterfly Forest", exits: [], z: 1 },
    { id: 57, name: "River Crossing", exits: [], z: 1 },
    { id: 58, name: "Mouth of Scrap", exits: [], z: 1 },
    { id: 59, name: "Black Pool", exits: [], z: 1 },
    { id: 60, name: "Scrap Trees", exits: [], z: 1 },
    { id: 61, name: "Musty Forest Path", exits: [], z: 1 },
    { id: 62, name: "Centipedes", exits: [], z: 1 },
    { id: 63, name: "Deeper Forest Path", exits: [], z: 1 },
    { id: 64, name: "Burning Room", exits: [65], z: 2 },
    { id: 65, name: "Forest Hut", exits: [64], z: 1 },
    { id: 66, name: "Marketplace", exits: [], z: 1 },
    { id: 67, name: "Boulder Tunnel", exits: [18, 68], z: 3 },
    { id: 68, name: "Slippery Pit", exits: [67, 75, 69], z: 3 },
    { id: 69, name: "Lotus Pool", exits: [68, 70], z: 3 },
    { id: 70, name: "Still Stream", exits: [69, 71], z: 3 },
    { id: 71, name: "Shabby Deck", exits: [70, 72], z: 3 },
    { id: 72, name: "Hatch to Nowhere", exits: [71, 73, 88], z: 3 },
    { id: 73, name: "Broken Tube", exits: [72, 74], z: 3 },
    { id: 74, name: "Engraved Door", exits: [73, 75, 19], z: 3 },
    { id: 75, name: "Flood Mural", exits: [68, 74], z: 3 },
    { id: 76, name: "Fungus Garden", exits: [77, 18], z: 3 },
    { id: 77, name: "Thriving Mushrooms", exits: [76, 78, 84], z: 3 },
    { id: 78, name: "Toadstool Platforms", exits: [77, 79], z: 3 },
    { id: 79, name: "Abandoned Campsite", exits: [78, 80], z: 3 },
    { id: 80, name: "Radiant Crystal", exits: [79, 81], z: 3 },
    { id: 81, name: "Flower Mural", exits: [80, 82], z: 3 },
    { id: 82, name: "Geometric Cliffs", exits: [81, 83], z: 3 },
    { id: 83, name: "Canyon Bridge", exits: [82, 84, 85], z: 3 },
    { id: 84, name: "Reinforced Tunnel", exits: [77, 83], z: 3 },
    { id: 85, name: "Giant's Palm", exits: [83, 86], z: 3 },
    { id: 86, name: "Guardian Skull", exits: [85, 87], z: 3 },
    { id: 87, name: "Sacrarium", exits: [86], z: 3 },
    { id: 88, name: "Treasure Hoard", exits: [89, 72], z: 4 },
    { id: 89, name: "Trophies of the Hunt", exits: [88, 90], z: 4 },
    { id: 90, name: "Scenic View", exits: [89], z: 4 }
];

export interface PathResult {
    path: number[];
    distance: number;
    names: string[];
}

/**
 * Find shortest path between two rooms using BFS
 * @param startId Starting room ID
 * @param targetId Target room ID
 * @returns PathResult or null if no path found
 */
export function findShortestPath(startId: number, targetId: number): PathResult | null {
    if (startId === targetId) {
        return {
            path: [startId],
            distance: 0,
            names: [getRoomName(startId)]
        };
    }

    const queue: number[][] = [[startId]];
    const visited = new Set<number>();
    visited.add(startId);

    while (queue.length > 0) {
        const path = queue.shift()!;
        const currentId = path[path.length - 1];

        if (currentId === targetId) {
            return {
                path: path,
                distance: path.length - 1, // Distance is number of hops (edges)
                names: path.map(id => getRoomName(id))
            };
        }

        const room = ROOMS.find(r => r.id === currentId);
        if (room) {
            for (const exitId of room.exits) {
                if (!visited.has(exitId)) {
                    visited.add(exitId);
                    const newPath = [...path, exitId];
                    queue.push(newPath);
                }
            }
        }
    }

    return null;
}

export function getRoomName(id: number): string {
    const room = ROOMS.find(r => r.id === id);
    return room ? room.name : `Unknown (${id})`;
}
