const fragmentShader = `
    varying vec2 vUv;
    uniform float progress;
    
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
        float x = floor(vUv.x * 10.);
        float y = floor(vUv.y * 10.);
        float pattern = noise(vec2(x,y));

        float w = 0.5;
        float p0 = progress;
        p0 = map(p0, 0., 1. , -w, 1.);
        p0 = smoothstep(p0, p0 + w, vUv.x);
        float p0_ = p0 * 2. - pattern;

        gl_FragColor = vec4(vec3(p0_), 1.);
    }
`;

export default fragmentShader;
