<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { WIDTH, HEIGHT } from './engine';
    export let pose = { x: -950, y: -330, heading: 180, yaw: 0 };
    export let path: [number, number][] = [];
    export let map = '2024';
    export let showTrail = true;
    export let showSensors = false;
    export let placing = false;
    const dispatch = createEventDispatcher();
    let host: HTMLDivElement,
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera,
        controls: OrbitControls,
        robot: THREE.Group,
        trail: THREE.Line,
        mat: THREE.Mesh,
        markers: THREE.Group;
    let observer: ResizeObserver,
        frame = 0,
        loadedMap = '',
        oldLength = -1,
        loadingId = 0,
        disposed = false,
        error = '';
    const textures: THREE.Texture[] = [];
    export function overhead() {
        camera?.position.set(0, 2450, 1);
        controls?.target.set(0, 0, 0);
        controls?.update();
    }
    export function home() {
        camera?.position.set(1300, 1900, 2000);
        controls?.target.set(0, 0, 0);
        controls?.update();
    }
    const material = (color: string) =>
        new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.12 });
    function box(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return mesh;
    }
    async function setMap(value: string) {
        loadedMap = value;
        const request = ++loadingId;
        if (value === 'practice') {
            const c = document.createElement('canvas');
            c.width = 1600;
            c.height = 800;
            const ctx = c.getContext('2d')!;
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.strokeStyle = '#dae2eb';
            ctx.lineWidth = 2;
            for (let x = 0; x < c.width; x += 80) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, c.height);
                ctx.stroke();
            }
            for (let y = 0; y < c.height; y += 80) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(c.width, y);
                ctx.stroke();
            }
            ctx.strokeStyle = '#202c38';
            ctx.lineWidth = 18;
            ctx.strokeRect(230, 180, 1150, 430);
            ctx.fillStyle = '#2185e5';
            ctx.fillRect(640, 155, 80, 60);
            ctx.fillStyle = '#ee3e54';
            ctx.fillRect(1100, 580, 80, 65);
            applyTexture(new THREE.CanvasTexture(c), c);
            return;
        }
        try {
            const img = new Image();
            img.src = '/maps/FLL' + value + '.jpg';
            await img.decode();
            if (disposed || request !== loadingId) return;
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            c.getContext('2d')!.drawImage(img, 0, 0);
            applyTexture(new THREE.CanvasTexture(c), c);
        } catch (e) {
            dispatch('error', 'The field image could not be loaded. Choose another field.');
        }
    }
    function applyTexture(texture: THREE.Texture, c: HTMLCanvasElement) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        textures.push(texture);
        const m = mat.material as THREE.MeshStandardMaterial;
        m.map = texture;
        m.needsUpdate = true;
        dispatch('mapready', c);
    }
    onMount(() => {
        try {
            scene = new THREE.Scene();
            scene.background = new THREE.Color('#162437');
            scene.fog = new THREE.Fog('#162437', 4000, 8000);
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.1;
            host.appendChild(renderer.domElement);
            renderer.domElement.setAttribute('aria-label', '3D robot and competition field');
            camera = new THREE.PerspectiveCamera(43, 1, 10, 14000);
            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.maxPolarAngle = Math.PI / 2.1;
            controls.minDistance = 500;
            controls.maxDistance = 5000;
            home();
            scene.add(new THREE.HemisphereLight(0xe9f4ff, 0x35475d, 2.5));
            const light = new THREE.DirectionalLight(0xfff5e5, 3.8);
            light.position.set(-800, 2200, 900);
            light.castShadow = true;
            light.shadow.mapSize.set(2048, 2048);
            Object.assign(light.shadow.camera, {
                left: -1700,
                right: 1700,
                top: 1700,
                bottom: -1700,
                near: 100,
                far: 5000
            });
            light.shadow.bias = -0.0005;
            scene.add(light);
            box(0, -48, 0, WIDTH + 95, 72, HEIGHT + 95, '#2d3e52');
            mat = new THREE.Mesh(
                new THREE.PlaneGeometry(WIDTH, HEIGHT),
                new THREE.MeshStandardMaterial({ roughness: 0.95 })
            );
            mat.rotation.x = -Math.PI / 2;
            mat.position.y = -10;
            mat.receiveShadow = true;
            scene.add(mat);
            box(0, 29, -HEIGHT / 2 - 13, WIDTH + 52, 78, 26, '#536276');
            box(0, 29, HEIGHT / 2 + 13, WIDTH + 52, 78, 26, '#536276');
            box(-WIDTH / 2 - 13, 29, 0, 26, 78, HEIGHT, '#536276');
            box(WIDTH / 2 + 13, 29, 0, 26, 78, HEIGHT, '#536276');
            const ground = new THREE.Mesh(
                new THREE.PlaneGeometry(20000, 20000),
                material('#162437')
            );
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -90;
            ground.receiveShadow = true;
            scene.add(ground);
            robot = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(93, 100, 95, 64),
                material('#ffd346')
            );
            body.position.y = 48;
            body.castShadow = true;
            body.receiveShadow = true;
            robot.add(body);
            const lid = new THREE.Mesh(
                new THREE.CylinderGeometry(82, 82, 5, 64),
                material('#fff9dd')
            );
            lid.position.y = 98;
            robot.add(lid);
            const band = new THREE.Mesh(
                new THREE.CylinderGeometry(101, 101, 16, 64),
                material('#203346')
            );
            band.position.y = 20;
            robot.add(band);
            const front = new THREE.Mesh(new THREE.ConeGeometry(15, 38, 3), material('#203346'));
            front.rotation.x = -Math.PI / 2;
            front.position.set(0, 104, -42);
            robot.add(front);
            markers = new THREE.Group();
            for (const x of [-45, 45]) {
                const sensor = new THREE.Mesh(
                    new THREE.SphereGeometry(7),
                    new THREE.MeshBasicMaterial({ color: '#21e6e0' })
                );
                sensor.position.set(x, 6, -100);
                markers.add(sensor);
            }
            robot.add(markers);
            scene.add(robot);
            const buffer = new Float32Array(15000 * 3),
                geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3));
            geometry.setDrawRange(0, 0);
            trail = new THREE.Line(
                geometry,
                new THREE.LineBasicMaterial({ color: '#ffce40', transparent: true, opacity: 0.95 })
            );
            trail.frustumCulled = false;
            scene.add(trail);
            observer = new ResizeObserver(() => {
                const w = host.clientWidth,
                    h = host.clientHeight;
                if (!w || !h) return;
                renderer.setSize(w, h);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            });
            observer.observe(host);
            const animate = () => {
                frame = requestAnimationFrame(animate);
                robot.position.set(pose.x, 0, -pose.y);
                robot.rotation.y = (-pose.heading * Math.PI) / 180;
                markers.visible = showSensors;
                trail.visible = showTrail;
                if (oldLength !== path.length) {
                    oldLength = path.length;
                    const arr = trail.geometry.attributes.position.array as Float32Array;
                    path.slice(-15000).forEach(([x, y], i) => {
                        arr[i * 3] = x;
                        arr[i * 3 + 1] = 2;
                        arr[i * 3 + 2] = -y;
                    });
                    trail.geometry.attributes.position.needsUpdate = true;
                    trail.geometry.setDrawRange(0, Math.min(path.length, 15000));
                }
                controls.enabled = !placing;
                controls.update();
                renderer.render(scene, camera);
            };
            animate();
            setMap(map);
        } catch (e) {
            error = '3D graphics could not start. This preview needs a browser with WebGL enabled.';
        }
    });
    function place(event: PointerEvent) {
        if (!placing || !camera) return;
        const rect = host.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
            new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                (-(event.clientY - rect.top) / rect.height) * 2 + 1
            ),
            camera
        );
        const hit = ray.intersectObject(mat)[0];
        if (hit)
            dispatch('place', {
                x: Math.max(-WIDTH / 2 + 100, Math.min(WIDTH / 2 - 100, hit.point.x)),
                y: Math.max(-HEIGHT / 2 + 100, Math.min(HEIGHT / 2 - 100, -hit.point.z))
            });
    }
    onDestroy(() => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer?.disconnect();
        controls?.dispose();
        scene?.traverse((obj) => {
            const m = obj as THREE.Mesh;
            m.geometry?.dispose();
            if (m.material)
                (Array.isArray(m.material) ? m.material : [m.material]).forEach((v) => v.dispose());
        });
        textures.forEach((t) => t.dispose());
        renderer?.dispose();
    });
    $: if (mat && map !== loadedMap) setMap(map);
</script>

<div
    class:placing
    bind:this={host}
    class="world-canvas"
    on:pointerdown={place}
    role="presentation"
></div>
{#if error}<div role="alert" class="world-error">{error}</div>{/if}

<style>
    .world-canvas {
        position: absolute;
        inset: 0;
    }
    .placing {
        cursor: crosshair;
    }
    .world-error {
        position: absolute;
        inset: 20%;
        color: white;
        padding: 30px;
        background: #732638;
    }
</style>
