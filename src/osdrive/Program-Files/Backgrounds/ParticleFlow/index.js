import { getCurl } from "./curl.js";

const vantaDiv = document.getElementById('vanta');
const width = vantaDiv.offsetWidth;
const height = vantaDiv.offsetHeight;
const SCREEN_WIDTH = width; //window.innerWidth;
const SCREEN_HEIGHT =height;// window.innerHeight;
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;
canvas.style.position = "absolute";
canvas.style.top = "0";
canvas.style.left = "0";
canvas.style.zIndex = "0"; 

vantaDiv.appendChild(canvas);

function getParticle(opts) {
  let { pos, vel, col, fadeRate } = opts;
  let { x, y } = pos;
  let size = 4;
  const noiseForce = 1;
  const noiseScale = 0.01;
  function update(t) {
    let curl = getCurl(x * noiseScale, y * noiseScale, t);
    x += vel.x;
    y += vel.y;
    x += curl.x * noiseForce;
    y += curl.y * noiseForce;
    col.alpha -= fadeRate;
    col.lightness -= fadeRate * 100;
  }
  function render(c) {
    if (col.alpha > 0.01) {
      c.fillStyle = `hsla(${col.hue}, ${100}%, ${col.lightness}%, ${col.alpha})`;
      c.beginPath();
      c.arc(x, y, size, 0, Math.PI * 2, true);
      c.fill();
    }
  }
  return { update, render };
}

function getEmitter() {
  const particles = [];
  const maxParticles = 500;

  function update(t) {
    particles.forEach((p) => {
      p.update(t);
      p.render(ctx);
    });
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 3 + 1;
    let curl = getCurl(t, 0, 0);
    let pOptions = {
      pos: { x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.5 },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      col: { hue: 360 * curl.x, lightness: 100, alpha: 1.0 },
      fadeRate: 0.005,
    };
    let particle = getParticle(pOptions);
    particles.push(particle);
    while (particles.length > maxParticles) {
      particles.shift();
    }
  }
  return { update };
}

let emitter = getEmitter();
const timeMult = 0.0002;
function animate(t) {
  requestAnimationFrame(animate);
  ctx.fillStyle = `rgba(${0},${0},${0},${0.05})`;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  emitter.update(t * timeMult);
}
animate(0);
