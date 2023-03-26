import './main.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import gsap from 'gsap';
import fragment from './shaders/fragment.glsl.js';
import vertex from './shaders/vertex.glsl.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import {
  MSDFTextGeometry,
  MSDFTextMaterial,
  uniforms,
} from 'three-msdf-text-utils';
import fnt from './fonts/DIN-Bold-msdf/DIN-Bold-msdf.json';
import png from './fonts/DIN-Bold-msdf/DIN-Bold.png';

export default class Sketch {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // this.renderer.setClearColor(0xeeeeee, 1);
    document.getElementById('container').appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 2);
    this.scene = new THREE.Scene();

    this.time = 0;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.addMesh();
    this.settings();
    this.render();
  }

  addMesh() {
    this.material = new THREE.ShaderMaterial({
      extensions: {
        derivatives: '#extension GL_OES_standard_derivatives : enable',
      },
      uniforms: {
        time: { value: 0 },
        progress: { value: 0 },
      },
      fragmentShader: fragment,
      vertexShader: vertex,
      side: THREE.DoubleSide,
      // wireframe: true,
    });
    this.geometry = new THREE.PlaneGeometry(1.5, 1.5, 300, 300);

    this.plane = new THREE.Mesh(this.geometry, this.material);
    // this.scene.add(this.plane);

    // Font
    Promise.all([loadFontAtlas(png)]).then(([atlas]) => {
      const geometry = new MSDFTextGeometry({
        text: 'HELLO',
        font: fnt,
      });

      geometry.computeBoundingBox();

      // let aspect = 3.5

      // const material = new MSDFTextMaterial();

      this.material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        defines: {
          IS_SMALL: false,
        },
        extensions: {
          derivatives: true,
        },
        uniforms: {
          // Common
          ...uniforms.common,

          // Rendering
          ...uniforms.rendering,

          // Strokes
          ...uniforms.strokes,
          ...{
            uStrokeColor: { value: new THREE.Color(0x00ff00) },
            uProgress1: { value: 0 },
            uProgress2: { value: 0 },
            uProgress3: { value: 0 },
            uProgress4: { value: 0 },
            time: { value: 0 },
          },
        },
        vertexShader: `
        // Attribute
        attribute vec2 layoutUv;

        attribute float lineIndex;

        attribute float lineLettersTotal;
        attribute float lineLetterIndex;

        attribute float lineWordsTotal;
        attribute float lineWordIndex;

        attribute float wordIndex;

        attribute float letterIndex;

        // Varyings
        varying vec2 vUv;
        varying vec2 vLayoutUv;
        varying vec3 vViewPosition;
        varying vec3 vNormal;

        varying float vLineIndex;

        varying float vLineLettersTotal;
        varying float vLineLetterIndex;

        varying float vLineWordsTotal;
        varying float vLineWordIndex;

        varying float vWordIndex;

        varying float vLetterIndex;

        void main() {
            // Output
            vec4 mvPosition = vec4(position, 1.0);
            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;

            // Varyings
            vUv = uv;
            vLayoutUv = layoutUv;
            vViewPosition = -mvPosition.xyz;
            vNormal = normal;

            vLineIndex = lineIndex;

            vLineLettersTotal = lineLettersTotal;
            vLineLetterIndex = lineLetterIndex;

            vLineWordsTotal = lineWordsTotal;
            vLineWordIndex = lineWordIndex;

            vWordIndex = wordIndex;

            vLetterIndex = letterIndex;
        }
    `,
        fragmentShader: `
        // Varyings
        varying vec2 vUv;
        varying vec2 vLayoutUv;

        // Uniforms: Common
        uniform float uOpacity;
        uniform float uThreshold;
        uniform float uAlphaTest;
        uniform vec3 uColor;
        uniform sampler2D uMap;

        // Uniforms: Strokes
        uniform vec3 uStrokeColor;
        uniform float uStrokeOutsetWidth;
        uniform float uStrokeInsetWidth;

        // Utils: Median
        uniform float uProgress1;
        uniform float uProgress2;
        uniform float uProgress3;
        uniform float uProgress4;
        uniform float time;
        
        float median(float r, float g, float b) {
            return max(min(r, g), min(max(r, g), b));
        }

        float rand(float n){return fract(sin(n) * 43758.5453123);}

        float rand(vec2 n) { 
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(float p){
            float fl = floor(p);
            float fc = fract(p);
            return mix(rand(fl), rand(fl + 1.0), fc);
        }
            
        float noise(vec2 n) {
            const vec2 d = vec2(0.0, 1.0);
            vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
            return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
        }

        float map(float value, float min1, float max1, float min2, float max2) {
            return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
        }

        void main() {
            // Common
            // Texture sample
            vec3 s = texture2D(uMap, vUv).rgb;

            // Signed distance
            float sigDist = median(s.r, s.g, s.b) - 0.5;

            float afwidth = 1.4142135623730951 / 2.0;

            #ifdef IS_SMALL
                float alpha = smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDist);
            #else
                float alpha = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);
            #endif

            // Strokes
            // Outset
            float sigDistOutset = sigDist + uStrokeOutsetWidth * 0.5;

            // Inset
            float sigDistInset = sigDist - uStrokeInsetWidth * 0.5;

            #ifdef IS_SMALL
                float outset = smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDistOutset);
                float inset = 1.0 - smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDistInset);
            #else
                float outset = clamp(sigDistOutset / fwidth(sigDistOutset) + 0.5, 0.0, 1.0);
                float inset = 1.0 - clamp(sigDistInset / fwidth(sigDistInset) + 0.5, 0.0, 1.0);
            #endif

            // Border
            float border = outset * inset;

            // Alpha Test
            if (alpha < uAlphaTest) discard;

            // Some animation
            // alpha *= sin(uTime);

            // Output: Common

            vec4 filledFragColor = vec4(uColor, uOpacity * alpha);
            // gl_FragColor = filledFragColor;

            vec3 pink = vec3(0.834, 0.066, 0.780);

            vec4 l1 = vec4(1., 1., 1., border);
            vec4 l2 = vec4(pink, border);
            vec4 l3 = vec4(pink, 1.);
            vec4 l4 = vec4(vec3(1.), 1.);

            float x = floor(vLayoutUv.x * 10. * 3.5);
            float y = floor(vLayoutUv.y * 10.);
            float pattern = noise(vec2(x,y));

            float w = 1.;

            // Gray border
            float p1 = uProgress1;
            p1 = map(p1, 0., 1. , -w, 1.);
            p1 = smoothstep(p1, p1 + w, vLayoutUv.x);
            float mix1 = p1 * 2. - pattern;
            mix1 = clamp(mix1, 0., 1.);

            // White border
            float p2 = uProgress2;
            p2 = map(p2, 0., 1. , -w, 1.);
            p2 = smoothstep(p2, p2 + w, vLayoutUv.x);
            float mix2 = p2 * 2. - pattern;
            mix2 = clamp(mix2, 0., 1.);

            // Pink color
            float p3 = uProgress3;
            p3 = map(p3, 0., 1. , -w, 1.);
            p3 = smoothstep(p3, p3 + w, vLayoutUv.x);
            float mix3 = p3 * 2. - pattern;
            mix3 = clamp(mix3, 0., 1.);

            // White color
            float p4 = uProgress4;
            p4 = map(p4, 0., 1. , -w, 1.);
            p4 = smoothstep(p4, p4 + w, vLayoutUv.x);
            float mix4 = p4 * 2. - pattern;
            mix4 = clamp(mix4, 0., 1.);

            vec4 layer1 = mix(vec4(0.), l1, 1. - mix1);
            vec4 layer2 = mix(layer1, l2, 1. - mix2);
            vec4 layer3 = mix(layer2, l3, 1. - mix3);
            vec4 layer4 = mix(layer3, l4, 1. - mix4);

            gl_FragColor = vec4(uProgress1 * 1., 0. , 0., 1.);
            gl_FragColor = l3;
            gl_FragColor = vec4(vec3(pattern), 1.);
            // gl_FragColor = vec4(vec3(mix1), 1.);
            // gl_FragColor = l1;
            gl_FragColor = layer4;
        }
    `,
      });

      this.material.uniforms.uMap.value = atlas;

      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.scale.set(0.02, -0.02, 0.02);
      mesh.position.x = -1.5;
      this.scene.add(mesh);
    });

    function loadFontAtlas(path) {
      const promise = new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(path, resolve);
      });

      return promise;
    }

    function loadFont(path) {
      const promise = new Promise((resolve, reject) => {
        const loader = new FontLoader();
        loader.load(path, resolve);
      });

      return promise;
    }
  }

  settings() {
    this.settings = {
      uProgress1: 0,
      uProgress2: 0,
      uProgress3: 0,
      uProgress4: 0,
      gogo: () => {
        let duration = 1.5;
        let delay = 0.15;
        let timeline = gsap.timeline();

        timeline.to(this.material.uniforms.uProgress1, {
          value: 1,
          duration: duration,
        });
        timeline.to(
          this.material.uniforms.uProgress2,
          {
            value: 1,
            duration: duration,
          },
          delay
        );
        timeline.to(
          this.material.uniforms.uProgress3,
          {
            value: 1,
            duration: duration,
          },
          delay * 2
        );
        timeline.to(
          this.material.uniforms.uProgress4,
          {
            value: 1,
            duration: duration,
          },
          delay * 3
        );
      },
    };
    this.gui = new GUI();
    this.gui.add(this.settings, 'uProgress1', 0, 1, 0.01).onChange(() => {
      this.material.uniforms.uProgress1.value = this.settings.uProgress1;
    });
    this.gui.add(this.settings, 'uProgress2', 0, 1, 0.01).onChange(() => {
      this.material.uniforms.uProgress2.value = this.settings.uProgress2;
    });
    this.gui.add(this.settings, 'uProgress3', 0, 1, 0.01).onChange(() => {
      this.material.uniforms.uProgress3.value = this.settings.uProgress3;
    });
    this.gui.add(this.settings, 'uProgress4', 0, 1, 0.01).onChange(() => {
      this.material.uniforms.uProgress4.value = this.settings.uProgress4;
    });
    this.gui.add(this.settings, 'gogo');
  }

  render() {
    this.time += 0.0002;
    this.material.uniforms.time.value = this.time;
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.render.bind(this));
  }
}

new Sketch();
