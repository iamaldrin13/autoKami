import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load ABI safely
export const loadAbi = (abiName: string) => {
    // In Docker/Build environment, abis might be copied to a different location or we need to traverse up
    // Try multiple paths
    const possiblePaths = [
        path.join(__dirname, '../../abi', abiName), // Dev: src/services -> app/abi
        path.join(__dirname, '../abi', abiName),    // Dist: dist/services -> dist/abi (if copied)
        path.join(process.cwd(), 'abi', abiName),   // Root: app/abi
        path.join(process.cwd(), '../abi', abiName), // Mono-repo root
        '/abi/' + abiName, // Absolute path in container (copied to /abi)
        '/app/abi/' + abiName
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
    }

    throw new Error(`ABI ${abiName} not found in checked paths: ${possiblePaths.join(', ')}`);
};

// Helper to load IDs
export const loadIds = (fileName: string) => {
    const possiblePaths = [
        path.join(__dirname, '../../ids', fileName),
        path.join(__dirname, '../ids', fileName),
        path.join(process.cwd(), 'ids', fileName),
        path.join(process.cwd(), '../ids', fileName),
        '/ids/' + fileName,
        '/app/ids/' + fileName
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
    }
    throw new Error(`ID file ${fileName} not found`);
};
