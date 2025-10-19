import * as THREE from 'three';
import { createToonMaterial } from './toonMaterial.js';

const GROUND_COLOR = 0x6B8E23; // Olive Drab
const TRUNK_COLOR = 0x8B4513;  // Saddle Brown
const LEAF_COLORS = [0x228B22, 0x3CB371, 0x006400]; // Forest Green, Medium Sea Green, Dark Green

function createTree(position, light) {
    const treeGroup = new THREE.Group();
    treeGroup.position.copy(position);

    // Trunk
    const trunkHeight = Math.random() * 2 + 4; // 4 to 6
    const trunkRadius = Math.random() * 0.2 + 0.4; // 0.4 to 0.6
    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 8);
    const trunkMaterial = createToonMaterial(TRUNK_COLOR);
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = true;
    trunk.receiveShadow = true; // Trunks can receive shadows from canopy
    trunk.position.y = trunkHeight / 2;
    treeGroup.add(trunk);

    // Canopy - Conical Style
    const canopyLevels = Math.floor(Math.random() * 2) + 2; // 2 or 3 levels
    let currentHeight = trunkHeight;
    let baseCanopyRadius = Math.random() * 1.5 + 2.5; // 2.5 to 4

    for (let i = 0; i < canopyLevels; i++) {
        const canopyRadius = baseCanopyRadius * (1 - i * 0.3); // Tapering cones
        const canopyHeight = canopyRadius * (Math.random() * 0.5 + 1.2); // Height relative to radius
        const leafGeometry = new THREE.ConeGeometry(canopyRadius, canopyHeight, 8);
        
        const leafColorHex = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
        const leafMaterial = createToonMaterial(leafColorHex);
        
        const leaves = new THREE.Mesh(leafGeometry, leafMaterial);
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        leaves.position.y = currentHeight + canopyHeight * 0.4; // Position base of cone
        treeGroup.add(leaves);
        currentHeight += canopyHeight * 0.5; // Stack cones slightly overlapping
    }
    
    // Random rotation
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    treeGroup.scale.setScalar(0.8 + Math.random() * 0.4); // Slight size variation

    return treeGroup;
}

export function createForest(scene, light) {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    const groundMaterial = createToonMaterial(GROUND_COLOR);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Trees
    const treeCount = 70;
    const forestSpread = 80; 

    for (let i = 0; i < treeCount; i++) {
        const x = (Math.random() - 0.5) * forestSpread * 2;
        const z = (Math.random() - 0.5) * forestSpread * 2;
        
        // Basic check to avoid trees too close to origin for initial view
        if (Math.sqrt(x*x + z*z) < 10 && i < 5) continue; 

        const tree = createTree(new THREE.Vector3(x, 0, z), light);
        scene.add(tree);
    }
}