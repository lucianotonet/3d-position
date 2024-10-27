<template>
    <div ref="threeCanvasContainer" class="three-canvas-container">
        <video ref="videoElement" class="face-detection-video" v-show="isVideoVisible"></video>
        <canvas ref="overlayCanvas" class="overlay-canvas" v-show="isFaceMeshVisible"></canvas>
        <div class="debug-container">
            <div class="info-layer">
                <h3>Dados de Posicionamento</h3>
                <p>X: {{ headPosition.x.toFixed(2) }}</p>
                <p>Y: {{ headPosition.y.toFixed(2) }}</p>
                <p>Z: {{ headPosition.z.toFixed(2) }}</p>
                <p>Camera Z: {{ cameraZ.toFixed(2) }}</p>
            </div>
            <div class="config-layer">
                <h4>Configurações de Eixo Z</h4>
                <label>
                    Mínimo:
                    <input type="number" v-model.number="minZ" step="0.01" />
                </label>
                <label>
                    Máximo:
                    <input type="number" v-model.number="maxZ" step="0.01" />
                </label>
            </div>
        </div>
        <div class="control-buttons">
            <button @click="toggleVideoVisibility" class="toggle-button">
                {{ isVideoVisible ? 'Ocultar Câmera' : 'Mostrar Câmera' }}
            </button>
            <button @click="toggleFaceMeshVisibility" class="toggle-button">
                {{ isFaceMeshVisible ? 'Ocultar Mesh' : 'Mostrar Mesh' }}
            </button>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import * as faceapi from 'face-api.js';

const threeCanvasContainer = ref(null);
const videoElement = ref(null);
const overlayCanvas = ref(null);
const headPosition = ref({ x: 0, y: 0, z: 0 });
const isVideoVisible = ref(false);
const isFaceMeshVisible = ref(false);

let scene, camera, renderer, stream;
const initialCameraZ = 20;
const zoomFactor = 30;
const lerpFactor = 0.1; // Fator de interpolação para suavizar o movimento

const minZ = ref(-0.24);
const maxZ = ref(-0.12);
const cameraZ = ref(initialCameraZ);
const targetCameraZ = ref(initialCameraZ);

const isMobile = ref(false);

const initialCameraY = 4;
const yRange = 5; // Ajuste este valor para controlar a sensibilidade do movimento vertical

onMounted(async () => {
    try {
        isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const MODEL_URL = '/models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);

        setupThreeJS();
        await setupVideo();
        setupOverlay();
        animate();

        window.addEventListener('resize', onResize);
    } catch (error) {
        console.error('Error in ThreeCanvas setup:', error);
    }
});

onUnmounted(() => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    window.removeEventListener('resize', onResize);
});

function setupThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 4, initialCameraZ);
    camera.lookAt(0, 4, 0);

    renderer = new THREE.WebGLRenderer({
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

    // Criar retângulo transparente
    const rectangleGeometry = new THREE.BoxGeometry(8, 8, 0.1);
    const rectangleMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    });
    const rectangle = new THREE.Mesh(rectangleGeometry, rectangleMaterial);
    rectangle.position.set(0, 4, -15); // Posicionado à frente da câmera
    scene.add(rectangle);
}

async function setupVideo() {
    const constraints = {
        video: {
            facingMode: isMobile.value ? "user" : "environment",
            width: { ideal: isMobile.value ? 640 : 1280 },
            height: { ideal: isMobile.value ? 480 : 720 }
        }
    };
    
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.value.srcObject = stream;
    await videoElement.value.play();
}

function setupOverlay() {
    const videoWidth = videoElement.value.videoWidth;
    const videoHeight = videoElement.value.videoHeight;
    overlayCanvas.value.width = videoWidth;
    overlayCanvas.value.height = videoHeight;
    
    // Ajustar o tamanho do vídeo e do overlay para dispositivos móveis
    if (isMobile.value) {
        const containerWidth = threeCanvasContainer.value.clientWidth;
        const containerHeight = threeCanvasContainer.value.clientHeight;
        const scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
        
        videoElement.value.style.width = `${videoWidth * scale}px`;
        videoElement.value.style.height = `${videoHeight * scale}px`;
        overlayCanvas.value.style.width = `${videoWidth * scale}px`;
        overlayCanvas.value.style.height = `${videoHeight * scale}px`;
    }
}

async function detectFace() {
    const detection = await faceapi.detectSingleFace(videoElement.value, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

    if (detection) {
        const { x, y, width, height } = detection.detection.box;
        headPosition.value = {
            x: ((x + width / 2) / videoElement.value.videoWidth - 0.5) * 2,
            y: -((y + height / 2) / videoElement.value.videoHeight - 0.5) * 2,
            z: -width / videoElement.value.videoWidth
        };

        updateCameraPosition();

        if (isFaceMeshVisible.value) {
            drawFaceMesh(detection);
        }
    }
}

function drawFaceMesh(detection) {
    const ctx = overlayCanvas.value.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.value.width, overlayCanvas.value.height);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    // Draw face box
    const { x, y, width, height } = detection.detection.box;
    ctx.strokeRect(x, y, width, height);

    // Draw selected landmarks
    const landmarks = detection.landmarks.positions;
    const selectedPoints = [0, 16, 27, 30, 45, 36]; // Exemplo de pontos selecionados
    selectedPoints.forEach(index => {
        ctx.beginPath();
        ctx.arc(landmarks[index].x, landmarks[index].y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
    });
}

function updateCameraPosition() {
    const zRange = maxZ.value - minZ.value;
    const normalizedZ = (headPosition.value.z - minZ.value) / zRange;
    const newZ = initialCameraZ - normalizedZ * zoomFactor;
    targetCameraZ.value = Math.max(initialCameraZ - zoomFactor, Math.min(newZ, initialCameraZ));

    // Ajuste do eixo X da câmera (invertido)
    const xRange = 10; // Ajuste este valor para controlar a sensibilidade do movimento horizontal
    camera.position.x = -headPosition.value.x * xRange; // Note o sinal negativo aqui

    // Ajuste do eixo Y da câmera
    camera.position.y = initialCameraY + headPosition.value.y * yRange;
}

function animate() {
    requestAnimationFrame(animate);
    detectFace();
    
    // Interpolar suavemente entre a posição atual e a posição alvo
    cameraZ.value = THREE.MathUtils.lerp(cameraZ.value, targetCameraZ.value, lerpFactor);
    camera.position.z = cameraZ.value;

    // Atualizar a matriz de projeção da câmera após modificar sua posição
    camera.updateProjectionMatrix();
    
    // Atualizar o ponto de mira da câmera para manter o foco no centro da cena
    // camera.lookAt(0, camera.position.y, 0);
    
    renderer.render(scene, camera);
}

function onResize() {
    const { clientWidth, clientHeight } = threeCanvasContainer.value;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
}

function toggleVideoVisibility() {
    isVideoVisible.value = !isVideoVisible.value;
}

function toggleFaceMeshVisibility() {
    isFaceMeshVisible.value = !isFaceMeshVisible.value;
}

// Observar mudanças nos valores de minZ e maxZ
watch([minZ, maxZ], () => {
    updateCameraPosition();
});
</script>

<style scoped>
.three-canvas-container {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}

.face-detection-video,
.overlay-canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.debug-container {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.info-layer,
.config-layer {
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
}

.info-layer h3,
.config-layer h4 {
    margin-top: 0;
    margin-bottom: 10px;
}

.info-layer p,
.config-layer label {
    margin: 5px 0;
}

.toggle-button {
    padding: 10px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
}

.toggle-button:hover {
    background-color: #0056b3;
}

.control-buttons {
    position: absolute;
    bottom: 10px;
    left: 10px;
    display: flex;
    gap: 10px;
}

.toggle-button {
    padding: 10px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
}

.toggle-button:hover {
    background-color: #0056b3;
}
</style>
