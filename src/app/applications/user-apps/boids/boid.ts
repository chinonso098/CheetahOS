import { Constants } from "src/app/system-files/constants";

declare const p5:any;

export class Boid {
  p: any;
  position: any;
  velocity: any;
  acceleration: any;
  maxForce = 0.3;
  maxSpeed = 5;

  // Builds one bird. Drops it at a random spot on screen, gives it a random
  // starting direction/speed, and starts with zero "push" (acceleration).
  constructor(p: any) {
    this.p = p;
    this.position = p.createVector(p.random(p.width), p.random(p.height));
    this.velocity = p5.Vector.random2D();
    this.velocity.setMag(p.random(2, 4));
    this.acceleration = p.createVector();
  }

  // Keeps the bird inside the window. If it touches a wall (left/right or
  // top/bottom), it nudges the bird back the other way so it bounces instead
  // of flying off the screen.
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

  // "Go the same way as my close neighbors." Looks at nearby birds, averages
  // the direction they're all flying, and returns a gentle steer so this bird
  // lines up and travels with the group.
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

  // "Stick with the crowd." Finds the center point of nearby birds and returns
  // a steer toward that middle, so the flock stays clumped together instead of
  // drifting apart.
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

  // "Don't crash into each other." If a bird gets too close, this pushes away
  // from it. The closer the neighbor, the stronger the push, keeping personal
  // space so birds don't pile up.
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

  // The "brain" that blends the three flock rules. It scales align, cohesion,
  // and separation by the user's slider values and adds them all into the
  // bird's push, deciding how it will move this frame.
  behavior(flocks: Boid[], params: any) {
    const align = this.align(flocks).mult(params.align);
    const cohesion = this.cohesion(flocks).mult(params.cohesion);
    const separation = this.separation(flocks).mult(params.separation);

    this.acceleration.add(align);
    this.acceleration.add(cohesion);
    this.acceleration.add(separation);
  }

  // Moves the bird one step: slide by current speed, then let the push change
  // the speed (capped so it never goes too fast), and finally reset the push
  // back to zero for the next frame.
  update() {
    this.position.add(this.velocity);
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.acceleration.mult(0);
  }

  // Paints the bird on screen: picks colors, points the little arrow shape in
  // the direction it's flying, and draws it at the bird's current position.
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

