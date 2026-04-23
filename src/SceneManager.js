import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

export default class SceneManager {
    constructor() {
        this.container = document.getElementById('container');
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.stats = null;
        this.clock = new THREE.Clock();
    }

    async init() {
        this.scene.background = new THREE.Color(0x0a0a0c);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);
        this.camera.position.set(4, 4, 4);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = .25;
        this.controls.maxDistance = 200;
        this.controls.enableZoom = false; // Disable default zoom

        this.desiredDistance = 15;
        window.addEventListener('wheel', (e) => {
            this.desiredDistance += e.deltaY * 0.01;
            this.desiredDistance = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, this.desiredDistance));
        }, { passive: false });

        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.dirLight.position.set(100, 200, 50);
        this.dirLight.castShadow = true;
        
        // Optimize shadow frustum for large world
        this.dirLight.shadow.camera.top = 200;
        this.dirLight.shadow.camera.bottom = -200;
        this.dirLight.shadow.camera.left = -200;
        this.dirLight.shadow.camera.right = 200;
        this.dirLight.shadow.camera.near = 1;
        this.dirLight.shadow.camera.far = 500;
        
        // High resolution shadow map
        this.dirLight.shadow.mapSize.set(2048, 2048);
        this.dirLight.shadow.bias = -0.0005;
        
        this.scene.add(this.dirLight);

        // Load Environment Map
        const rgbeLoader = new RGBELoader();
        try {
            const envMap = await rgbeLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr');
            envMap.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.environment = envMap;
            this.scene.background = envMap;
            this.scene.backgroundBlurriness = 0.5;
        } catch (e) {
            console.warn('Failed to load HDR, using fallback lighting:', e);
            this.scene.background = new THREE.Color(0x0a0a0c);
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
            this.scene.add(hemiLight);
        }

        this.stats = new Stats();
        this.container.appendChild(this.stats.dom);

        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.controls.update();
        
        // Update directional light to follow the car/target
        if (this.dirLight) {
            const offset = new THREE.Vector3(100, 200, 50);
            this.dirLight.position.copy(this.controls.target).add(offset);
            this.dirLight.target.position.copy(this.controls.target);
            this.dirLight.target.updateMatrixWorld();
        }

        this.renderer.render(this.scene, this.camera);
        
        if (this.stats) {
            this.stats.update();
            
            // Auto-hide stats if FPS is stable
            const time = performance.now();
            if (this.lastFrameTime) {
                const dt = time - this.lastFrameTime;
                if (!this.fpsHistory) this.fpsHistory = [];
                this.fpsHistory.push(dt);
                if (this.fpsHistory.length > 100) this.fpsHistory.shift();

                if (this.fpsHistory.length === 100) {
                    const isStable = this.fpsHistory.every(f => f < 18); // Stable ~60fps
                    this.stats.dom.style.transition = 'opacity 0.5s';
                    this.stats.dom.style.opacity = isStable ? '0' : '1';
                    this.stats.dom.style.pointerEvents = isStable ? 'none' : 'auto';
                }
            }
            this.lastFrameTime = time;
        }
    }

    dispose() {
        this.renderer.dispose();
        if (this.container && this.renderer.domElement) {
            this.container.removeChild(this.renderer.domElement);
        }
        if (this.stats && this.stats.dom) {
            this.stats.dom.remove();
        }
        // Basic scene cleanup
        this.scene.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        console.log('Scene Manager Disposed');
    }
}
