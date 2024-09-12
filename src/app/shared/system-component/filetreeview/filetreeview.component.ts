import { Component, Input, OnInit } from '@angular/core';
import { FileTreeNode } from 'src/app/system-files/file.tree.node';

@Component({
  selector: 'cos-filetreeview',
  templateUrl: './filetreeview.component.html',
  styleUrl: './filetreeview.component.css'
})
export class FileTreeViewComponent implements OnInit {
  @Input() treeData: FileTreeNode[] = [];
  @Input() pid = 0;

  chevronBtnStyle:Record<string, unknown> = {};


  ngOnInit():void{

    this.setcolorChevron();
  }

  showChildren(id?:number, id1?:number):void{

    let ulId = ''

    if(id === undefined && id1 === undefined )
       ulId = `fileExplrTreeView-${this.pid}`;

    if(id !== undefined && id1 === undefined )
      ulId = `fileExplrTreeView-${this.pid}-${id}`;

    if(id !== undefined && id1 !== undefined )
      ulId = `fileExplrTreeView-${this.pid}-${id}-${id1}`;

    console.log('passed id:', ulId);
    const toggler =  document.getElementById(ulId) as HTMLElement;
    if(toggler){
      console.log('toggler:', toggler);
      toggler.parentElement?.querySelector(".nested")?.classList.toggle("active");
      toggler.classList.toggle("caret-down");
    }
  }

  showCurrentSelection():void{
   1
  }


  setcolorChevron():void{
    this.chevronBtnStyle ={
       'fill': '#ccc'
    }
  }

  colorChevron():void{
    this.chevronBtnStyle ={
      'fill': 'rgb(18, 107, 240)'
    }
  }

  unColorChevron():void{
    this.chevronBtnStyle ={
      'fill': '#ccc'
    }
  }

}
