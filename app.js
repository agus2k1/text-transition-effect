import './main.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import fragment from './shaders/fragment.glsl.js';
import vertex from './shaders/vertex.glsl.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import {
  MSDFTextGeometry,
  MSDFTextMaterial,
  uniforms,
} from 'three-msdf-text-utils';
import fnt from './fonts/Alkatra-VariableFont_wght-msdf.json';
import png from './fonts/Alkatra-VariableFontwght.png';

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
    this.render();
  }

  addMesh() {
    this.material = new THREE.ShaderMaterial({
      extensions: {
        derivatives: '#extension GL_OES_standard_derivatives : enable',
      },
      uniforms: {
        time: { value: 0 },
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
        text: 'HELLO WORLD',
        font: fnt,
      });

      const material = new MSDFTextMaterial();
      material.uniforms.uMap.value = atlas;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(0.1, 0.1, 0.1);
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

  render() {
    this.time += 0.0002;
    this.material.uniforms.time.value = this.time;
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.render.bind(this));
  }
}

new Sketch();
