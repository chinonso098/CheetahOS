import { Constants } from "src/app/system-files/constants";

declare const p5:any;

export class Boid {
  p: any;
  position: any;
  velocity: any;
  acceleration: any;
  maxForce = 0.3;
  maxSpeed = 5;

  constructor(p: any) {
    this.p = p;
    this.position = p.createVector(p.random(p.width), p.random(p.height));
    this.velocity = p5.Vector.random2D();
    this.velocity.setMag(p.random(2, 4));
    this.acceleration = p.createVector();
  }

  edges() {
    const { width, height, createVector } = this.p;

    if (this.position.x < 0 || this.position.x > width) {
      const reflect = createVector(
        this.position.x < 0 ? this.maxSpeed : -this.maxSpeed,
        this.velocity.y
      );
      reflect.sub(this.velocity).limit(this.maxForce);
      this.acceleration.add(reflect);
    }

    if (this.position.y < 0 || this.position.y > height) {
      const reflect = createVector(
        this.velocity.x,
        this.position.y < 0 ? this.maxSpeed : -this.maxSpeed
      );
      reflect.sub(this.velocity).limit(this.maxForce);
      this.acceleration.add(reflect);
    }
  }

  align(flocks: Boid[]) {
    const senseRadius = 10;
    const steering = this.p.createVector();
    let total = 0;

    for (const other of flocks) {
      if (other !== this) {
        const d = this.position.dist(other.position);
        if (d <= senseRadius) {
          steering.add(other.velocity);
          total++;
        }
      }
    }

    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }

    return steering;
  }

  cohesion(flocks: Boid[]) {
    const senseRadius = 50;
    const steering = this.p.createVector();
    let total = 0;

    for (const other of flocks) {
      if (other !== this) {
        const d = this.position.dist(other.position);
        if (d <= senseRadius) {
          steering.add(other.position);
          total++;
        }
      }
    }

    if (total > 0) {
      steering.div(total);
      steering.sub(this.position);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }

    return steering;
  }

  separation(flocks: Boid[]) {
    const senseRadius = 15;
    const steering = this.p.createVector();
    let total = 0;

    for (const other of flocks) {
      if (other !== this) {
        const d = this.position.dist(other.position);
        if (d <= senseRadius) {
          const push = p5.Vector.sub(this.position, other.position);
          push.div(d);
          steering.add(push);
          total++;
        }
      }
    }

    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }

    return steering;
  }

  behavior(flocks: Boid[], params: any) {
    const align = this.align(flocks).mult(params.align);
    const cohesion = this.cohesion(flocks).mult(params.cohesion);
    const separation = this.separation(flocks).mult(params.separation);

    this.acceleration.add(align);
    this.acceleration.add(cohesion);
    this.acceleration.add(separation);
  }

  update() {
    this.position.add(this.velocity);
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.acceleration.mult(0);
  }

  draw() {
    this.p.push();
    this.p.stroke('#9f5f80');
    this.p.fill('#ff8474');
    this.p.strokeWeight(2);
    const angle = this.p.atan2(this.velocity.y, this.velocity.x);
    this.p.translate(this.position.x, this.position.y);
    this.p.rotate(angle);
    this.p.quad(-15, 0, 0, -5, 5, 0, 0, 5);
    this.p.pop();
  }


}

