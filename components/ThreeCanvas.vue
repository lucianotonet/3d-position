<template>
    <div ref="threeCanvasContainer" style="height: 100vh; width: 100vw;">
        <!-- Esse div irá conter o canvas de Three.js -->
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import * as THREE from 'three';

const threeCanvasContainer = ref(null);

onMounted(() => {
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        45, 
        window.innerWidth / window.innerHeight,
        0.1,
        1000 
    );

    
    camera.position.set(0, 1, 10);
    camera.lookAt(0, 0, 0);

    
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        logarithmicDepthBuffer: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff);
    renderer.setPixelRatio(window.devicePixelRatio); 
    threeCanvasContainer.value.appendChild(renderer.domElement);

    
    const floorSize = 100;
    const gridHelper = new THREE.GridHelper(floorSize, 200, 0x000000, 0x3d3d3d); 
    scene.add(gridHelper);

    
    const ambientLight = new THREE.AmbientLight(0x3d3d3d, 0.3);
    scene.add(ambientLight);

    
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
    });
});
</script>

<style scoped>
/* Estilos opcionais */
</style>
