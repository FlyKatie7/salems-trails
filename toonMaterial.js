// Trivia Cube Configuration Module
// This module contains the cube face configuration and texture mappings
// Define the order of cube sides as they map to Three.js material array indices
export const CUBE_SIDES = ['right', 'left', 'top', 'bottom', 'front', 'back'];
// Faceplate texture URLs mapped to different cube face types
export const FACEPLATE_URLS = {
    default: 'https://play.rosebud.ai/assets/cubeface_base_sg01.png?qEpq',
    base: 'https://play.rosebud.ai/assets/cubefaceplate.png?ygg2',
    plate: 'https://play.rosebud.ai/assets/cubefaceplate.png?ygg2',
    chip: 'https://play.rosebud.ai/assets/cubefaceplate_chip_sg01.png?pbA2',
    lock: 'https://play.rosebud.ai/assets/cubefaceplate_lock_sg01.png?Eefl',
    eye: 'https://play.rosebud.ai/assets/cubefaceplate_eye_sg01.png?Uz7D',
    link: 'https://play.rosebud.ai/assets/cubefaceplate_link_sg01.png?UtNV',
    magnifying: 'https://play.rosebud.ai/assets/cubefaceplate_mg_sg01.png?0L5j'
};
// Hardcoded cube configuration with default face mappings
const HARDCODED_CUBE_CONFIG = {
    size: 2,
    faces: [
        {
            id: 'face-right',
            side: 'right',
            icon: 'magnifier',
            behaviorType: 'research',
            textureUrl: FACEPLATE_URLS.magnifying,
            questionId: 'q1',
            contentType: 'interactive',
            description: 'Magnifying glass face - click to examine'
        },
        {
            id: 'face-left',
            side: 'left',
            icon: 'chip',
            behaviorType: 'stats',
            textureUrl: FACEPLATE_URLS.chip,
            contentType: 'action',
            description: 'Chip face - view player stats'
        },
        {
            id: 'face-top',
            side: 'top',
            icon: 'eye',
            behaviorType: 'view',
            textureUrl: FACEPLATE_URLS.eye,
            action: 'openChat',
            contentType: 'action',
            description: 'Eye face - click to open chat'
        },
        {
            id: 'face-bottom',
            side: 'bottom',
            icon: 'lock',
            behaviorType: 'puzzle',
            textureUrl: FACEPLATE_URLS.lock,
            contentType: 'decorative',
            description: 'Lock face - secure knowledge'
        },
        {
            id: 'face-front',
            side: 'front',
            icon: 'link',
            behaviorType: 'connections',
            textureUrl: FACEPLATE_URLS.link,
            linkUrl: 'https://en.wikipedia.org/wiki/Trivia',
            contentType: 'link',
            description: 'Link face - click to learn more'
        },
        {
            id: 'face-back',
            side: 'back',
            icon: 'base',
            behaviorType: 'trivia',
            textureUrl: FACEPLATE_URLS.base,
            questionId: 'q3',
            contentType: 'interactive',
            description: 'Question mark face - test your knowledge about the theater'
        }
    ],
    groundConfig: {
        enabled: false,
        color: 0x404040,
        size: 10
    }
};
// Export the main configuration as default export
export default HARDCODED_CUBE_CONFIG;