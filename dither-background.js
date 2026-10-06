'use strict';

const canvas = document.querySelector('.dither-background');
const gl = canvas?.getContext('webgl2', { antialias: false, powerPreference: 'low-power' });

if (canvas && gl) {
  const vertexSource = `#version 300 es
    precision mediump float;
    layout(location = 0) in vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `#version 300 es
    precision mediump float;

    uniform vec2 u_resolution;
    uniform float u_pixelRatio;
    uniform float u_time;
    out vec4 fragColor;

    const float ANIMATION_SPEED = 0.05;
    const float PI = 3.14159265358979323846;
    const float TWO_PI = 6.28318530718;
    const int bayer8x8[64] = int[64](
      0, 32, 8, 40, 2, 34, 10, 42,
      48, 16, 56, 24, 50, 18, 58, 26,
      12, 44, 4, 36, 14, 46, 6, 38,
      60, 28, 52, 20, 62, 30, 54, 22,
      3, 35, 11, 43, 1, 33, 9, 41,
      51, 19, 59, 27, 49, 17, 57, 25,
      15, 47, 7, 39, 13, 45, 5, 37,
      63, 31, 55, 23, 61, 29, 53, 21
    );

    float bayerValue(vec2 uv) {
      ivec2 position = ivec2(fract(uv / 8.0) * 8.0);
      int index = position.y * 8 + position.x;
      return float(bayer8x8[index]) / 64.0;
    }

    void main() {
      float pixelSize = 0.5 * u_pixelRatio;
      vec2 pixelUV = gl_FragCoord.xy - 0.5 * u_resolution;
      pixelUV /= pixelSize;
      vec2 canvasUV = (floor(pixelUV) + 0.5) * pixelSize / u_resolution;
      vec2 shapeUV = canvasUV;

      float patternBoxRatio = 1.0;
      float patternBoxWidth = patternBoxRatio * min(u_resolution.x / patternBoxRatio, u_resolution.y);
      float patternWorldNoFitBoxWidth = patternBoxWidth;
      patternBoxWidth = patternBoxRatio * min(u_resolution.x / patternBoxRatio, u_resolution.y);
      vec2 patternBoxSize = vec2(patternBoxWidth, patternBoxWidth / patternBoxRatio);
      shapeUV *= u_resolution.xy;
      shapeUV /= u_pixelRatio;
      shapeUV *= patternWorldNoFitBoxWidth / patternBoxSize.x;
      shapeUV += 0.5;

      float time = ANIMATION_SPEED * u_time;
      shapeUV *= 0.003;
      for (float i = 1.0; i < 6.0; i++) {
        shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + time);
        shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + time);
      }
      float shape = 0.15 / max(0.001, abs(sin(time - shapeUV.y - shapeUV.x)));
      shape = smoothstep(0.02, 1.0, shape);

      float threshold = bayerValue(pixelUV) - 0.5;
      float dither = step(0.5, shape + threshold);
      vec3 background = vec3(0.0);
      vec3 foreground = vec3(0.06666667, 0.19215686, 0.09803922);
      fragColor = vec4(mix(background, foreground, dither), 1.0);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (vertexShader && fragmentShader && program) {
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        1, -1, -1, -1, 1, 1, -1, 1,
      ]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      const pixelRatioLocation = gl.getUniformLocation(program, 'u_pixelRatio');
      const timeLocation = gl.getUniformLocation(program, 'u_time');
      const startTime = performance.now();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function drawFrame(now = startTime) {
        const width = Math.max(1, Math.round(window.innerWidth * pixelRatio));
        const height = Math.max(1, Math.round(window.innerHeight * pixelRatio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        gl.viewport(0, 0, width, height);
        gl.uniform2f(resolutionLocation, width, height);
        gl.uniform1f(pixelRatioLocation, pixelRatio);
        gl.uniform1f(timeLocation, reducedMotion ? 0 : (now - startTime) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        if (!reducedMotion) requestAnimationFrame(drawFrame);
      }

      drawFrame();
      window.addEventListener('resize', () => {
        if (reducedMotion) drawFrame();
      });
    } else {
      console.warn(gl.getProgramInfoLog(program));
    }
  }
}