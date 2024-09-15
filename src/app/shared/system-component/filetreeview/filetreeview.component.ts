import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FileTreeNode } from 'src/app/system-files/file.tree.node';

@Component({
  selector: 'cos-filetreeview',
  templateUrl: './filetreeview.component.html',
  styleUrl: './filetreeview.component.css'
})
export class FileTreeViewComponent implements OnInit {
  @Input() treeData: FileTreeNode[] = [];
  @Input() pid = 0;
  @Output() updateFileTreeData = new EventEmitter<string>();

  chevronBtnStyle:Record<string, unknown> = {};
  expandedViews:string[]= [];

  constructor( ){
    //
  }

  ngOnInit():void{
    this.setcolorChevron();
  }

  showChildren(name?:string):void{
    let ulId = '';   let imgId = ''

    ulId = `fileExplrTreeView-${this.pid}`;
    imgId = `fileExplrTreeView-img-${this.pid}`;

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
    const ulId = `fileExplrTreeView-${this.pid}-${id}`;
    const imgId = `fileExplrTreeView-img-${this.pid}-${id}`;
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

        this.expandedViews.push(`SGC-${this.pid}-${id}`);
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
    const ulId = `fileExplrTreeView-${this.pid}-${id}`;
    const imgId = `fileExplrTreeView-img-${this.pid}-${id}`;

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
        1
      }
    }
  }

  showGreatGrandChildren(id?:number, id1?:number, path?:string):void{

    let ulId = '';   let imgId = ''

    if(id === undefined && id1 === undefined ){
      ulId = `fileExplrTreeView-${this.pid}`;
      imgId = `fileExplrTreeView-img-${this.pid}`;
    }

    if(id !== undefined && id1 === undefined )
      ulId = `fileExplrTreeView-${this.pid}-${id}`;

    if(id !== undefined && id1 !== undefined )
      ulId = `fileExplrTreeView-${this.pid}-${id}-${id1}`;

    console.log('passed id:', ulId);
    console.log('passed imgId:', imgId);

    const toggler =  document.getElementById(ulId) as HTMLElement;
    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(toggler){
      console.log('toggler:', toggler);
      toggler.parentElement?.querySelector(".nested")?.classList.toggle("active");
    

      //toggler.classList.remove("nested");
      //toggler.classList.remove("active");
      //toggler.classList.toggle("caret-down");

      if(imgDiv){
        this.expandedViews.push(`SGGC-${this.pid}-${id}`);
        console.log('imgDiv:', imgDiv);
        imgDiv.style.transform = 'rotate(90deg)';
        imgDiv.style.position = 'relative';
      }

      //pass event to the parent
      //this.getDataEvent.emit(path);
    }
  }



  showCurrentSelection(path:string):void{
   1
  }


  setcolorChevron():void{
    this.chevronBtnStyle ={
       'fill': '#ccc'
    }
  }

  colorChevron(id?:number, id1?:number):void{
    let imgId = ''

    if(id === undefined && id1 === undefined ){
      imgId = `fileExplrTreeView-img-${this.pid}`;
    }

    if(id !== undefined && id1 === undefined )
      imgId = `fileExplrTreeView-img-${this.pid}-${id}`;

    if(id !== undefined && id1 !== undefined )
      imgId = `fileExplrTreeView-img-${this.pid}-${id}-${id1}`;

    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(imgDiv){
      imgDiv.style.fill = 'rgb(18, 107, 240)';
    }
  }

  unColorChevron(id?:number, id1?:number):void{
    let imgId = ''

    if(id === undefined && id1 === undefined ){
      imgId = `fileExplrTreeView-img-${this.pid}`;
    }

    if(id !== undefined && id1 === undefined )
      imgId = `fileExplrTreeView-img-${this.pid}-${id}`;

    if(id !== undefined && id1 !== undefined )
      imgId = `fileExplrTreeView-img-${this.pid}-${id}-${id1}`;

    const imgDiv =  document.getElementById(imgId) as HTMLElement;

    if(imgDiv){
      imgDiv.style.fill = '#ccc';
    }
  }

}
