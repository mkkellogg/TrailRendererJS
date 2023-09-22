import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { TrailRenderer } from './TrailRenderer.js';

const TrailTypes = Object.freeze({
    Basic : 1,
    Textured : 2
});

const TrailShapes = Object.freeze({
    Plane : 1,
    Star : 2,
    Circle : 3
});

let screenWidth, screenHeight;
let scene, gui, renderer, rendererContainer;
let camera, pointLight, ambientLight, controls, stats;
let options;
let starPoints, circlePoints, planePoints;
let trailTarget;
let trailHeadGeometry, trail, lastTrailUpdateTime, lastTrailResetTime;
let trailMaterial, baseTrailMaterial, texturedTrailMaterial;

window.addEventListener("load", function load(event) {
    window.removeEventListener("load", load, false);
    init();
}, false);

function init() {
    lastTrailUpdateTime = performance.now();
    lastTrailResetTime = performance.now();
    getScreenDimensions();
    initTrailOptions();
    initScene();
    initGUI();
    initListeners();
    initLights();
    initSceneGeometry(function() {
        initTrailRenderers(function() {
            initRenderer();
            initControls();
            initStats();
            animate();
        });
    });
}

function initTrailOptions() {
     options = {
        headRed : 1.0,
        headGreen : 0.0,
        headBlue : 0.0,
        headAlpha : 0.75,
        tailRed : 0.0,
        tailGreen : 1.0,
        tailBlue : 1.0,
        tailAlpha : 0.35,
        trailLength : 300,
        trailType : TrailTypes.Textured,
        trailShape : TrailShapes.Plane,
        textureTileFactorS : 10.0,
        textureTileFactorT : 0.8,
        dragTexture : false,
        depthWrite : false,
        pauseSim : false
    };
}

function initGUI() {
    gui = new dat.GUI();  

    gui.add(options, 'trailType', {Basic: TrailTypes.Basic, Textured: TrailTypes.Textured}).name("Trail type").onChange(function() {
        options.trailType = parseInt(options.trailType);
        updateTrailType();
    });

    gui.add(options, 'trailShape', { 
        Plane: TrailShapes.Plane, 
        Star: TrailShapes.Star, 
        Circle: TrailShapes.Circle 
    }).name("Trail shape").onChange(function() {
        options.trailShape = parseInt(options.trailShape);
        updateTrailShape();
    });

    gui.add(options, "trailLength", 0, 1000).name("Trail length").onChange(updateTrailLength);    
    gui.add(options, 'depthWrite').name("Depth write").onChange(updateTrailDepthWrite);
    gui.add(options, 'pauseSim').name("Pause simulation");
    
    const headColor = gui.addFolder("Head color");
    headColor.add(options, "headRed", 0.0, 1.0, 0.025).name("Red").onChange(updateTrailColors);
    headColor.add(options, "headGreen", 0.0, 1.0, 0.025).name("Green").onChange(updateTrailColors);
    headColor.add(options, "headBlue", 0.0, 1.0, 0.025).name("Blue").onChange(updateTrailColors);
    headColor.add(options, "headAlpha", 0.0, 1.0, 0.025).name("Alpha").onChange(updateTrailColors);

    const tailColor = gui.addFolder("Tail color");
    tailColor.add(options, "tailRed", 0.0, 1.0, 0.025).name("Red").onChange(updateTrailColors);
    tailColor.add(options, "tailGreen", 0.0, 1.0, 0.025).name("Green").onChange(updateTrailColors);
    tailColor.add(options, "tailBlue", 0.0, 1.0, 0.025).name("Blue").onChange(updateTrailColors);
    tailColor.add(options, "tailAlpha", 0.0, 1.0, 0.025).name("Alpha").onChange(updateTrailColors);

    const textureOptions = gui.addFolder("Texture options");
    textureOptions.add(options, "textureTileFactorS", 0, 25).name("Texture Tile S").onChange(updateTrailTextureTileSize);
    textureOptions.add(options, "textureTileFactorT", 0, 25).name("Texture Tile T").onChange(updateTrailTextureTileSize);
    textureOptions.add(options, 'dragTexture').name("Drag Texture").onChange(updateTrailTextureDrag);

    gui.domElement.parentNode.style.zIndex = 100;
}

function initListeners() {
    window.addEventListener('resize', onWindowResize, false);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(screenWidth, screenHeight);
    renderer.setClearColor(0x000000);
    renderer.sortObjects = false;
    rendererContainer = document.getElementById('renderingContainer');
    rendererContainer.appendChild(renderer.domElement);
}

function initLights() {
    ambientLight = new THREE.AmbientLight(0x777777);
    scene.add(ambientLight);
    pointLight = new THREE.DirectionalLight(0xFFFFFF, 2);
    pointLight.position.set(5, 2, 5);
    scene.add(pointLight);
}

function initSceneGeometry(onFinished) {
    initTrailHeadGeometries();
    initTrailTarget();
    if(onFinished) {
        onFinished();
    }
}

function initTrailHeadGeometries() {
    planePoints = [];
    planePoints.push(new THREE.Vector3(-14.0, 4.0, 0.0), new THREE.Vector3(0.0, 4.0, 0.0), new THREE.Vector3(14.0, 4.0, 0.0));

    circlePoints = [];
    const twoPI = Math.PI * 2;
    let index = 0;
    const scale = 10.0;
    const inc = twoPI / 32.0;

    for (let i = 0; i <= twoPI + inc; i+= inc)  {
        const vector = new THREE.Vector3();
        vector.set(Math.cos(i) * scale, Math.sin(i) * scale, 0);
        circlePoints[ index ] = vector;
        index++;
    }

    starPoints = [];
    starPoints.push(new THREE.Vector3(0,  16));
    starPoints.push(new THREE.Vector3(4,  4));
    starPoints.push(new THREE.Vector3(16,  4));
    starPoints.push(new THREE.Vector3(8, -4));
    starPoints.push(new THREE.Vector3(12, -16));
    starPoints.push(new THREE.Vector3( 0, -8));
    starPoints.push(new THREE.Vector3(-12, -16));
    starPoints.push(new THREE.Vector3(-8, -4));
    starPoints.push(new THREE.Vector3(-16,  4));
    starPoints.push(new THREE.Vector3(-4,  4));
    starPoints.push(new THREE.Vector3(0,  16));
}

function initTrailTarget() {
    const starShape = new THREE.Shape(starPoints);

    const extrusionSettings = {
        amount: 2, size: 2, height: 1, curveSegments: 3,
        bevelThickness: 1, bevelSize: 2, bevelEnabled: false,
        material: 0, extrudeMaterial: 1
    };

    const starGeometry = new THREE.ExtrudeGeometry(starShape, extrusionSettings);

    const trailTargetMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.3
    });

    trailTarget = new THREE.Mesh(starGeometry, trailTargetMaterial);
    trailTarget.position.set(0, 0, 0);
    trailTarget.scale.multiplyScalar(1);
    trailTarget.receiveShadow = false;
    trailTarget.matrixAutoUpdate = false;
    scene.add(trailTarget);
}

function initTrailRenderers(callback) {
    trail = new TrailRenderer(scene, false);
    baseTrailMaterial = TrailRenderer.createBaseMaterial();
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load("textures/sparkle4.jpg", function(tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        texturedTrailMaterial = TrailRenderer.createTexturedMaterial();
        texturedTrailMaterial.uniforms.trailTexture.value = tex;
        setTrailShapeFromOptions();
        setTrailTypeFromOptions();
        initializeTrail();
        if (callback) {
            callback();
        }
    });
}

function updateTrailLength() {
    initializeTrail();
}

function setTrailTypeFromOptions() {
    switch (options.trailType) {
        case TrailTypes.Basic:
            trailMaterial = baseTrailMaterial;
        break;
        case TrailTypes.Textured:
            trailMaterial = texturedTrailMaterial;
        break;
    }
}

function updateTrailType() {
    setTrailTypeFromOptions();
    initializeTrail();
}

function setTrailShapeFromOptions() {
    switch (options.trailShape) {
        case TrailShapes.Plane:
            trailHeadGeometry = planePoints;
        break;
        case TrailShapes.Star:
            trailHeadGeometry = starPoints;
        break;
        case TrailShapes.Circle:
            trailHeadGeometry = circlePoints;
        break;
    }
}

function updateTrailShape() {
    setTrailShapeFromOptions();
    initializeTrail();
}

function updateTrailTextureDrag() {
    initializeTrail();
}

function updateTrailTextureTileSize() {
    trailMaterial.uniforms.textureTileFactor.value.set(options.textureTileFactorS, options.textureTileFactorT);
}

function updateTrailColors() {
    trailMaterial.uniforms.headColor.value.set(options.headRed, options.headGreen, options.headBlue, options.headAlpha);
    trailMaterial.uniforms.tailColor.value.set(options.tailRed, options.tailGreen, options.tailBlue, options.tailAlpha);
}

function updateTrailDepthWrite() {
    trailMaterial.depthWrite = options.depthWrite;
}

const updateTrailTarget = function updateTrailTarget() {

    const tempQuaternion = new THREE.Quaternion();

    const baseForward = new THREE.Vector3(0, 0, -1);
    const tempForward = new THREE.Vector3();
    const tempUp = new THREE.Vector3();

    const tempRotationMatrix = new THREE.Matrix4();
    const tempTranslationMatrix = new THREE.Matrix4();

    const currentTargetPosition = new THREE.Vector3();
    const lastTargetPosition = new THREE.Vector3();

    const currentDirection = new THREE.Vector3();
    const lastDirection = new THREE.Vector3();

    const lastRotationMatrix = new THREE.Matrix4();

    return function updateTrailTarget(time) {

        if (time - lastTrailUpdateTime > 10) {
            trail.advance();
            lastTrailUpdateTime = time;
        } else {
            trail.updateHead();
        }

        tempRotationMatrix.identity();
        tempTranslationMatrix.identity();

        const scaledTime = time * .001;
        const areaScale = 100;

        lastTargetPosition.copy(currentTargetPosition);

        currentTargetPosition.x = Math.sin(scaledTime) * areaScale;
        currentTargetPosition.y = Math.sin(scaledTime * 1.1) * areaScale;
        currentTargetPosition.z = Math.sin(scaledTime * 1.6) * areaScale;

        currentDirection.copy(currentTargetPosition);
        currentDirection.sub(lastTargetPosition);
        if (currentDirection.lengthSq() < .001) {
            currentDirection.copy(lastDirection);
        } else {
            currentDirection.normalize();
        }

        tempUp.crossVectors(currentDirection, baseForward);
        const angle = baseForward.angleTo(currentDirection);

        if(Math.abs(angle) > .01 && tempUp.lengthSq() > .001) {
            tempQuaternion.setFromUnitVectors(baseForward, currentDirection);
            tempQuaternion.normalize();
            tempRotationMatrix.makeRotationFromQuaternion(tempQuaternion);
            lastRotationMatrix.copy(tempRotationMatrix);
        }
        
        tempTranslationMatrix.makeTranslation (currentTargetPosition.x, currentTargetPosition.y, currentTargetPosition.z);
        tempTranslationMatrix.multiply(tempRotationMatrix);  

        trailTarget.matrix.identity();
        trailTarget.applyMatrix4(tempTranslationMatrix);
        trailTarget.updateMatrixWorld();

        lastDirection.copy(currentDirection);
    }

}();

function initializeTrail() {
    trail.initialize(trailMaterial, Math.floor(options.trailLength), options.dragTexture ? 1.0 : 0.0, 0, trailHeadGeometry, trailTarget);
    updateTrailColors();
    updateTrailTextureTileSize();
    updateTrailDepthWrite();
    trail.activate();
}

function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1.0, 2, 2000);
    scene.add(camera);
    resetCamera();
}

function initStats() {
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.bottom = '0px';
    stats.domElement.style.zIndex = 100;
    rendererContainer.appendChild(stats.domElement);
}

function initControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
}

function onWindowResize() {
    getScreenDimensions();
    renderer.setSize(screenWidth, screenHeight);
    resetCamera();
}

function getScreenDimensions() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
}

function resetCamera() {
    getScreenDimensions();
    camera.aspect = screenWidth / screenHeight;
    camera.updateProjectionMatrix();
    camera.position.set(0, 200, 400);
    camera.lookAt(scene.position);
}

function animate() {
    requestAnimationFrame(animate);
    update();
    render();
}

function update() {
    const time = performance.now();
    if (! options.pauseSim)updateTrailTarget(time);
    controls.update();
    stats.update();
}

function render() {
    renderer.render(scene, camera);
}
