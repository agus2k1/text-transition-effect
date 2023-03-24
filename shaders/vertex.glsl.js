const vertexShader = `
  uniform float time;
  varying vec2 vUv;

  void main() {
    vUv = uv;

    vec3 pos = vec3(position.x, position.y, position.z);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export default vertexShader;
