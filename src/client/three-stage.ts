import * as THREE from "three";
import type { GiftMessage } from "../shared.js";

type Dancer = {
  root: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  phase: number;
  baseY: number;
};

const MAX_DANCERS = 8;
const INITIAL_DANCERS = 5;
const SPHERE = new THREE.SphereGeometry(1, 24, 16);
const SKIN_COLORS = [0xc88762, 0xd49a70, 0xb87856, 0xe0ae84, 0x9b684e];
const COSTUME_COLORS = [0xb52768, 0x177d88, 0x8c4ba7, 0xc27925, 0x315eaa];

export class ThreeGiftStage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly dancers: Dancer[] = [];
  private readonly container: HTMLElement;
  private elapsed = 0;
  private energy = 1;
  private aspect = 9 / 16;
  private previousFrameTime = performance.now();

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.domElement.className = "three-canvas";
    container.prepend(this.renderer.domElement);

    this.camera.position.set(0, 4, 12);
    this.camera.lookAt(0, 4, 0);
    this.scene.add(new THREE.HemisphereLight(0xffead5, 0x24103a, 2.4));

    const keyLight = new THREE.DirectionalLight(0xffddaa, 2.8);
    keyLight.position.set(-3, 7, 5);
    this.scene.add(keyLight);

    const purpleLight = new THREE.PointLight(0xb334ff, 22, 14);
    purpleLight.position.set(-4, 3, 2);
    this.scene.add(purpleLight);

    const blueLight = new THREE.PointLight(0x23c9ff, 18, 14);
    blueLight.position.set(4, 3, -1);
    this.scene.add(blueLight);

    this.resize();
    window.addEventListener("resize", this.resize);

    for (let index = 0; index < INITIAL_DANCERS; index++) {
      this.addDancer();
    }

    this.animate();
  }

  onGift(gift: GiftMessage): void {
    this.energy = Math.min(3, this.energy + (gift.diamonds >= 100 ? 1.2 : 0.55));
    const newDancers = Math.min(3, Math.max(1, gift.repeatCount));
    for (let index = 0; index < newDancers; index++) {
      if (this.dancers.length >= MAX_DANCERS) {
        break;
      }
      this.addDancer();
    }
  }

  private addDancer(): void {
    const index = this.dancers.length;
    if (index >= MAX_DANCERS) {
      return;
    }

    const skin = new THREE.MeshStandardMaterial({
      color: SKIN_COLORS[index % SKIN_COLORS.length],
      roughness: 0.72,
    });
    const hair = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x21171b : 0x38211b });
    const fabric = new THREE.MeshPhysicalMaterial({
      color: COSTUME_COLORS[index % COSTUME_COLORS.length],
      roughness: 0.38,
      metalness: 0.12,
      clearcoat: 0.35,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffc64a,
      metalness: 0.72,
      roughness: 0.26,
      emissive: 0x4a2100,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x25171a, roughness: 0.55 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xfff1de, roughness: 0.38 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x281b18, roughness: 0.4 });
    const lip = new THREE.MeshStandardMaterial({ color: 0x8e3c3b, roughness: 0.6 });

    const root = new THREE.Group();
    const isMale = index === 3 || index === 6;

    this.addMesh(root, new THREE.SphereGeometry(0.27, 24, 16), fabric, 0, 0.99, 0);
    this.addMesh(
      root,
      new THREE.CapsuleGeometry(0.25, 0.42, 6, 18),
      fabric,
      0,
      1.46,
      0,
      0.82,
      1,
      0.72,
    );

    const pants = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COSTUME_COLORS[index % COSTUME_COLORS.length]).multiplyScalar(0.65),
      roughness: 0.62,
    });
    this.addMesh(root, new THREE.CapsuleGeometry(0.12, 0.51, 5, 12), pants, -0.12, 0.53, 0, 0.82, 1, 0.85);
    this.addMesh(root, new THREE.CapsuleGeometry(0.12, 0.51, 5, 12), pants, 0.12, 0.53, 0, 0.82, 1, 0.85);

    if (!isMale) {
      const skirtGeometry = new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.13, 0),
          new THREE.Vector2(0.19, 0.14),
          new THREE.Vector2(0.28, 0.55),
          new THREE.Vector2(0.29, 0.7),
        ],
        24,
      );
      this.addMesh(root, skirtGeometry, fabric, 0, 0.52, 0);
      this.addMesh(root, new THREE.TorusGeometry(0.26, 0.025, 8, 24), gold, 0, 1.12, 0, 1, 1, 0.78);
      this.addMesh(root, new THREE.TorusGeometry(0.21, 0.025, 8, 24), gold, 0, 0.72, 0, 1, 1, 0.78);
    } else {
      this.addMesh(root, new THREE.TorusGeometry(0.22, 0.035, 8, 24), gold, 0, 1.02, 0, 1, 1, 0.8);
    }

    this.addMesh(root, new THREE.CylinderGeometry(0.075, 0.09, 0.18, 16), skin, 0, 1.83, 0);
    this.addMesh(root, new THREE.TorusGeometry(0.18, 0.025, 8, 24), gold, 0, 1.78, 0.015, 1, 1, 0.72, Math.PI / 2);
    this.addMesh(root, new THREE.SphereGeometry(0.075, 16, 12), gold, -0.24, 1.68, 0);
    this.addMesh(root, new THREE.SphereGeometry(0.075, 16, 12), gold, 0.24, 1.68, 0);

    const sash = this.addMesh(
      root,
      new THREE.BoxGeometry(0.11, 0.72, 0.035),
      gold,
      0.1,
      1.45,
      0.19,
    );
    sash.rotation.z = -0.38;

    for (let index = 0; index < 5; index++) {
      this.addMesh(root, new THREE.SphereGeometry(0.022, 10, 8), gold, 0, 1.67 - index * 0.1, 0.198);
    }

    const head = new THREE.Group();
    head.position.set(0, 2.12, 0);
    root.add(head);
    this.addMesh(head, SPHERE, skin, 0, 0, 0, 0.235, 0.3, 0.22);
    this.addMesh(head, SPHERE, hair, 0, 0.19, -0.045, 0.24, 0.13, 0.235);
    this.addMesh(head, SPHERE, hair, 0, 0.1, -0.16, 0.18, 0.2, 0.09);

    for (const side of [-1, 1]) {
      this.addMesh(head, SPHERE, skin, side * 0.23, -0.015, 0, 0.045, 0.065, 0.04);
      this.addMesh(head, SPHERE, eyeWhite, side * 0.08, 0.015, 0.195, 0.046, 0.028, 0.022);
      this.addMesh(head, SPHERE, iris, side * 0.08, 0.015, 0.215, 0.018, 0.019, 0.01);
      const brow = this.addMesh(head, new THREE.CapsuleGeometry(0.009, 0.045, 3, 6), hair, side * 0.08, 0.065, 0.196);
      brow.rotation.z = Math.PI / 2;
      this.addMesh(head, SPHERE, gold, side * 0.23, -0.04, 0.025, 0.025, 0.035, 0.025);
    }
    this.addMesh(head, SPHERE, skin, 0, -0.035, 0.222, 0.027, 0.045, 0.034);
    this.addMesh(head, SPHERE, lip, 0, -0.125, 0.201, 0.045, 0.014, 0.012);

    if (isMale) {
      this.addMesh(head, new THREE.TorusGeometry(0.15, 0.018, 6, 20), gold, 0, 0.24, 0, 1, 1, 0.7, Math.PI / 2);
    } else {
      this.addMesh(head, new THREE.CylinderGeometry(0.02, 0.14, 0.42, 8), gold, 0, 0.47, 0);
      this.addMesh(head, new THREE.TorusGeometry(0.12, 0.018, 6, 16), gold, 0, 0.28, 0, 1, 1, 0.8);
      this.addMesh(head, SPHERE, gold, 0, 0.67, 0, 0.04, 0.055, 0.04);
    }

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.22, 1.67, 0);
    root.add(leftArm);
    this.addArm(leftArm, -1, skin, fabric, gold);
    const rightArm = new THREE.Group();
    rightArm.position.set(0.22, 1.67, 0);
    root.add(rightArm);
    this.addArm(rightArm, 1, skin, fabric, gold);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.12, 0.67, 0);
    root.add(leftLeg);
    const leftKnee = this.addLeg(leftLeg, skin, pants);
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.12, 0.67, 0);
    root.add(rightLeg);
    const rightKnee = this.addLeg(rightLeg, skin, pants);

    this.addMesh(root, new THREE.CircleGeometry(0.43, 24), dark, 0, 0.012, 0, 1, 1, 0.7, -Math.PI / 2);

    const baseY = 1.45;
    root.position.y = baseY;
    this.scene.add(root);
    this.dancers.push({
      root,
      head,
      leftArm,
      rightArm,
      leftForearm: leftArm.userData.forearm as THREE.Group,
      rightForearm: rightArm.userData.forearm as THREE.Group,
      leftLeg,
      rightLeg,
      leftKnee,
      rightKnee,
      phase: index * 1.21,
      baseY,
    });
    this.layoutDancers();
  }

  private addArm(
    shoulder: THREE.Group,
    side: number,
    skin: THREE.Material,
    fabric: THREE.Material,
    gold: THREE.Material,
  ): void {
    this.addMesh(shoulder, new THREE.CapsuleGeometry(0.075, 0.24, 5, 12), fabric, 0, -0.19, 0);
    this.addMesh(shoulder, new THREE.SphereGeometry(0.085, 16, 12), gold, 0, -0.02, 0);

    const forearm = new THREE.Group();
    forearm.position.y = -0.39;
    shoulder.add(forearm);
    this.addMesh(forearm, new THREE.CapsuleGeometry(0.06, 0.25, 5, 12), skin, 0, -0.16, 0);
    this.addMesh(forearm, new THREE.SphereGeometry(0.045, 12, 10), gold, 0, -0.02, 0);
    this.addMesh(forearm, new THREE.SphereGeometry(0.07, 16, 12), skin, 0, -0.32, 0.02);

    for (let finger = 0; finger < 3; finger++) {
      this.addMesh(
        forearm,
        new THREE.CapsuleGeometry(0.012, 0.055, 3, 6),
        skin,
        (finger - 1) * 0.028,
        -0.39,
        0.035,
      );
    }
    shoulder.userData.forearm = forearm;
    shoulder.userData.side = side;
  }

  private addLeg(
    leg: THREE.Group,
    skin: THREE.Material,
    pants: THREE.Material,
  ): THREE.Group {
    this.addMesh(leg, new THREE.CapsuleGeometry(0.095, 0.32, 5, 12), pants, 0, -0.21, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.39;
    leg.add(knee);
    this.addMesh(knee, new THREE.CapsuleGeometry(0.075, 0.29, 5, 12), pants, 0, -0.16, 0);
    this.addMesh(knee, new THREE.CapsuleGeometry(0.075, 0.18, 5, 12), skin, 0, -0.4, 0);
    this.addMesh(knee, new THREE.BoxGeometry(0.14, 0.09, 0.29), pants, 0, -0.53, 0.08);
    return knee;
  }

  private layoutDancers(): void {
    const count = this.dancers.length;
    const scale = count > 6 ? 0.74 : count === 6 ? 0.86 : count === 5 ? 0.94 : 1;
    const worldWidth = this.aspect * 8;

    this.dancers.forEach((dancer, index) => {
      const lane = count === 1 ? 0 : (index / (count - 1) - 0.5) * 0.6;
      dancer.root.position.x = lane * worldWidth;
      dancer.root.scale.setScalar(scale);
    });
  }

  private addMesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1,
    rotationX = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX, scaleY, scaleZ);
    mesh.rotation.x = rotationX;
    parent.add(mesh);
    return mesh;
  }

  private readonly resize = (): void => {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.aspect = width / height;

    const worldHeight = 8;
    this.camera.left = (-worldHeight * this.aspect) / 2;
    this.camera.right = (worldHeight * this.aspect) / 2;
    this.camera.top = worldHeight / 2;
    this.camera.bottom = -worldHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private readonly animate = (): void => {
    requestAnimationFrame(this.animate);
    const now = performance.now();
    const delta = Math.min((now - this.previousFrameTime) / 1000, 0.05);
    this.previousFrameTime = now;
    this.elapsed += delta;
    this.energy += (1 - this.energy) * Math.min(delta * 0.85, 1);

    for (const dancer of this.dancers) {
      const beat = this.elapsed * 3.2 + dancer.phase;
      const bounce = Math.abs(Math.sin(beat)) * 0.12 * this.energy;
      dancer.root.position.y = dancer.baseY + bounce;
      dancer.root.rotation.y = Math.sin(beat * 0.55) * 0.16 * this.energy;
      dancer.head.rotation.z = Math.sin(beat * 0.7) * 0.06;
      dancer.leftArm.rotation.z = -0.65 - Math.sin(beat) * 0.55 * this.energy;
      dancer.rightArm.rotation.z = 0.65 + Math.sin(beat + 1.2) * 0.55 * this.energy;
      dancer.leftForearm.rotation.z = -0.25 - Math.sin(beat + 0.6) * 0.38;
      dancer.rightForearm.rotation.z = 0.25 + Math.sin(beat + 1.6) * 0.38;
      dancer.leftLeg.rotation.z = Math.sin(beat + 0.3) * 0.16 * this.energy;
      dancer.rightLeg.rotation.z = -Math.sin(beat + 0.3) * 0.16 * this.energy;
      dancer.leftKnee.rotation.z = Math.max(0, Math.sin(beat)) * 0.32 * this.energy;
      dancer.rightKnee.rotation.z = Math.max(0, -Math.sin(beat)) * 0.32 * this.energy;
    }

    this.renderer.render(this.scene, this.camera);
  };
}
