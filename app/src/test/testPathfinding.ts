import { findShortestPath } from '../utils/roomPathfinding.js';

const startId = 72; // Hatch to Nowhere
const targetId = 69; // Lotus Pool

console.log(`Finding path from ${startId} to ${targetId}...`);
const result = findShortestPath(startId, targetId);

if (result) {
    console.log(`Path Found!`);
    console.log(`Distance: ${result.distance} hops`);
    console.log(`Route: ${result.path.join(' -> ')}`);
    console.log(`Route Names: ${result.names.join(' -> ')}`);
} else {
    console.log('No path found.');
}