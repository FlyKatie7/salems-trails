import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import confetti from 'https://esm.sh/canvas-confetti@1.6.0';
import HARDCODED_CUBE_CONFIG, { CUBE_SIDES } from './toonMaterial.js';
// Face behavior configuration - maps face types to handler functions
const FACE_BEHAVIORS = {
    magnifier: 'research',
    chip: 'trivia',
    eye: 'view',
    lock: 'puzzle',
    link: 'connections',
    base: 'info'
};
// Game state
let scene, camera, renderer, cube, controls, raycaster, mouse;
let currentData = null;
let isInitialized = false;
let cubeTextures = [];
let hoveredFace = null;
let originalEmissiveColors = [];
// Unlock system
let unlockedEntities = new Set();
let playerScore = 0;
let recentlyUnlockedEntity = null; // Track most recently unlocked for animation
// Load unlocked entities from localStorage
console.log("🌟 Rosebud Sync Test Successful!");

function loadProgress() {
    try {
        const saved = localStorage.getItem('triviaProgress');
        if (saved) {
            const data = JSON.parse(saved);
            unlockedEntities = new Set(data.unlockedEntities || []);
            playerScore = data.score || 0;
            console.log('[Game.js] Loaded progress:', unlockedEntities.size, 'entities unlocked');
        }
    } catch (e) {
        console.warn('[Game.js] Could not load progress:', e);
    }
}
// Save progress to localStorage
function saveProgress() {
    try {
        const data = {
            unlockedEntities: Array.from(unlockedEntities),
            score: playerScore,
            lastUpdated: Date.now()
        };
        localStorage.setItem('triviaProgress', JSON.stringify(data));
    } catch (e) {
        console.warn('[Game.js] Could not save progress:', e);
    }
}
// Unlock entity and save progress
function unlockEntity(entityId) {
    if (!unlockedEntities.has(entityId)) {
        unlockedEntities.add(entityId);
        recentlyUnlockedEntity = entityId; // Mark for growth animation
        saveProgress();
        return true; // newly unlocked
    }
    return false; // already unlocked
}
// Export the function that main.js expects
export function updateTriviaCubeData(data) {
    console.log('[Game.js] updateTriviaCubeData called - refreshing game scene');
    
    currentData = data;
    
    if (data) {
        console.log('[Game.js] Data available:', data);
        if (isInitialized) {
            refreshCubeTextures(data);
        }
    } else {
        console.log('[Game.js] No data available, using defaults');
    }
}
// Initialize Three.js scene
function initScene() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('[Game.js] Canvas element not found');
        return;
    }
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    // Camera
    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(5, 4, 5);
    camera.lookAt(0, 0, 0);
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0x4a90e2, 0.7);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0xff6b9d, 0.8);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);
    // Orbit Controls
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    // Raycaster for click detection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x16213e,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);
    // Create the trivia cube
    createTriviaCube();
    // Add particle effects
    createStarfield();
    console.log('[Game.js] Scene initialized successfully');
    console.log('[Game.js] Cube object:', cube);
    console.log('[Game.js] Scene children:', scene.children.length);
    isInitialized = true;
}
// Create the trivia cube with textures
async function createTriviaCube() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    try {
        const config = currentData?.cubeConfig || HARDCODED_CUBE_CONFIG;
        const size = config.size || 2;
        // Load all textures
        const textureLoader = new THREE.TextureLoader();
        const materials = [];
        // Map faces to Three.js material array order: [right, left, top, bottom, front, back]
        for (const side of CUBE_SIDES) {
            const faceConfig = config.faces.find(f => f.side === side);
            
            if (faceConfig && faceConfig.textureUrl) {
                const texture = await textureLoader.loadAsync(faceConfig.textureUrl);
                texture.colorSpace = THREE.SRGBColorSpace;
                
                const material = new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0.3,
                    metalness: 0.4,
                    emissive: 0x111111,
                    emissiveIntensity: 0.2
                });
                
                materials.push(material);
                cubeTextures.push({ side, material, config: faceConfig });
            } else {
                // Default material for missing textures
                materials.push(new THREE.MeshStandardMaterial({
                    color: 0x4a90e2,
                    roughness: 0.5,
                    metalness: 0.3
                }));
            }
        }
        // Create cube geometry and mesh
        const geometry = new THREE.BoxGeometry(size, size, size);
        cube = new THREE.Mesh(geometry, materials);
        cube.castShadow = true;
        cube.receiveShadow = true;
        cube.position.y = 0;
        
        // Store original emissive colors for hover effects
        originalEmissiveColors = materials.map(mat => mat.emissive.clone());
        
        // Store face configurations on the cube for later reference
        cube.userData.faceConfigs = config.faces;
        
        scene.add(cube);
        console.log('[Game.js] Trivia cube created with', materials.length, 'faces');
        console.log('[Game.js] Cube position:', cube.position);
        console.log('[Game.js] Cube visible:', cube.visible);
    } catch (error) {
        console.error('[Game.js] Error creating trivia cube:', error);
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}
// Refresh cube textures when data updates
async function refreshCubeTextures(data) {
    if (!cube || !data?.cubeConfig) return;
    console.log('[Game.js] Refreshing cube textures with new data');
    
    // Remove old cube
    scene.remove(cube);
    cube.geometry.dispose();
    cube.material.forEach(mat => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
    });
    
    // Create new cube with updated data
    await createTriviaCube();
}
// Create starfield background
function createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.8
    });
    const starsVertices = [];
    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 50;
        const y = (Math.random() - 0.5) * 50;
        const z = (Math.random() - 0.5) * 50;
        starsVertices.push(x, y, z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const starfield = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starfield);
}
// Animation loop
function animate() {
    requestAnimationFrame(animate);
    if (controls) {
        controls.update();
    }
    if (cube) {
        // Gentle floating animation
        cube.position.y = Math.sin(Date.now() * 0.001) * 0.1;
    }
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}
// Handle mouse movement for hover effects
function onCanvasMouseMove(event) {
    if (!cube || !camera || !raycaster) return;
    
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const tooltip = document.getElementById('cube-face-tooltip');
    
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(cube);
    
    if (intersects.length > 0) {
        const faceIndex = Math.floor(intersects[0].faceIndex / 2);
        
        // If hovering over a different face
        if (hoveredFace !== faceIndex) {
            // Reset previous face
            if (hoveredFace !== null && cube.material[hoveredFace]) {
                cube.material[hoveredFace].emissive.copy(originalEmissiveColors[hoveredFace]);
                cube.material[hoveredFace].emissiveIntensity = 0.2;
            }
            
            // Highlight new face
            hoveredFace = faceIndex;
            if (cube.material[faceIndex]) {
                cube.material[faceIndex].emissive.setHex(0x4a90e2);
                cube.material[faceIndex].emissiveIntensity = 0.6;
            }
            
            // Show tooltip with face description
            const sideName = CUBE_SIDES[faceIndex];
            const faceConfig = cube.userData.faceConfigs.find(f => f.side === sideName);
            
            if (faceConfig && tooltip) {
                const actionText = getActionTextForFace(faceConfig);
                tooltip.textContent = actionText;
                tooltip.style.display = 'block';
            }
            
            canvas.style.cursor = 'pointer';
        }
        
        // Update tooltip position to follow mouse
        if (tooltip && tooltip.style.display === 'block') {
            const offsetX = 15;
            const offsetY = 15;
            const maxX = window.innerWidth - tooltip.offsetWidth - 10;
            const maxY = window.innerHeight - tooltip.offsetHeight - 10;
            
            let x = event.clientX + offsetX;
            let y = event.clientY + offsetY;
            
            // Keep tooltip within viewport
            x = Math.min(x, maxX);
            y = Math.min(y, maxY);
            
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        }
    } else {
        // No face hovered - hide tooltip
        if (hoveredFace !== null && cube.material[hoveredFace]) {
            cube.material[hoveredFace].emissive.copy(originalEmissiveColors[hoveredFace]);
            cube.material[hoveredFace].emissiveIntensity = 0.2;
        }
        hoveredFace = null;
        canvas.style.cursor = 'default';
        
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
}
// Get user-friendly action text for each face type
function getActionTextForFace(faceConfig) {
    const behaviorType = faceConfig.behaviorType || FACE_BEHAVIORS[faceConfig.icon];
    
    const actionTexts = {
        'trivia': '🎮 Click to answer trivia questions',
        'stats': '📊 Click to view player statistics',
        'view': '📺 Click to view historic imagery',
        'connections': '🔗 Click to explore connections',
        'research': '🔍 Click to search and research',
        'puzzle': '🔒 Click to unlock (requires key)',
        'info': 'ℹ️ Click for information'
    };
    
    return actionTexts[behaviorType] || faceConfig.description || 'Click to interact';
}
// Handle mouse clicks on cube faces
function onCanvasClick(event) {
    if (!cube || !camera || !raycaster) return;
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(cube);
    if (intersects.length > 0) {
        const faceIndex = Math.floor(intersects[0].faceIndex / 2);
        const sideName = CUBE_SIDES[faceIndex];
        const faceConfig = cube.userData.faceConfigs.find(f => f.side === sideName);
        console.log('[Game.js] Clicked on face:', sideName, faceConfig);
        if (faceConfig) {
            handleFaceClick(faceConfig);
        }
    }
}
// Handle different types of face interactions
function handleFaceClick(faceConfig) {
    // Play click sound
    const clickSound = new Audio('https://play.rosebud.ai/assets/start-game.wav.wav?iYmZ');
    clickSound.volume = 0.3;
    clickSound.play().catch(e => console.log('Audio play failed:', e));
    // Determine behavior type from faceConfig
    const behaviorType = faceConfig.behaviorType || 
                        FACE_BEHAVIORS[faceConfig.icon] || 
                        faceConfig.contentType;
    console.log('[Game.js] Face clicked - Behavior type:', behaviorType, faceConfig);
    // Route to appropriate handler based on behavior
    switch(behaviorType) {
        case 'trivia':
        case 'interactive':
            handleTriviaInteraction(faceConfig);
            break;
        
        case 'view':
        case 'openChat':
            handleViewInteraction(faceConfig);
            break;
        
        case 'connections':
        case 'link':
            handleConnectionsInteraction(faceConfig);
            break;
        
        case 'research':
            handleResearchInteraction(faceConfig);
            break;
        
        case 'stats':
            handleStatsInteraction(faceConfig);
            break;
        
        case 'puzzle':
            handlePuzzleInteraction(faceConfig);
            break;
        
        case 'info':
        default:
            handleInfoInteraction(faceConfig);
            break;
    }
}
// Handler: Trivia questions and quizzes
function handleTriviaInteraction(faceConfig) {
    if (faceConfig.questionId) {
        showTriviaQuestion(faceConfig);
    } else {
        console.log('[Game.js] Trivia face clicked but no question ID provided');
        showNotification('🎮 This trivia challenge is coming soon!', 'info');
    }
}
// Handler: View/Chat interactions - Now opens 3D TV display
function handleViewInteraction(faceConfig) {
    const tvModal = document.getElementById('tv-display-modal');
    if (tvModal) {
        tvModal.classList.remove('hidden');
        showNotification('📺 Opening vintage TV display...', 'success');
        
        // Add subtle animation on TV appearance
        const retroTv = document.getElementById('retro-tv');
        if (retroTv) {
            retroTv.style.transform = 'rotateY(-5deg) scale(0.95)';
            setTimeout(() => {
                retroTv.style.transform = 'rotateY(0deg) scale(1)';
            }, 100);
        }
    } else {
        console.warn('[Game.js] TV display modal not found');
        showNotification('Display feature unavailable', 'error');
    }
}
// Handler: External connections and links - Now opens Connections Board
function handleConnectionsInteraction(faceConfig) {
    console.log('[Game.js] Connections interaction triggered', faceConfig);
    
    const connectionsModal = document.getElementById('connections-board-modal');
    if (connectionsModal) {
        showConnectionsBoard();
        showNotification('🔗 Opening Connections Board...', 'success');
    } else {
        console.error('[Game.js] Connections board modal not found');
    }
}
// Show the Connections Board with entity chips and relationship lines
function showConnectionsBoard() {
    const modal = document.getElementById('connections-board-modal');
    const grid = document.getElementById('connections-grid');
    
    if (!modal || !grid) return;
    
    // Sample connections data with relationships
    const connections = [
        { id: 1, name: 'Elsinore Theater', category: 'where', description: 'Historic performing arts venue in Salem, Oregon', unlocked: true },
        { id: 2, name: 'Salem', category: 'where', description: 'Capital city of Oregon', unlocked: true },
        { id: 3, name: 'George Washington', category: 'who', description: 'First President of the United States' },
        { id: 4, name: 'Eiffel Tower', category: 'what', description: 'Iconic iron lattice tower in Paris' },
        { id: 5, name: 'Gustave Eiffel', category: 'who', description: 'Designer of the Eiffel Tower' },
        { id: 6, name: 'Gold (Au)', category: 'what', description: 'Precious metal, chemical element' },
        { id: 7, name: 'Canberra', category: 'where', description: 'Capital of Australia' },
        { id: 8, name: 'World War II', category: 'what', description: 'Global conflict 1939-1945' },
        { id: 9, name: 'Paris', category: 'where', description: 'Capital city of France' },
        { id: 10, name: 'Australia', category: 'where', description: 'Country and continent' },
        { id: 11, name: 'Clark Gable', category: 'who', description: 'American film actor who performed at Elsinore Theater in the 1920s', unlocked: true },
    ];
    
    // Apply unlock status from player progress
    connections.forEach(conn => {
        if (conn.unlocked === undefined) {
            conn.unlocked = unlockedEntities.has(conn.id);
        }
    });
    
    // Define relationships between entities
    const relationships = [
        { from: 1, to: 2, strength: 'strong' },  // Elsinore -> Salem
        { from: 4, to: 5, strength: 'strong' },  // Eiffel Tower -> Gustave Eiffel
        { from: 4, to: 9, strength: 'strong' },  // Eiffel Tower -> Paris
        { from: 7, to: 10, strength: 'strong' }, // Canberra -> Australia
        { from: 3, to: 8, strength: 'medium' },  // George Washington -> WWII (historical)
        { from: 2, to: 9, strength: 'weak' },    // Salem -> Paris (city connection)
        { from: 11, to: 1, strength: 'strong' }, // Clark Gable -> Elsinore Theater
        { from: 11, to: 2, strength: 'medium' }, // Clark Gable -> Salem
    ];
    
    // Check if currentData has custom connections
    const customConnections = currentData?.data?.connections || [];
    const customRelationships = currentData?.data?.relationships || [];
    
    const allConnections = customConnections.length > 0 ? customConnections : connections;
    const allRelationships = customRelationships.length > 0 ? customRelationships : relationships;
    
    renderConnectionsGraph(allConnections, allRelationships, 'all');
    
    modal.classList.remove('hidden');
}
// Render connections graph with SVG lines and filtering
function renderConnectionsGraph(connections, relationships, filter = 'all') {
    const grid = document.getElementById('connections-grid');
    if (!grid) return;
    
    // Clear existing content
    grid.innerHTML = '';
    
    // Create SVG canvas for connection lines
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('id', 'connections-svg');
    svg.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
    `;
    grid.appendChild(svg);
    
    // Create container for chips
    const chipsContainer = document.createElement('div');
    chipsContainer.style.cssText = `
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 15px;
        width: 100%;
    `;
    grid.appendChild(chipsContainer);
    
    // Filter connections
    const filtered = filter === 'all' 
        ? connections 
        : connections.filter(c => c.category === filter);
    
    // Store chip positions for line drawing
    const chipPositions = new Map();
    
    // Render chips
    filtered.forEach((connection, index) => {
        const chip = document.createElement('div');
        chip.className = 'connection-chip';
        chip.dataset.category = connection.category;
        chip.dataset.id = connection.id;
        chip.id = `chip-${connection.id}`;
        
        // Apply locked state or newly unlocked state
        if (connection.unlocked === false) {
            chip.classList.add('locked');
        } else if (connection.id === recentlyUnlockedEntity) {
            chip.classList.add('newly-unlocked');
            // Clear the recently unlocked marker after animation
            setTimeout(() => {
                chip.classList.remove('newly-unlocked');
                recentlyUnlockedEntity = null;
            }, 3000);
        }
        
        chip.innerHTML = `
            <span class="connection-chip-category">${connection.category.toUpperCase()}</span>
            <span class="connection-chip-label">${connection.name}</span>
            ${connection.unlocked === false ? '<div class="lock-overlay">🔒</div>' : ''}
        `;
        
        chip.addEventListener('click', () => {
            handleConnectionClick(connection);
        });
        
        chipsContainer.appendChild(chip);
        chipPositions.set(connection.id, chip);
    });
    
    // Draw connection lines after chips are rendered
    setTimeout(() => {
        drawConnectionLines(svg, relationships, chipPositions, connections);
    }, 50);
}
// Trigger web growth animation for newly unlocked entity
function triggerWebGrowthAnimation(entityId) {
    const connectionsModal = document.getElementById('connections-board-modal');
    if (!connectionsModal || connectionsModal.classList.contains('hidden')) return;
    
    // Get current data
    const connections = currentData?.data?.connections || [];
    connections.forEach(conn => {
        if (conn.unlocked === undefined) {
            conn.unlocked = unlockedEntities.has(conn.id);
        }
    });
    
    const relationships = currentData?.data?.relationships || [
        { from: 1, to: 2, strength: 'strong' },
        { from: 4, to: 5, strength: 'strong' },
        { from: 4, to: 9, strength: 'strong' },
        { from: 7, to: 10, strength: 'strong' },
        { from: 3, to: 8, strength: 'medium' },
        { from: 2, to: 9, strength: 'weak' },
        { from: 11, to: 1, strength: 'strong' },
        { from: 11, to: 2, strength: 'medium' },
    ];
    
    // Re-render to show the newly unlocked chip and grow its connections
    const currentTab = document.querySelector('.connection-tab.active');
    const category = currentTab?.dataset.category || 'all';
    renderConnectionsGraph(connections, relationships, category);
    
    // Play growth sound
    const growthSound = new Audio('https://play.rosebud.ai/assets/correct-answer.wav.wav?Vvzj');
    growthSound.volume = 0.2;
    growthSound.play().catch(e => console.log('Audio play failed:', e));
    
    showNotification('🌐 Web expanding! New connections revealed!', 'success');
}
// Draw animated connection lines between chips
function drawConnectionLines(svg, relationships, chipPositions, connections) {
    const svgNS = 'http://www.w3.org/2000/svg';
    
    relationships.forEach((rel, index) => {
        const fromChip = chipPositions.get(rel.from);
        const toChip = chipPositions.get(rel.to);
        
        if (!fromChip || !toChip) return;
        
        // Check if both entities are unlocked
        const fromEntity = connections.find(c => c.id === rel.from);
        const toEntity = connections.find(c => c.id === rel.to);
        
        if (!fromEntity?.unlocked || !toEntity?.unlocked) return;
        
        // Get center positions of chips
        const fromRect = fromChip.getBoundingClientRect();
        const toRect = toChip.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        
        const x1 = fromRect.left + fromRect.width / 2 - svgRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
        const x2 = toRect.left + toRect.width / 2 - svgRect.left;
        const y2 = toRect.top + toRect.height / 2 - svgRect.top;
        
        // Create curved path
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Control point for curve (perpendicular offset)
        const offset = dist * 0.2;
        const cx = midX - dy / dist * offset;
        const cy = midY + dx / dist * offset;
        
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
        path.setAttribute('class', 'connection-line');
        path.setAttribute('data-strength', rel.strength || 'medium');
        
        // Set stroke properties based on strength
        const strokeWidth = rel.strength === 'strong' ? 3 : rel.strength === 'weak' ? 1 : 2;
        const opacity = rel.strength === 'strong' ? 0.8 : rel.strength === 'weak' ? 0.3 : 0.5;
        
        // Check if this connection involves the recently unlocked entity
        const isNewConnection = recentlyUnlockedEntity && 
            (rel.from === recentlyUnlockedEntity || rel.to === recentlyUnlockedEntity);
        
        // Calculate path length for growth animation
        const pathLength = Math.sqrt(dx * dx + dy * dy) * 1.2; // Approximate curved path length
        
        if (isNewConnection) {
            // Apply growth animation to new connections
            path.style.cssText = `
                fill: none;
                stroke: #2ecc71;
                stroke-width: ${strokeWidth + 1}px;
                opacity: 0;
                stroke-dasharray: ${pathLength};
                stroke-dashoffset: ${pathLength};
                filter: drop-shadow(0 0 8px rgba(46, 204, 113, 0.8));
                animation: webGrowth 1.5s ease-out forwards, glowPulse 2s ease-in-out infinite 1.5s;
            `;
            
            // Add stagger delay based on index
            path.style.animationDelay = `${index * 0.2}s, ${index * 0.2 + 1.5}s`;
            
            // After animation, transition to normal state
            setTimeout(() => {
                path.style.stroke = '#4a90e2';
                path.style.strokeWidth = `${strokeWidth}px`;
                path.style.opacity = opacity;
                path.style.strokeDasharray = '8 4';
                path.style.strokeDashoffset = '0';
                path.style.animation = 'dashFlow 2s linear infinite';
                path.style.filter = 'drop-shadow(0 0 3px rgba(74, 144, 226, 0.6))';
            }, 1500 + (index * 200));
        } else {
            // Normal connection line
            path.style.cssText = `
                fill: none;
                stroke: #4a90e2;
                stroke-width: ${strokeWidth}px;
                opacity: ${opacity};
                stroke-dasharray: 8 4;
                stroke-dashoffset: 0;
                animation: dashFlow 2s linear infinite;
                filter: drop-shadow(0 0 3px rgba(74, 144, 226, 0.6));
            `;
        }
        
        svg.appendChild(path);
        
        // If this is a new connection, add particle effects
        if (isNewConnection) {
            setTimeout(() => {
                createParticlesAlongPath(path, rel.from, rel.to);
            }, 500 + (index * 200));
        }
        
        // Add glow effect on hover
        fromChip.addEventListener('mouseenter', () => {
            path.style.stroke = '#2ecc71';
            path.style.opacity = '1';
            path.style.strokeWidth = `${strokeWidth + 1}px`;
        });
        
        fromChip.addEventListener('mouseleave', () => {
            path.style.stroke = '#4a90e2';
            path.style.opacity = opacity;
            path.style.strokeWidth = `${strokeWidth}px`;
        });
        
        toChip.addEventListener('mouseenter', () => {
            path.style.stroke = '#2ecc71';
            path.style.opacity = '1';
            path.style.strokeWidth = `${strokeWidth + 1}px`;
        });
        
        toChip.addEventListener('mouseleave', () => {
            path.style.stroke = '#4a90e2';
            path.style.opacity = opacity;
            path.style.strokeWidth = `${strokeWidth}px`;
        });
    });
}
// Create particle effects that travel along connection paths
function createParticlesAlongPath(pathElement, fromId, toId) {
    const svg = pathElement.parentElement;
    if (!svg) return;
    
    const svgNS = 'http://www.w3.org/2000/svg';
    const pathLength = pathElement.getTotalLength();
    const particleCount = 8;
    const particleDelay = 100; // ms between each particle
    
    // Create multiple particles that follow the path
    for (let i = 0; i < particleCount; i++) {
        setTimeout(() => {
            // Create particle circle
            const particle = document.createElementNS(svgNS, 'circle');
            particle.setAttribute('r', '4');
            particle.setAttribute('fill', '#2ecc71');
            particle.setAttribute('class', 'connection-particle');
            
            // Add glow effect
            particle.style.cssText = `
                filter: drop-shadow(0 0 8px rgba(46, 204, 113, 1));
                opacity: 0;
            `;
            
            svg.appendChild(particle);
            
            // Animate particle along the path
            animateParticleAlongPath(particle, pathElement, pathLength, () => {
                particle.remove();
            });
        }, i * particleDelay);
    }
    
    // Create burst effect at the destination
    setTimeout(() => {
        createDestinationBurst(toId);
    }, (particleCount * particleDelay) + 1000);
}
// Animate a single particle along a path
function animateParticleAlongPath(particle, pathElement, pathLength, onComplete) {
    const duration = 1500; // ms
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-in-out function for smooth motion
        const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const distance = eased * pathLength;
        const point = pathElement.getPointAtLength(distance);
        
        particle.setAttribute('cx', point.x);
        particle.setAttribute('cy', point.y);
        
        // Fade in and out
        if (progress < 0.2) {
            particle.style.opacity = progress / 0.2;
        } else if (progress > 0.8) {
            particle.style.opacity = (1 - progress) / 0.2;
        } else {
            particle.style.opacity = '1';
        }
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            if (onComplete) onComplete();
        }
    }
    
    animate();
}
// Create burst effect at destination chip
function createDestinationBurst(chipId) {
    const chip = document.getElementById(`chip-${chipId}`);
    if (!chip) return;
    
    const rect = chip.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Create burst particles
    const burstCount = 12;
    
    for (let i = 0; i < burstCount; i++) {
        const angle = (i / burstCount) * Math.PI * 2;
        const particle = document.createElement('div');
        
        particle.style.cssText = `
            position: fixed;
            left: ${centerX}px;
            top: ${centerY}px;
            width: 8px;
            height: 8px;
            background: radial-gradient(circle, #2ecc71 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 10000;
            filter: drop-shadow(0 0 4px rgba(46, 204, 113, 0.8));
        `;
        
        document.body.appendChild(particle);
        
        // Animate burst
        const distance = 50 + Math.random() * 30;
        const duration = 800;
        const targetX = centerX + Math.cos(angle) * distance;
        const targetY = centerY + Math.sin(angle) * distance;
        
        particle.animate([
            { 
                transform: 'translate(-50%, -50%) scale(1)',
                opacity: 1,
                left: `${centerX}px`,
                top: `${centerY}px`
            },
            { 
                transform: 'translate(-50%, -50%) scale(0.5)',
                opacity: 0,
                left: `${targetX}px`,
                top: `${targetY}px`
            }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }).onfinish = () => particle.remove();
    }
    
    // Add pulse effect to the chip
    chip.style.animation = 'chipBurstPulse 0.5s ease-out';
    setTimeout(() => {
        chip.style.animation = '';
    }, 500);
}
// Handle click on individual connection chip
function handleConnectionClick(connection) {
    console.log('[Game.js] Connection clicked:', connection);
    
    // Play click sound
    const clickSound = new Audio('https://play.rosebud.ai/assets/start-game.wav.wav?iYmZ');
    clickSound.volume = 0.2;
    clickSound.play().catch(e => console.log('Audio play failed:', e));
    
    // Show connection details
    if (connection.description) {
        showNotification(`${connection.name}: ${connection.description}`, 'info');
    }
    
    // If connection has a URL, open it
    if (connection.url) {
        setTimeout(() => {
            window.open(connection.url, '_blank');
        }, 500);
    }
}
// Handler: Research and deep-dive content
function handleResearchInteraction(faceConfig) {
    console.log('[Game.js] Research interaction triggered', faceConfig);
    
    // Show the search input modal
    const searchModal = document.getElementById('google-search-modal');
    const searchInput = document.getElementById('search-query-input');
    
    if (searchModal && searchInput) {
        searchModal.classList.remove('hidden');
        searchInput.value = '';
        searchInput.focus();
        showNotification('🔍 Enter your search query', 'info');
    } else {
        console.error('[Game.js] Search modal elements not found');
    }
}
// Open Google search with query
function openGoogleSearch(query = '') {
    const searchUrl = query 
        ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
        : 'https://www.google.com';
    
    // Try to open in new window
    const newWindow = window.open(searchUrl, '_blank', 'noopener,noreferrer');
    
    // Check if popup was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Popup was blocked - offer same-tab fallback
        showClickableNotification(
            '🚫 Popup blocked! Click here to open Google search in this tab.',
            () => {
                window.location.href = searchUrl;
            }
        );
        console.warn('[Game.js] Popup blocker prevented opening Google search - fallback offered');
    } else {
        showNotification(query ? `🔍 Searching for "${query}"...` : '🔍 Opening Google search...', 'success');
    }
}
// Handler: Player stats display
function handleStatsInteraction(faceConfig) {
    console.log('[Game.js] Stats interaction triggered', faceConfig);
    
    const statsModal = document.getElementById('player-stats-modal');
    if (statsModal) {
        // Update stats content
        const statsContent = document.getElementById('stats-content');
        if (statsContent) {
            statsContent.innerHTML = `
                <div style="text-align: center; color: #ecf0f1;">
                    <h3 style="color: #4a90e2; margin-bottom: 20px;">Player Statistics</h3>
                    <div style="display: grid; gap: 15px;">
                        <div style="background: rgba(74, 144, 226, 0.2); padding: 15px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.8; margin-bottom: 5px;">Total Score</div>
                            <div style="font-size: 32px; font-weight: bold; color: #2ecc71;">${playerScore}</div>
                        </div>
                        <div style="background: rgba(74, 144, 226, 0.2); padding: 15px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.8; margin-bottom: 5px;">Entities Unlocked</div>
                            <div style="font-size: 32px; font-weight: bold; color: #f39c12;">${unlockedEntities.size}</div>
                        </div>
                        <div style="background: rgba(74, 144, 226, 0.2); padding: 15px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.8; margin-bottom: 5px;">Progress</div>
                            <div style="font-size: 24px; font-weight: bold; color: #9b59b6;">${Math.round((unlockedEntities.size / 11) * 100)}%</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        statsModal.classList.remove('hidden');
        showNotification('📊 Viewing player stats...', 'info');
    } else {
        console.error('[Game.js] Player stats modal not found');
    }
}
// Handler: Puzzle and challenge interactions
function handlePuzzleInteraction(faceConfig) {
    console.log('[Game.js] Puzzle interaction triggered', faceConfig);
    
    // Play lock sound effect
    const lockedSound = new Audio('https://play.rosebud.ai/assets/57645__jianhicks__20-lock1.wav?3GFD');
    lockedSound.volume = 0.4;
    lockedSound.play().catch(e => console.log('Audio play failed:', e));
    
    showNotification('🔒 This face is locked! Answer trivia questions to unlock new features.', 'info');
}
// Handler: Info and decorative faces
function handleInfoInteraction(faceConfig) {
    console.log('[Game.js] Info face clicked:', faceConfig.description);
    if (faceConfig.description) {
        showNotification(`ℹ️ ${faceConfig.description}`, 'info');
    }
}
// Show notification toast
function showNotification(message, type = 'info') {
    const existingToast = document.getElementById('notification-toast');
    if (existingToast) existingToast.remove();
    const toast = document.createElement('div');
    toast.id = 'notification-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background-color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
// Show clickable notification toast with callback
function showClickableNotification(message, onClick) {
    const existingToast = document.getElementById('notification-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.id = 'notification-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #f39c12;
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease-out;
        cursor: pointer;
        transition: all 0.2s ease;
    `;
    
    // Add hover effect
    toast.addEventListener('mouseenter', () => {
        toast.style.backgroundColor = '#e67e22';
        toast.style.transform = 'translateX(-50%) scale(1.05)';
    });
    
    toast.addEventListener('mouseleave', () => {
        toast.style.backgroundColor = '#f39c12';
        toast.style.transform = 'translateX(-50%) scale(1)';
    });
    
    // Add click handler
    toast.addEventListener('click', () => {
        onClick();
        toast.remove();
    });
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds (longer than normal notification)
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
// Show trivia question in modal
function showTriviaQuestion(faceConfig) {
    const modal = document.getElementById('trivia-modal');
    const questionDiv = document.getElementById('trivia-question');
    const answersDiv = document.getElementById('trivia-answers');
    
    if (!modal || !questionDiv || !answersDiv) return;
    
    const data = currentData?.data || {};
    const questions = data.questions || [];
    const question = questions.find(q => q.id === faceConfig.questionId);
    
    if (!question) {
        console.warn('[Game.js] No question found for ID:', faceConfig.questionId);
        showNotification('❓ No trivia data loaded. Click "LOAD DATA" button to load questions!', 'error');
        return;
    }
    
    // Store the question for use when checking answers
    modal.dataset.currentQuestionId = faceConfig.questionId;
    // Set question text
    questionDiv.textContent = question.question;
    // Clear previous answers
    answersDiv.innerHTML = '';
    // Create answer buttons
    const options = question.options || {};
    Object.keys(options).forEach(key => {
        const button = document.createElement('button');
        button.textContent = `${key}: ${options[key]}`;
        button.style.cssText = `
            background-color: #34495e;
            color: white;
            border: 2px solid #4a90e2;
            padding: 15px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#4a90e2';
            button.style.transform = 'scale(1.05)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#34495e';
            button.style.transform = 'scale(1)';
        });
        button.addEventListener('click', () => {
            checkAnswer(key, question.correctAnswer, button, answersDiv);
        });
        answersDiv.appendChild(button);
    });
    modal.classList.remove('hidden');
}
// Check trivia answer
function checkAnswer(selected, correct, button, answersDiv) {
    const isCorrect = selected === correct;
    
    // Disable all buttons
    const allButtons = answersDiv.querySelectorAll('button');
    allButtons.forEach(btn => btn.style.pointerEvents = 'none');
    
    if (isCorrect) {
        button.style.backgroundColor = '#27ae60';
        button.style.borderColor = '#2ecc71';
        
        const correctSound = new Audio('https://play.rosebud.ai/assets/correct-answer.wav.wav?Vvzj');
        correctSound.volume = 0.4;
        correctSound.play().catch(e => console.log('Audio play failed:', e));
        
        // Award points
        const pointsEarned = 100;
        playerScore += pointsEarned;
        saveProgress();
        
        // Check if this question unlocks any entities
        const modal = document.getElementById('trivia-modal');
        const questionId = modal?.dataset.currentQuestionId;
        const data = currentData?.data || {};
        const question = data.questions?.find(q => q.id === questionId);
        
        // Handle entity unlocks
        if (question?.unlocksEntity) {
            const entityId = question.unlocksEntity;
            const wasNewlyUnlocked = unlockEntity(entityId);
            
            if (wasNewlyUnlocked) {
                // Find entity name for notification
                const connections = data.connections || [];
                const entity = connections.find(c => c.id === entityId);
                const entityName = entity?.name || 'New entity';
                
                setTimeout(() => {
                    showUnlockNotification(entityName, pointsEarned);
                    
                    // If connections board is open, trigger web growth animation
                    const connectionsModal = document.getElementById('connections-board-modal');
                    if (connectionsModal && !connectionsModal.classList.contains('hidden')) {
                        setTimeout(() => {
                            triggerWebGrowthAnimation(entityId);
                        }, 1000);
                    }
                }, 1500);
            } else {
                showNotification(`✅ Correct! +${pointsEarned} points | Score: ${playerScore}`, 'success');
            }
        } else {
            showNotification(`✅ Correct! +${pointsEarned} points | Score: ${playerScore}`, 'success');
        }
        
        // Trigger celebration confetti
        triggerCelebration();
        
        setTimeout(() => {
            document.getElementById('trivia-modal').classList.add('hidden');
        }, 2000);
    } else {
        button.style.backgroundColor = '#c0392b';
        button.style.borderColor = '#e74c3c';
        
        const incorrectSound = new Audio('https://play.rosebud.ai/assets/incorrect-answer.wav.wav?iP62');
        incorrectSound.volume = 0.4;
        incorrectSound.play().catch(e => console.log('Audio play failed:', e));
        // Highlight correct answer
        allButtons.forEach((btn, index) => {
            const optionKey = String.fromCharCode(65 + index); // A, B, C, D
            if (optionKey === correct) {
                btn.style.backgroundColor = '#27ae60';
                btn.style.borderColor = '#2ecc71';
            }
        });
        setTimeout(() => {
            document.getElementById('trivia-modal').classList.add('hidden');
        }, 3000);
    }
}
// Show special unlock notification with animation
function showUnlockNotification(entityName, pointsEarned) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.8);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px 40px;
        border-radius: 15px;
        font-size: 20px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 10px 40px rgba(102, 126, 234, 0.6);
        text-align: center;
        animation: unlockPop 0.5s ease-out forwards;
        border: 3px solid rgba(255, 255, 255, 0.3);
    `;
    
    notification.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
        <div style="font-size: 24px; margin-bottom: 10px;">NEW UNLOCK!</div>
        <div style="font-size: 18px; color: #ffd700; margin-bottom: 5px;">${entityName}</div>
        <div style="font-size: 14px; opacity: 0.9;">+${pointsEarned} points | Score: ${playerScore}</div>
        <div style="font-size: 12px; margin-top: 10px; opacity: 0.8;">Check the Connections Board!</div>
    `;
    
    // Add animation keyframes
    if (!document.getElementById('unlock-animation-styles')) {
        const style = document.createElement('style');
        style.id = 'unlock-animation-styles';
        style.textContent = `
            @keyframes unlockPop {
                0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.1); }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.5s ease-out';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}
// Trigger celebration particle effects
function triggerCelebration() {
    // Main confetti burst
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4a90e2', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6']
    });
    // Side bursts
    setTimeout(() => {
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.7 }
        });
        confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.7 }
        });
    }, 200);
    // Falling stars effect
    setTimeout(() => {
        const duration = 1500;
        const animationEnd = Date.now() + duration;
        
        const frame = () => {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#ffd700', '#ffed4e']
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#ffd700', '#ffed4e']
            });
            if (Date.now() < animationEnd) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    }, 400);
}
// Handle window resize
function onWindowResize() {
    if (!camera || !renderer) return;
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}
// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Game.js] Initializing Three.js game scene');
    
    // Load player progress
    loadProgress();
    
    initScene();
    animate();
    // Add event listeners
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        canvas.addEventListener('click', onCanvasClick);
        canvas.addEventListener('mousemove', onCanvasMouseMove);
    }
    window.addEventListener('resize', onWindowResize);
    // Close trivia modal button
    const closeButton = document.getElementById('close-trivia-button');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            document.getElementById('trivia-modal').classList.add('hidden');
        });
    }
    
    // Close TV display modal button
    const closeTvButton = document.getElementById('close-tv-button');
    if (closeTvButton) {
        closeTvButton.addEventListener('click', () => {
            document.getElementById('tv-display-modal').classList.add('hidden');
        });
    }
    
    // Close TV modal when clicking outside
    const tvModal = document.getElementById('tv-display-modal');
    if (tvModal) {
        tvModal.addEventListener('click', (e) => {
            if (e.target === tvModal) {
                tvModal.classList.add('hidden');
            }
        });
    }
    
    // Add hover effect to close button
    if (closeTvButton) {
        closeTvButton.addEventListener('mouseenter', () => {
            closeTvButton.style.backgroundColor = '#e74c3c';
            closeTvButton.style.color = 'white';
            closeTvButton.style.transform = 'scale(1.1) rotate(90deg)';
        });
        closeTvButton.addEventListener('mouseleave', () => {
            closeTvButton.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            closeTvButton.style.color = '#333';
            closeTvButton.style.transform = 'scale(1) rotate(0deg)';
        });
    }
    
    // Click on TV or image to close the modal
    const tvContainer = document.getElementById('tv-container');
    const retroTv = document.getElementById('retro-tv');
    const tvScreenImage = document.getElementById('tv-screen-image');
    const zoomOutButton = document.getElementById('tv-zoom-out');
    const zoomInButton = document.getElementById('tv-zoom-in');
    const zoomDisplay = document.getElementById('tv-zoom-display');
    const tvChannelButton = document.getElementById('tv-channel-button');
    
    if (tvContainer && zoomOutButton && zoomInButton && zoomDisplay) {
        const baseMaxWidth = parseInt(tvContainer.dataset.baseMaxWidth || '520', 10);
        const minZoom = 0.6;
        const maxZoom = 1.3;
        const zoomStep = 0.1;
        let currentZoom = parseFloat(tvContainer.dataset.initialZoom || '0.8');
        
        const clampZoom = (value) => Math.min(Math.max(value, minZoom), maxZoom);
        
        const applyZoom = () => {
            currentZoom = parseFloat(clampZoom(currentZoom).toFixed(2));
            const newMaxWidth = Math.round(baseMaxWidth * currentZoom);
            tvContainer.style.maxWidth = `${newMaxWidth}px`;
            zoomDisplay.textContent = `Zoom: ${Math.round(currentZoom * 100)}%`;
            
            const disableButton = (button, disabled) => {
                button.disabled = disabled;
                button.style.opacity = disabled ? '0.45' : '1';
                button.style.cursor = disabled ? 'not-allowed' : 'pointer';
            };
            
            disableButton(zoomOutButton, currentZoom <= minZoom);
            disableButton(zoomInButton, currentZoom >= maxZoom);
        };
        
        applyZoom();
        
        const createZoomHandler = (delta) => (event) => {
            event.stopPropagation();
            currentZoom = parseFloat((currentZoom + delta).toFixed(2));
            applyZoom();
        };
        
        zoomOutButton.addEventListener('click', createZoomHandler(-zoomStep));
        zoomInButton.addEventListener('click', createZoomHandler(zoomStep));
    }
    
    if (retroTv) {
        retroTv.style.cursor = 'pointer';
        retroTv.addEventListener('click', (e) => {
            // Don't close if clicking the close button
            if (e.target !== closeTvButton && !closeTvButton?.contains(e.target)) {
                tvModal.classList.add('hidden');
                showNotification('📺 TV display closed', 'info');
            }
        });
    }
    
    if (tvScreenImage) {
        tvScreenImage.style.cursor = 'pointer';
        tvScreenImage.title = 'Click to close';
    }
    
    if (tvScreenImage && tvChannelButton) {
        try {
            const channels = [
                {
                    src: 'https://play.rosebud.ai/assets/Elsinore-Theater.jpg?RTsi',
                    alt: 'Elsinore Theater - Vintage Photo',
                },
                {
                    src: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Elsinore_Theatre_Salem_Oregon.JPG',
                    alt: 'Elsinore Theatre in Salem, Oregon',
                },
            ];
            
            const initialSrc = tvScreenImage.getAttribute('src') || tvScreenImage.src || '';
            let currentChannelIndex = channels.findIndex((channel) => initialSrc.includes(channel.src));
            if (currentChannelIndex === -1) {
                currentChannelIndex = 0;
                tvScreenImage.src = channels[currentChannelIndex].src;
                tvScreenImage.alt = channels[currentChannelIndex].alt;
            }
            
            const applyChannel = (index) => {
                const channel = channels[index];
                tvScreenImage.src = channel.src;
                tvScreenImage.alt = channel.alt;
                tvChannelButton.textContent = `CHANNEL ${index + 1}`;
            };
            
            applyChannel(currentChannelIndex);
            
            tvChannelButton.addEventListener('click', (event) => {
                event.stopPropagation();
                currentChannelIndex = (currentChannelIndex + 1) % channels.length;
                applyChannel(currentChannelIndex);
                showNotification('📺 Channel changed', 'info');
            });
        } catch (error) {
            console.error('[Game.js] TV channel controls failed to initialize:', error);
        }
    }
    
    // ESC key to close modals
    const triviaModal = document.getElementById('trivia-modal');
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close TV modal if open
            if (tvModal && !tvModal.classList.contains('hidden')) {
                tvModal.classList.add('hidden');
                showNotification('📺 TV display closed', 'info');
            }
            // Close trivia modal if open
            else if (triviaModal && !triviaModal.classList.contains('hidden')) {
                triviaModal.classList.add('hidden');
                showNotification('🎮 Trivia closed', 'info');
            }
        }
        
        // Keyboard navigation for trivia answers (A, B, C, D keys)
        if (triviaModal && !triviaModal.classList.contains('hidden')) {
            const key = e.key.toUpperCase();
            if (['A', 'B', 'C', 'D'].includes(key)) {
                const answersDiv = document.getElementById('trivia-answers');
                if (answersDiv) {
                    const buttons = answersDiv.querySelectorAll('button');
                    const buttonIndex = key.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                    
                    if (buttons[buttonIndex] && buttons[buttonIndex].style.pointerEvents !== 'none') {
                        // Visual feedback
                        buttons[buttonIndex].style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            buttons[buttonIndex].style.transform = 'scale(1)';
                        }, 100);
                        
                        // Trigger click
                        buttons[buttonIndex].click();
                    }
                }
            }
        }
    });
    
    // Google Search Modal handlers
    const searchModal = document.getElementById('google-search-modal');
    const searchInput = document.getElementById('search-query-input');
    const closeSearchButton = document.getElementById('close-search-modal-button');
    const cancelSearchButton = document.getElementById('cancel-search-button');
    const submitSearchButton = document.getElementById('submit-search-button');
    
    if (closeSearchButton) {
        closeSearchButton.addEventListener('click', () => {
            searchModal.classList.add('hidden');
        });
    }
    
    if (cancelSearchButton) {
        cancelSearchButton.addEventListener('click', () => {
            searchModal.classList.add('hidden');
        });
    }
    
    if (submitSearchButton && searchInput) {
        submitSearchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            searchModal.classList.add('hidden');
            openGoogleSearch(query);
        });
    }
    
    // Handle Enter key in search input
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                searchModal.classList.add('hidden');
                openGoogleSearch(query);
            }
        });
        
        // Focus styling
        searchInput.addEventListener('focus', () => {
            searchInput.style.borderColor = '#1a73e8';
        });
        
        searchInput.addEventListener('blur', () => {
            searchInput.style.borderColor = '#ddd';
        });
    }
    
    // Close search modal when clicking outside
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                searchModal.classList.add('hidden');
            }
        });
    }
    
    // ESC key to close search modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModal && !searchModal.classList.contains('hidden')) {
            searchModal.classList.add('hidden');
        }
    });
    
    // Connections Board handlers
    const connectionsModal = document.getElementById('connections-board-modal');
    const closeConnectionsButton = document.getElementById('close-connections-button');
    const connectionTabs = document.querySelectorAll('.connection-tab');
    
    if (closeConnectionsButton) {
        closeConnectionsButton.addEventListener('click', () => {
            connectionsModal.classList.add('hidden');
        });
        
        // Hover effect
        closeConnectionsButton.addEventListener('mouseenter', () => {
            closeConnectionsButton.style.backgroundColor = 'rgba(231, 76, 60, 0.3)';
            closeConnectionsButton.style.borderColor = '#e74c3c';
            closeConnectionsButton.style.transform = 'scale(1.1) rotate(90deg)';
        });
        
        closeConnectionsButton.addEventListener('mouseleave', () => {
            closeConnectionsButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            closeConnectionsButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            closeConnectionsButton.style.transform = 'scale(1) rotate(0deg)';
        });
    }
    
    // Category tab filtering
    connectionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            connectionTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Get current connections and filter
            const category = tab.dataset.category;
            const connections = currentData?.data?.connections || [
                { id: 1, name: 'Elsinore Theater', category: 'where', description: 'Historic performing arts venue in Salem, Oregon', unlocked: true },
                { id: 2, name: 'Salem', category: 'where', description: 'Capital city of Oregon', unlocked: true },
                { id: 3, name: 'George Washington', category: 'who', description: 'First President of the United States' },
                { id: 4, name: 'Eiffel Tower', category: 'what', description: 'Iconic iron lattice tower in Paris' },
                { id: 5, name: 'Gustave Eiffel', category: 'who', description: 'Designer of the Eiffel Tower' },
                { id: 6, name: 'Gold (Au)', category: 'what', description: 'Precious metal, chemical element' },
                { id: 7, name: 'Canberra', category: 'where', description: 'Capital of Australia' },
                { id: 8, name: 'World War II', category: 'what', description: 'Global conflict 1939-1945' },
                { id: 9, name: 'Paris', category: 'where', description: 'Capital city of France' },
                { id: 10, name: 'Australia', category: 'where', description: 'Country and continent' },
                { id: 11, name: 'Clark Gable', category: 'who', description: 'American film actor who performed at Elsinore Theater in the 1920s', unlocked: true },
            ];
            
            // Apply unlock status
            connections.forEach(conn => {
                if (conn.unlocked === undefined) {
                    conn.unlocked = unlockedEntities.has(conn.id);
                }
            });
            
            const relationships = currentData?.data?.relationships || [
                { from: 1, to: 2, strength: 'strong' },
                { from: 4, to: 5, strength: 'strong' },
                { from: 4, to: 9, strength: 'strong' },
                { from: 7, to: 10, strength: 'strong' },
                { from: 3, to: 8, strength: 'medium' },
                { from: 2, to: 9, strength: 'weak' },
                { from: 11, to: 1, strength: 'strong' },
                { from: 11, to: 2, strength: 'medium' },
            ];
            
            renderConnectionsGraph(connections, relationships, category);
        });
    });
    
    // Close connections modal when clicking outside
    if (connectionsModal) {
        connectionsModal.addEventListener('click', (e) => {
            if (e.target === connectionsModal) {
                connectionsModal.classList.add('hidden');
            }
        });
    }
    
    // Player Stats Modal handlers
    const statsModal = document.getElementById('player-stats-modal');
    const closeStatsButton = document.getElementById('close-stats-button');
    
    if (closeStatsButton) {
        closeStatsButton.addEventListener('click', () => {
            statsModal.classList.add('hidden');
        });
        
        // Hover effect
        closeStatsButton.addEventListener('mouseenter', () => {
            closeStatsButton.style.backgroundColor = 'rgba(231, 76, 60, 0.3)';
            closeStatsButton.style.borderColor = '#e74c3c';
            closeStatsButton.style.transform = 'scale(1.1) rotate(90deg)';
        });
        
        closeStatsButton.addEventListener('mouseleave', () => {
            closeStatsButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            closeStatsButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            closeStatsButton.style.transform = 'scale(1) rotate(0deg)';
        });
    }
    
    // Close stats modal when clicking outside
    if (statsModal) {
        statsModal.addEventListener('click', (e) => {
            if (e.target === statsModal) {
                statsModal.classList.add('hidden');
            }
        });
    }
    
    console.log('[Game.js] Game module initialized successfully');
});
