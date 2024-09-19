import { Component, EventEmitter, Input, OnInit, Output, OnChanges } from '@angular/core';
import { FileTreeNode } from 'src/app/system-files/file.tree.node';

@Component({
  selector: 'cos-filetreeview',
  templateUrl: './filetreeview.component.html',
  styleUrl: './filetreeview.component.css'
})
export class FileTreeViewComponent implements OnInit, OnChanges {
  @Input() pid = 0;
  @Input() level = 0;
  @Input() showRoot = true;
  @Input() isHoverActive = false;
  @Input() treeData: FileTreeNode[] = [];
  @Output() updateFileTreeData = new EventEmitter<string>();
  @Output() navigateToPath = new EventEmitter<string[]>();

  chevronBtnStyle:Record<string, unknown> = {};
  expandedViews:string[]= [];
  selectedElementId = '';
  processId = 0;
  nextLevel = 0;

  constructor( ){
1
  }

  ngOnInit():void{
    this.setcolorChevron(this.isHoverActive);
  }

  ngOnChanges():void{
    //console.log('FILETREE onCHANGES:',this.isHoverActive);
    console.log('fileTreeViewPid:', this.pid);
    console.log('fileTreeViewLvl:', this.level);
    this.processId = this.pid;
    this.nextLevel = this.level + 1;
    this.setcolorChevron(this.isHoverActive);
  }

  showChildren(name?:string):void{
    let ulId = '';   let imgId = ''

    ulId = `fileExplrTreeView-${this.pid}-${this.level}`;
    imgId = `fileExplrTreeView-img-${this.pid}-${this.level}`;

    console.log('passed id:', ulId);
    console.log('passed imgId:', imgId);
    console.log('passed name:', name);

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(toggler){
      console.log('toggler:', toggler);
      toggler.parentElement?.querySelector(".nested")?.classList.toggle("active");
    
      if(imgDiv){
        console.log('imgDiv:', imgDiv);
        imgDiv.style.transform = 'rotate(90deg)';
        imgDiv.style.position = 'relative';
      }
    }
  }

  showGrandChildren(path:string, id:number,):void{
    const ulId = `fileExplrTreeView-${this.pid}-${this.level}-${id}`;
    const imgId = `fileExplrTreeView-img-${this.pid}-${this.level}-${id}`;
    console.log('passed id:', ulId);
    console.log('passed imgId:', imgId);

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(toggler){
      console.log('toggler:', toggler);
     // toggler.parentElement?.querySelector(".nested")?.classList.toggle("active");
    

      //toggler.classList.remove("nested");
      //toggler.classList.remove("active");
      //toggler.classList.toggle("caret-down");

      if(imgDiv){

        this.expandedViews.push(`SGC-${this.pid}-${this.level}-${id}`);
        console.log('imgDiv:', imgDiv);
        imgDiv.style.transform = 'rotate(90deg)';
        imgDiv.style.position = 'relative';
      }

      //pass event to the parent
      this.updateFileTreeData.emit(path);

      setTimeout(()=>{ this.showExpandedViews();}, 2000);
    }
  }

  showGrandChildren_B(id:number):void{
    const ulId = `fileExplrTreeView-${this.pid}-${this.level}-${id}`;
    const imgId = `fileExplrTreeView-img-${this.pid}-${this.level}-${id}`;

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(toggler){
      if(imgDiv){
        console.log('imgDiv:', imgDiv);
        imgDiv.style.transform = 'rotate(90deg)';
        imgDiv.style.position = 'relative';
      }

    }
  }

  showGreatGrandChildren( path:string, id:number, id1:number):void{

    const ulId = `fileExplrTreeView-${this.pid}-${this.level}-${id}-${id1}`;
    const imgId = `fileExplrTreeView-img-${this.pid}-${this.level}-${id}-${id1}`;

    console.log('passed id:', ulId);
    console.log('passed imgId:', imgId);

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(toggler){
      console.log('toggler:', toggler);
      //toggler.parentElement?.querySelector(".nested")?.classList.toggle("active");
    

      //toggler.classList.remove("nested");
      //toggler.classList.remove("active");
      //toggler.classList.toggle("caret-down");

      if(imgDiv){
        this.expandedViews.push(`SGGC-${this.pid}-${this.level}-${id}-${id1}`);
        console.log('imgDiv:', imgDiv);
        imgDiv.style.transform = 'rotate(90deg)';
        imgDiv.style.position = 'relative';
      }

      //pass event to the parent
      this.updateFileTreeData.emit(path);

      setTimeout(()=>{ this.showExpandedViews();}, 2000);
    }
  }

  showGreatGrandChildren_B(id:number, id1:number):void{

    const ulId = `fileExplrTreeView-${this.pid}-${this.level}-${id}-${id1}`;
    const imgId = `fileExplrTreeView-img-${this.pid}-${this.level}-${id}-${id1}`;

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(toggler){
      if(imgDiv){
        console.log('imgDiv:', imgDiv);
        imgDiv.style.transform = 'rotate(90deg)';
        imgDiv.style.position = 'relative';
      }

    }
  }

  showExpandedViews():void{
    for(const el of this.expandedViews){
      const arr = el.split('-');
      console.log('arr:', arr);
      if(arr[0] == 'SGC'){
        const id = Number(arr[2]);
        this.showGrandChildren_B(id);
      }else{
        const id = Number(arr[2]);
        const id1 = Number(arr[3]);
        this.showGreatGrandChildren_B(id, id1);
      }
    }
  }

  navigateToSelectedPath(name:string, path:string):void{
    const data:string[] = [name, path]
    this.navigateToPath.emit(data);
  }

  setcolorChevron(isHoverActive:boolean):void{
    if(!isHoverActive){
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
    let imgId = ''

    if(id === undefined && id1 === undefined ){
      imgId = `fileExplrTreeView-img-${this.pid}-${this.level}`;
    }

    if(id !== undefined && id1 === undefined )
      imgId = `fileExplrTreeView-img-${this.pid}-${this.level}-${id}`;

    if(id !== undefined && id1 !== undefined )
      imgId = `fileExplrTreeView-img-${this.pid}-${this.level}-${id}-${id1}`;

    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(imgDiv){
      imgDiv.style.fill = 'rgb(18, 107, 240)';
    }
  }

  unColorChevron(id?:number, id1?:number):void{
    let imgId = ''

    if(id === undefined && id1 === undefined ){
      imgId = `fileExplrTreeView-img-${this.pid}-${this.level}`;
    }

    if(id !== undefined && id1 === undefined )
      imgId = `fileExplrTreeView-img-${this.pid}-${this.level}-${id}`;

    if(id !== undefined && id1 !== undefined )
      imgId = `fileExplrTreeView-img-${this.pid}-${this.level}-${id}-${id1}`;

    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(imgDiv){
      imgDiv.style.fill = '#ccc';
    }
  }

  onBtnClick(elmntId:string):void{
    this.selectedElementId = elmntId
    //this.setBtnStyle(id, true);
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
      // btnElement.style.border = '1px solid #3c3c3c';

      if(this.selectedElementId == elmntId){

        if(isMouseHover){
          btnElement.style.backgroundColor ='#787474'
        }

        // if(!isMouseHover && this.isIconInFocusDueToCurrentAction){
        //   btnElement.style.backgroundColor ='#787474'
        // }

        if(isMouseHover ){
          btnElement.style.backgroundColor = '#4c4c4c';
        }

        // if(!isMouseHover && this.isIconInFocusDueToPriorAction){
        //   btnElement.style.backgroundColor = 'transparent';
        //   btnElement.style.border = '0.5px solid white'
        // }
      }
    }

  }

  removeBtnStyle(elmntId:string):void{
    const btnElement = document.getElementById(elmntId) as HTMLElement;
    if(btnElement){
      btnElement.style.backgroundColor = 'transparent';
      btnElement.style.border = 'none'
    }
  }

}
