//Option A

import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { FileTreeNode } from 'src/app/system-files/file.tree.node';

import { Constants } from 'src/app/system-files/constants';

import { AudioService } from '../../system-service/audio.services';
import { FileService } from '../../system-service/file.service';

@Component({
  selector: 'cos-filetreeview',
  templateUrl: './filetreeview.component.html',
  styleUrl: './filetreeview.component.css'
})
export class FileTreeViewComponent implements OnInit, OnChanges {
  @Input() pid = Constants.NUM_ZERO;
  @Input() level = Constants.NUM_ZERO;
  @Input() showRoot = true;
  @Input() isHoverActive = false;
  @Input() levelSrcId = Constants.EMPTY_STRING;
  @Input() treeData: FileTreeNode[] = [];
 
  quickAccessData: FileTreeNode[] = [];
  private _fileService:FileService;
  private _audioService:AudioService;

  readonly cheetahNavAudio = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;

  chevronBtnStyle:Record<string, unknown> = {};
  expandedViews:string[]= [];
  selectedElementId = Constants.EMPTY_STRING;
  isClicked = false;
  processId = Constants.NUM_ZERO;
  nextLevel = Constants.NUM_ZERO;
  nextLevelSrcId = Constants.EMPTY_STRING;
  negTen = Constants.MINUS_TEN;
  name = 'filetreeview';

  readonly Quick_ACCESS = 'Quick access';
  readonly THIS_PC = Constants.THISPC;
  SECONDS_DELAY = 350;

  constructor(fileService:FileService, audioService:AudioService){
    this._fileService = fileService;
    this._audioService = audioService;
  }

  ngOnInit():void{
    this.setcolorChevron(this.isHoverActive);
    this.quickAccessData = this.genStaticData();
  }

  genStaticData():FileTreeNode[]{
    const ftn:FileTreeNode = {name:'Pictures', path:'/Users/Pictures', isFolder:true, children:[]}
    const ftn1:FileTreeNode = {name:'Videos', path:'/Users/Videos', isFolder:true, children:[]}
    const ftn2:FileTreeNode = {name:'PDFs', path:'/Users/Documents/PDFs', isFolder:true, children:[]}

    return [ftn, ftn1, ftn2];
  }

  ngOnChanges():void{
    //console.log('FILETREE onCHANGES:',this.isHoverActive);//TBD
    // console.log('isHoverActive:', this.isHoverActive); //TBD
    // console.log('fileTreeViewPid:', this.pid); //TBD
    // console.log('fileTreeViewLvl:', this.level); //TBD

    this.processId = this.pid;
    this.nextLevel = this.level + Constants.NUM_ONE;
    this.nextLevelSrcId = this.levelSrcId;

    // if(!this.isClicked)
     this.setcolorChevron(this.isHoverActive);
    // else if(this.isClicked && !this.isHoverActive){
    //   this.setcolorChevron(this.isHoverActive);
    // }
  }

  hasClass(el:HTMLElement, className:string) {
    const re = new RegExp('(^|\\s+)' + className + '(\\s+|$)');
    return re.test(el.className);
  }

  showChildren(name:string):void{
    let ulId = Constants.EMPTY_STRING;   let imgId = Constants.EMPTY_STRING; const lvl = Constants.NUM_ZERO;

    if(name === 'tp-fileExplrTreeView'){
      ulId = `ul-${this.pid}-${lvl}`;
      imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}`;
    }else{
      ulId = `qa-ul-${this.pid}`;
      imgId = `qa-fileExplrTreeView-img-${this.pid}`;
    }

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(toggler && imgDiv){
      const hasNestedClass = this.hasClass(toggler,'nested');
      const hasActiveClass = this.hasClass(toggler,'active');

      if(!hasActiveClass && !hasNestedClass){
        toggler.classList.add('nested');
        imgDiv.classList.add('root-caret-nested');
      }else if(hasActiveClass && !hasNestedClass){
        toggler.classList.remove('active');
        imgDiv.classList.remove('root-caret-active');
        toggler.classList.add('nested');
        imgDiv.classList.add('root-caret-nested');
      }else{
        toggler.classList.remove('nested');
        imgDiv.classList.remove('root-caret-nested');
        toggler.classList.add('active');
        imgDiv.classList.add('root-caret-active');
      }
    }
  }

  showGrandChildren(path:string, id:number,):void{
    const ulId = `tp-fileExplrTreeView-${this.pid}-${this.level}-${id}`;
    const imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}-${id}`;
    const cntntId =`ul-${this.pid}-${this.level}-${id}`;

    // console.log('SGC--passed id:', ulId);//TBD
    // console.log('SGC--passed imgId:', imgId);//TBD

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;
    const cntntUl =  document.getElementById(cntntId) as HTMLElement;

    if(toggler  && imgDiv){
      // console.log('SGC--toggler:', toggler);//TBD

      const hasNestedClass = this.hasClass(toggler,'nested');
      const hasActiveClass = this.hasClass(toggler,'active');

      if(!hasActiveClass && !hasNestedClass){
        toggler.classList.add('active');
        imgDiv.classList.add('caret-active');
      }else if(hasActiveClass && !hasNestedClass){
        toggler.classList.remove('active');
        imgDiv.classList.remove('caret-active');
        toggler.classList.add('nested');
        imgDiv.classList.add('caret-nested');

        if(cntntUl){
          cntntUl.classList.remove('active');
          cntntUl.classList.add('nested');
        }
      }else{
        toggler.classList.remove('nested');
        imgDiv.classList.remove('caret-nested');
        toggler.classList.add('active');
        imgDiv.classList.add('caret-active');

        if(cntntUl){
          cntntUl.classList.remove('nested');
          toggler.classList.add('active');
        }
      }

      if(!this.expandedViews.includes(`SGC-${this.pid}-${this.level}-${id}`)){
        this.expandedViews.push(`SGC-${this.pid}-${this.level}-${id}`);

        //pass event to the parent
        const uid = `${this.name}-${this.pid}`;
        this._fileService.addEventOriginator(uid);
        this._fileService.fetchDirectoryDataNotify.next(path);
        setTimeout(()=>{ this.showExpandedViews();}, this.SECONDS_DELAY);
      }
    }
  }

  showGrandChildren_B(id:number):void{

    // console.log('SGC--treeData:', this.treeData);//TBD
    const ulId = `tp-fileExplrTreeView-${this.pid}-${this.level}-${id}`;
    const imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}-${id}`;

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    // console.log('SGC_B toggler:', toggler);//TBD
    // console.log('SGC_B imgDiv:', imgDiv);//TBD
    if(toggler && imgDiv){
      toggler.classList.add('active');
      imgDiv.classList.add('caret-active');
    }
  }

  showGreatGrandChildren( path:string, id:number, id1:number):void{

    const ulId = `tp-fileExplrTreeView-${this.pid}-${this.level}-${id}-${id1}`;
    const imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}-${id}-${id1}`;
    const ulId1 =`newtree-${this.pid}-${this.level}-${id}-${id1}`;

    // console.log('SGGC--passed id:', ulId);//TBD
    // console.log('SGGC--passed imgId:', imgId);//TBD

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;
    const newTree =  document.getElementById(ulId1) as HTMLElement;

    if(newTree){
      const hasNestedClass = this.hasClass(newTree,'nested');
      const hasActiveClass = this.hasClass(newTree,'active');
      if(!hasActiveClass && !hasNestedClass){
        newTree.classList.add('nested');
      }else if(hasActiveClass && !hasNestedClass){
        newTree.classList.remove('active');
        newTree.classList.add('nested');
      }else{
        newTree.classList.remove('nested');
        newTree.classList.add('active');
      }
    }

    if(toggler && imgDiv){
      //console.log('SGGC--toggler:', toggler);

      const hasNestedClass = this.hasClass(toggler,'nested');
      const hasActiveClass = this.hasClass(toggler,'active');

      if(!hasActiveClass && !hasNestedClass){
        toggler.classList.add('active');
        imgDiv.classList.add('caret-active');
      }else if(hasActiveClass && !hasNestedClass){
        toggler.classList.remove('active');
        imgDiv.classList.remove('caret-active');
        toggler.classList.add('nested');
        imgDiv.classList.add('caret-nested');
      }else{
        toggler.classList.remove('nested');
        imgDiv.classList.remove('caret-nested');
        toggler.classList.add('active');
        imgDiv.classList.add('caret-active');
      }

      if(!this.expandedViews.includes(`SGGC-${this.pid}-${this.level}-${id}-${id1}`)){
        this.expandedViews.push(`SGGC-${this.pid}-${this.level}-${id}-${id1}`);

        //pass event to the parent
        const uid = `${this.name}-${this.pid}`;
        this._fileService.addEventOriginator(uid);
        this._fileService.fetchDirectoryDataNotify.next(path);
        setTimeout(()=>{ this.showExpandedViews();}, this.SECONDS_DELAY);
      }
    }
    
  }

  showGreatGrandChildren_B(id:number, id1:number):void{

    const ulId = `tp-fileExplrTreeView-${this.pid}-${this.level}-${id}-${id1}`;
    const imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}-${id}-${id1}`;

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    // console.log('SGGC_B toggler:', toggler); //TBD
    // console.log('SGGC_B imgDiv:', imgDiv); //TBD

    if(toggler && imgDiv){
      toggler.classList.add('active');
      imgDiv.classList.add('caret-active');
    }
  }

  showExpandedViews():void{
    for(const el of this.expandedViews){
      const arr = el.split('-');
      console.log('arr:', arr);
      if(arr[0] == 'SGC'){
        const id = Number(arr[3]);
        this.showGrandChildren_B(id);
      }else{
        const id = Number(arr[3]);
        const id1 = Number(arr[4]);
        this.showGreatGrandChildren_B(id, id1);
      }
    }
  }

  navigateToSelectedPath(name:string, path:string):void{
    const data:string[] = [name, path];

    const uid = `filetreeview-1-${this.pid}`;
    this._fileService.addEventOriginator(uid);

    this._audioService.play(this.cheetahNavAudio);
    this._fileService.goToDirectoryNotify.next(data);
  }

  setcolorChevron(isActive:boolean):void{
    if(!isActive){
      this.chevronBtnStyle ={
        'fill': '#191919',
        'transition': 'fill 0.75s ease'
     }
    }else{
      this.chevronBtnStyle ={
        'fill': '#ccc',
        'transition': 'fill 0.5s ease'
     }
    }
  }

  colorChevron(id?:number, id1?:number):void{
    let imgId = Constants.EMPTY_STRING;

    if(id === this.negTen && id1 === this.negTen ){
      imgId = `qa-fileExplrTreeView-img-${this.pid}`;
    }

    if(id === undefined && id1 === undefined ){
      imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}`;
    }

    if(id !== undefined && id1 === undefined )
      imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}-${id}`;

    if(id !== undefined && id1 !== undefined )
      imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}-${id}-${id1}`;

    const imgDiv =  document.getElementById(imgId) as HTMLElement;
    if(imgDiv){
      imgDiv.style.fill = 'rgb(18, 107, 240)';
    }
  }

  unColorChevron(id?:number, id1?:number):void{
    let imgId = Constants.EMPTY_STRING;

    if(id === this.negTen && id1 === this.negTen ){
      imgId = `qa-fileExplrTreeView-img-${this.pid}`;
    }

    if(id === undefined && id1 === undefined ){
      imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}`;
    }

    if(id !== undefined && id1 === undefined )
      imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}-${id}`;

    if(id !== undefined && id1 !== undefined )
      imgId = `tp-fileExplrTreeView-img-${this.pid}-${this.level}-${id}-${id1}`;

    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(imgDiv){
      imgDiv.style.fill = '#ccc';
    }
  }

  onBtnClick(elmntId:string):void{
    // remove style on previous btn
    this.removeBtnStyle(this.selectedElementId);
    // update id
    this.selectedElementId = elmntId;
    this.isClicked = true;
    this.setBtnStyle(elmntId, true);
  }

  onMouseEnter(elmntId:string):void{
    console.log('onMouseEnter-elmntId:',elmntId);
    this.setBtnStyle(elmntId, true);
  }

  onMouseLeave(elmntId:string):void{
    console.log('onMouseLeave-elmntId:',elmntId);
    if(elmntId != this.selectedElementId){
      this.removeBtnStyle(elmntId);
    }
    else if((elmntId == this.selectedElementId)){
      this.setBtnStyle(elmntId,false);
    }
  }

  setBtnStyle(elmntId:string, isMouseHover:boolean):void{
    const btnElement = document.getElementById(elmntId) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = '#4c4c4c';
      if(this.selectedElementId == elmntId){
        if(isMouseHover){
          btnElement.style.backgroundColor ='#787474'
        }

        if(!isMouseHover){
          btnElement.style.backgroundColor = '#4c4c4c';
        }
      }
    }
  }

  removeBtnStyle(elmntId:string):void{
    const btnElement = document.getElementById(elmntId) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = Constants.EMPTY_STRING;
      btnElement.style.border = 'none'
    }
  }

}
