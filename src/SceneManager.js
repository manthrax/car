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

        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(10, 10, 5);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

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
        this.renderer.render(this.scene, this.camera);
        if (this.stats) this.stats.update();
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
