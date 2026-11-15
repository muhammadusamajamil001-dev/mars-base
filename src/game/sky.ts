import * as THREE from 'three';

export interface WeatherAtmosphere {
  purpleFactor: number; // Solar Radiation Storm (neon purple sky)
  dustFactor: number; // Giant Dust Storm (thick swirling orange haze)
  frostFactor: number; // Extreme Cold Snap (icy pale blue atmosphere)
}

export interface MartianSkySystem {
  group: THREE.Group;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  update: (
    solProgress: number,
    elapsedTime: number,
    focusX: number,
    focusZ: number,
    scene: THREE.Scene,
    weather?: WeatherAtmosphere,
  ) => {
    nightFactor: number;
    timeOfDayLabel: string;
    sunDirX: number;
    sunDirY: number;
    sunDirZ: number;
  };
  dispose: () => void;
}

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uZenithColor;
  uniform vec3 uMidColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  varying vec3 vWorldDir;

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = clamp(dir.y, -0.15, 1.0);
    float t1 = smoothstep(-0.05, 0.28, h);
    float t2 = smoothstep(0.24, 0.88, h);

    vec3 col = mix(uHorizonColor, uMidColor, t1);
    col = mix(col, uZenithColor, t2);

    // Solar glow & crisp sun disc
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float halo = pow(sunDot, 10.0) * 0.38 * uSunIntensity;
    float innerHalo = pow(sunDot, 64.0) * 0.55 * uSunIntensity;
    float disc = smoothstep(0.9986, 0.9994, sunDot) * 1.45 * uSunIntensity;

    col += uSunColor * (halo + innerHalo + disc);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = aColor;
    vTwinkle = 0.68 + 0.32 * sin(uTime * 2.1 + aPhase);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (280.0 / max(-mvPosition.z, 1.0));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.05, d);
    float alpha = core * core * uOpacity * vTwinkle;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// Pre-allocated color scratchpads (zero GC in update)
const _cDayZenith = new THREE.Color('#b65e49');
const _cDayMid = new THREE.Color('#dc8360');
const _cDayHorizon = new THREE.Color('#efb28d');

const _cTwilightZenith = new THREE.Color('#2d375a');
const _cTwilightMid = new THREE.Color('#7a5d73');
const _cTwilightHorizon = new THREE.Color('#e07351');

const _cNightZenith = new THREE.Color('#060919');
const _cNightMid = new THREE.Color('#0d1633');
const _cNightHorizon = new THREE.Color('#192444');

const _cSunDay = new THREE.Color('#ffe5be');
const _cSunLow = new THREE.Color('#ff8e53');
const _cMoonLight = new THREE.Color('#6f8dd6');

const _cHemiDaySky = new THREE.Color('#eeaa88');
const _cHemiDayGround = new THREE.Color('#7a2d1b');
const _cHemiNightSky = new THREE.Color('#273a6e');
const _cHemiNightGround = new THREE.Color('#1a0d0a');

// Weather Hazard Sky Palettes
const _cRadZenith = new THREE.Color('#4c1d95');
const _cRadMid = new THREE.Color('#9333ea');
const _cRadHorizon = new THREE.Color('#e879f9');

const _cDustZenith = new THREE.Color('#9a3412');
const _cDustMid = new THREE.Color('#c2410c');
const _cDustHorizon = new THREE.Color('#ea580c');

const _cColdZenith = new THREE.Color('#1e3a8a');
const _cColdMid = new THREE.Color('#3b82f6');
const _cColdHorizon = new THREE.Color('#bae6fd');

const _tmpZenith = new THREE.Color();
const _tmpMid = new THREE.Color();
const _tmpHorizon = new THREE.Color();
const _tmpSunCol = new THREE.Color();
const _sunDir = new THREE.Vector3();

export function createMartianSky(scene: THREE.Scene, isSoftwareGl: boolean, pixelRatio: number): MartianSkySystem {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Sky Dome
  const skyGeo = new THREE.SphereGeometry(320, 32, 24);
  const skyUniforms = {
    uZenithColor: { value: _cDayZenith.clone() },
    uMidColor: { value: _cDayMid.clone() },
    uHorizonColor: { value: _cDayHorizon.clone() },
    uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
    uSunColor: { value: _cSunDay.clone() },
    uSunIntensity: { value: 1.0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  group.add(skyMesh);
  disposables.push(skyGeo, skyMat);

  // Starfield Points
  const starCount = 1900;
  const starPos = new Float32Array(starCount * 3);
  const starSize = new Float32Array(starCount);
  const starPhase = new Float32Array(starCount);
  const starCol = new Float32Array(starCount * 3);

  const palette = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#cfe4ff'),
    new THREE.Color('#ffe5b4'),
    new THREE.Color('#ffd0b0'),
  ];

  let s = 19760720;
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let i = 0; i < starCount; i++) {
    const theta = nextRand() * Math.PI * 2;
    const phi = Math.acos(nextRand() * 0.96 + 0.02); // mostly upper hemisphere
    const r = 295;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    starSize[i] = 1.6 + Math.pow(nextRand(), 2.2) * 4.2;
    starPhase[i] = nextRand() * Math.PI * 2;

    const c = palette[Math.floor(nextRand() * palette.length)];
    starCol[i * 3] = c.r;
    starCol[i * 3 + 1] = c.g;
    starCol[i * 3 + 2] = c.b;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starCol, 3));

  const starUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uPixelRatio: { value: pixelRatio },
  };

  const starMat = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    vertexShader: STAR_VERTEX_SHADER,
    fragmentShader: STAR_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const starField = new THREE.Points(starGeo, starMat);
  starField.frustumCulled = false;
  group.add(starField);
  disposables.push(starGeo, starMat);

  // Phobos & Deimos (Mars's two small moons)
  const phobosGeo = new THREE.DodecahedronGeometry(3.4, 1);
  const phobosMat = new THREE.MeshStandardMaterial({
    color: '#c9b4a8',
    roughness: 0.9,
    metalness: 0.05,
    emissive: '#3e322c',
    emissiveIntensity: 0.35,
    fog: false,
  });
  const phobos = new THREE.Mesh(phobosGeo, phobosMat);
  phobos.scale.set(1.25, 0.85, 1.0);
  group.add(phobos);

  const deimosGeo = new THREE.DodecahedronGeometry(1.7, 0);
  const deimosMat = phobosMat.clone();
  const deimos = new THREE.Mesh(deimosGeo, deimosMat);
  group.add(deimos);
  disposables.push(phobosGeo, phobosMat, deimosGeo, deimosMat);

  // Directional Sun Light with soft shadows
  const sunLight = new THREE.DirectionalLight('#ffe2bd', 2.4);
  sunLight.position.set(45, 70, 35);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 190;
  const shadowExtent = 46;
  sunLight.shadow.camera.left = -shadowExtent;
  sunLight.shadow.camera.right = shadowExtent;
  sunLight.shadow.camera.top = shadowExtent;
  sunLight.shadow.camera.bottom = -shadowExtent;
  sunLight.shadow.radius = 3.5;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Warm/Cool Hemisphere Fill Light
  const hemiLight = new THREE.HemisphereLight('#eeaa88', '#7a2d1b', 0.95);
  scene.add(hemiLight);

  // Horizon-matched atmospheric dust fog
  const fog = new THREE.FogExp2('#eeb08b', 0.0052);
  scene.fog = fog;
  scene.background = _cDayHorizon.clone();
  scene.add(group);

  const update = (
    solProgress: number,
    elapsedTime: number,
    focusX: number,
    focusZ: number,
    targetScene: THREE.Scene,
    weather?: WeatherAtmosphere,
  ) => {
    // 0.0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight
    const sunOrbitAngle = solProgress * Math.PI * 2;
    const sunElev = Math.sin(sunOrbitAngle);
    const sunHoriz = Math.cos(sunOrbitAngle);

    _sunDir.set(sunHoriz * 0.88, sunElev, Math.sin(sunOrbitAngle * 0.5 + 0.4) * 0.46).normalize();
    skyUniforms.uSunDir.value.copy(_sunDir);

    // Twilight & night blend factors
    const dayFactor = THREE.MathUtils.smoothstep(sunElev, -0.08, 0.35);
    const twilightPeak = Math.exp(-Math.pow((sunElev - 0.03) / 0.16, 2));
    const nightFactor = 1.0 - THREE.MathUtils.smoothstep(sunElev, -0.22, 0.14);

    // Sky palette blend
    _tmpZenith.copy(_cNightZenith).lerp(_cDayZenith, dayFactor).lerp(_cTwilightZenith, twilightPeak * 0.75);
    _tmpMid.copy(_cNightMid).lerp(_cDayMid, dayFactor).lerp(_cTwilightMid, twilightPeak * 0.72);
    _tmpHorizon.copy(_cNightHorizon).lerp(_cDayHorizon, dayFactor).lerp(_cTwilightHorizon, twilightPeak * 0.65);

    const purpleF = weather ? THREE.MathUtils.clamp(weather.purpleFactor, 0, 1) : 0;
    const dustF = weather ? THREE.MathUtils.clamp(weather.dustFactor, 0, 1) : 0;
    const frostF = weather ? THREE.MathUtils.clamp(weather.frostFactor, 0, 1) : 0;

    if (purpleF > 0.001) {
      _tmpZenith.lerp(_cRadZenith, purpleF * 0.88);
      _tmpMid.lerp(_cRadMid, purpleF * 0.9);
      _tmpHorizon.lerp(_cRadHorizon, purpleF * 0.82);
    }
    if (dustF > 0.001) {
      _tmpZenith.lerp(_cDustZenith, dustF * 0.88);
      _tmpMid.lerp(_cDustMid, dustF * 0.9);
      _tmpHorizon.lerp(_cDustHorizon, dustF * 0.92);
    }
    if (frostF > 0.001) {
      _tmpZenith.lerp(_cColdZenith, frostF * 0.76);
      _tmpMid.lerp(_cColdMid, frostF * 0.78);
      _tmpHorizon.lerp(_cColdHorizon, frostF * 0.82);
    }

    skyUniforms.uZenithColor.value.copy(_tmpZenith);
    skyUniforms.uMidColor.value.copy(_tmpMid);
    skyUniforms.uHorizonColor.value.copy(_tmpHorizon);

    _tmpSunCol.copy(_cSunLow).lerp(_cSunDay, THREE.MathUtils.smoothstep(sunElev, 0.02, 0.45));
    skyUniforms.uSunColor.value.copy(_tmpSunCol);
    skyUniforms.uSunIntensity.value =
      THREE.MathUtils.smoothstep(sunElev, -0.12, 0.08) * (1 - dustF * 0.75);

    // Starfield fade-in at dusk/night
    starUniforms.uTime.value = elapsedTime;
    starUniforms.uOpacity.value = Math.pow(nightFactor, 1.15) * 0.98 * (1 - dustF * 0.92);
    starField.rotation.y = solProgress * 0.35;

    // Orbit Phobos & Deimos across sky dome centered on camera/rover focus
    group.position.set(focusX, 0, focusZ);
    const phobosAngle = elapsedTime * 0.035 + 1.2;
    phobos.position.set(
      Math.cos(phobosAngle) * 210,
      92 + Math.sin(phobosAngle * 0.7) * 38,
      Math.sin(phobosAngle) * 210,
    );
    phobos.rotation.y = elapsedTime * 0.12;

    const deimosAngle = -elapsedTime * 0.018 + 3.4;
    deimos.position.set(
      Math.cos(deimosAngle) * 235,
      115 + Math.cos(deimosAngle * 0.5) * 26,
      Math.sin(deimosAngle) * 235,
    );

    // Follow focus point so shadows stay crisp wherever rover drives
    if (sunElev > -0.05) {
      sunLight.position.set(
        focusX + _sunDir.x * 75,
        Math.max(sunElev, 0.08) * 75,
        focusZ + _sunDir.z * 75,
      );
      sunLight.color.copy(_tmpSunCol);
      if (purpleF > 0.01) sunLight.color.lerp(_cRadHorizon, purpleF * 0.45);
      if (frostF > 0.01) sunLight.color.lerp(_cColdHorizon, frostF * 0.55);
      sunLight.intensity = (0.4 + dayFactor * 2.15) * (1 - dustF * 0.48);
    } else {
      // Soft cool moonlight during Martian night
      sunLight.position.set(focusX - 42, 58, focusZ + 32);
      sunLight.color.copy(_cMoonLight);
      if (purpleF > 0.01) sunLight.color.lerp(_cRadHorizon, purpleF * 0.55);
      sunLight.intensity = 0.55 + nightFactor * 0.25;
    }
    sunLight.target.position.set(focusX, 0, focusZ);

    hemiLight.color.copy(_cHemiNightSky).lerp(_cHemiDaySky, dayFactor);
    if (purpleF > 0.01) hemiLight.color.lerp(_cRadHorizon, purpleF * 0.55);
    if (frostF > 0.01) hemiLight.color.lerp(_cColdHorizon, frostF * 0.55);
    hemiLight.groundColor.copy(_cHemiNightGround).lerp(_cHemiDayGround, dayFactor);
    hemiLight.intensity = 0.48 + dayFactor * 0.55;

    fog.color.copy(_tmpHorizon);
    const baseFog = 0.0054 - nightFactor * 0.0014;
    fog.density = baseFog + dustF * 0.024 + purpleF * 0.002 + frostF * 0.004;
    if (targetScene.background instanceof THREE.Color) {
      targetScene.background.copy(_tmpHorizon);
    }

    let timeOfDayLabel = 'Martian Day';
    if (solProgress < 0.08 || solProgress >= 0.94) timeOfDayLabel = 'Sunrise';
    else if (solProgress < 0.42) timeOfDayLabel = 'High Noon';
    else if (solProgress < 0.56) timeOfDayLabel = 'Dusty Sunset';
    else timeOfDayLabel = 'Starry Night';

    return {
      nightFactor,
      timeOfDayLabel,
      sunDirX: _sunDir.x,
      sunDirY: _sunDir.y,
      sunDirZ: _sunDir.z,
    };
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return { group, sunLight, hemiLight, update, dispose };
}
