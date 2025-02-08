import { Component } from '@angular/core';

@Component({
  selector: 'cos-clippy',
  standalone: true,
  imports: [],
  templateUrl: './clippy.component.html',
  styleUrl: './clippy.component.css'
})
export class ClippyComponent {


  gifPath = 'osdrive/Cheetah/System/Gifres/clippy_searching.gif';
  clippyAnimations = ['clippy_correct','clippy_listen_music','clippy_relax','clippy_melt','clippy_look_down','clippy_boxed','clippy_silly',
    'clippy_goodbye','clippy_reading','clippy_point_here','clippy_hi_there','clippy_point_up','clippy_point_right','clippy_point_left','clippy_file_vortex',
    'clippy_atomic','clippy_puzzled','clippy_hey_you','clippy_searching','clippy_no'];
  clippyDuration = [4400,2400,13600,7500,1800,5500,8400,4100,6600,2200,3500,2800,3000,3000,5000,4500,1900,2600,8100,4800];
  minDuration = 6000;

}
