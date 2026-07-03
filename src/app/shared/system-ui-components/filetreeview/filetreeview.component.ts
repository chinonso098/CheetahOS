
/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, Input, OnInit, OnChanges, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Constants } from 'src/app/system-files/constants';
import { AudioService } from '../../system-service/audio.services';
import { FileService } from '../../system-service/file.service';
import { MenuService } from '../../system-service/menu.services';
import { GeneralMenu } from '../menu/menu.types';

import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { FileTreeNode } from 'src/app/system-files/commons/common.interfaces';
import { FileInfo } from 'src/app/system-files/fs/file.info';


@Component({
  selector: 'cos-filetreeview',
  templateUrl: './filetreeview.component.html',
  styleUrl: './filetreeview.component.css',
  standalone: false,
})
export class FileTreeViewComponent implements OnInit, OnChanges, OnDestroy {

  // ── Inputs ──
  @Input() pId = 0;
  @Input() level = 0;
  @Input() showRoot = true;
  @Input() isHoverActive = false;
  @Input() levelSrcId = Constants.EMPTY_STRING;
  @Input() treeData: FileTreeNode[] = [];

  private _fileService!:FileService;
  private _audioService!:AudioService;
  private _menuService!:MenuService;
  private _processHandlerService!:ProcessHandlerService;
  private _closeContextMenuSub?: Subscription;

  // ── Template-bound state ──
  quickAccessData: FileTreeNode[] = [];
  selectedFileTreeNode!: FileTreeNode;
  chevronBtnStyle: Record<string, unknown> = {};
  fileExplrTreeCntxtMenuStyle: Record<string, unknown> = {};
  showIconCntxtMenu = false;
  processId = 0;
  nextLevel = 0;
  nextLevelSrcId = Constants.EMPTY_STRING;

  // Context menu relocated to document.body on open so it can extend past the
  // file-explorer window's overflow:hidden + transform clipping (same approach
  // as the main file list and its tooltip). `read: ElementRef` is required
  // because the ref points at a `cos-menu` component — otherwise Angular hands
  // back the component instance, which has no `nativeElement`.
  @ViewChild('treeCtxMenu', {static: false, read: ElementRef}) treeCtxMenuRef?: ElementRef<HTMLElement>;

  // ── Constants exposed to template ──
  readonly QUICK_ACCESS_SENTINEL = 10;
  readonly QUICK_ACCESS = 'Quick access';
  readonly THIS_PC = Constants.THISPC;
  readonly thisPC = Constants.THISPC.replace(Constants.BLANK_SPACE, Constants.DASH);
  readonly fileExplrMngrMenuOption = Constants.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;
  readonly menuOrder = Constants.EMPTY_STRING;

  sourceData: GeneralMenu[] = [
    { icon: Constants.EMPTY_STRING, label: 'Open',              action: this.onContextOpen.bind(this) },
    { icon: Constants.EMPTY_STRING, label: 'Open in new window', action: this.openFolderPath.bind(this) },
    { icon: Constants.EMPTY_STRING, label: 'Properties',         action: this.showPropertiesWindow.bind(this) },
  ];

  // ── Internal state ──
  private readonly name = 'filetreeview';
  private readonly NAV_AUDIO = `${Constants.AUDIO_BASE_PATH}cheetah_navigation_click.wav`;
  private readonly EXPAND_DELAY_MS = 350;
  private expandedViewKeys: Set<string> = new Set();
  private selectedElementId = Constants.EMPTY_STRING;
  private isClicked = false;

  constructor(fileService:FileService, audioService:AudioService, menuService:MenuService,
              processHandlerService:ProcessHandlerService){
    this._fileService = fileService;
    this._audioService = audioService;
    this._menuService = menuService;
    this._processHandlerService = processHandlerService;
  }

  // ────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────

  ngOnInit():void{
    this.updateChevronFill(this.isHoverActive);
    this.quickAccessData = this.buildQuickAccessData();

    // Close this tree's context menu when told to (e.g. clicking the desktop,
    // another window, or any surface that opens its own menu). Targeted by uId
    // so sibling trees sharing a `name` don't all close. Mirrors the
    // fileexplorer/desktop pattern — without it the body-relocated menu would
    // linger after an outside click.
    const uId = `${this.name}-${this.processId}`;
    this._closeContextMenuSub = this._menuService.closeContextMenu.subscribe((ownerUId) => {
      if(ownerUId === uId)
        this.showIconCntxtMenu = false;
    });
  }

  ngOnDestroy():void{
    this._closeContextMenuSub?.unsubscribe();
  }

  ngOnChanges():void{
    this.processId = this.pId;
    this.nextLevel = this.level + 1;
    this.nextLevelSrcId = this.levelSrcId;
    this.updateChevronFill(this.isHoverActive);
  }

  // ────────────────────────────────────────────
  // Toggle helpers (shared logic)
  // ────────────────────────────────────────────

  /**
   * Toggle CSS classes for expand/collapse on a root-level section (Quick Access or This PC).
   */
  showRootLevel(prefix: string):void{
    const isThisPC = prefix === 'tp-fileExplrTreeView';
    const ulId  = isThisPC ? `ul-${this.pId}-0` : `qa-ul-${this.pId}`;
    const imgId = isThisPC
      ? `tp-fileExplrTreeView-img-${this.pId}-${this.level}`
      : `qa-fileExplrTreeView-img-${this.pId}`;

    this.toggleRootVisibility(ulId, imgId);
  }

  /**
   * Toggle a grandchild node (first-level expansion under This PC).
   */
  async showFirstLevel(path: string, id: number):Promise<void>{
    const baseId  = `tp-fileExplrTreeView-${this.pId}-${this.level}-${id}`;
    const imgId   = `tp-fileExplrTreeView-img-${this.pId}-${this.level}-${id}`;
    const contentId = `ul-${this.pId}-${this.level}-${id}`;

    const toggler  = document.getElementById(baseId) as HTMLElement;
    const imgDiv   = document.getElementById(imgId)  as HTMLElement;
    const contentUl = document.getElementById(contentId) as HTMLElement;

    if(toggler && imgDiv){
      this.toggleChildVisibility(toggler, imgDiv, contentUl);
      await this.fetchIfFirstExpand(`SGC-${this.pId}-${this.level}-${id}`, path);
    }
  }

  /**
   * Toggle a great-grandchild node (second-level expansion).
   */
  async showSecondLevel(path: string, id: number, id1: number):Promise<void>{
    const baseId  = `tp-fileExplrTreeView-${this.pId}-${this.level}-${id}-${id1}`;
    const imgId   = `tp-fileExplrTreeView-img-${this.pId}-${this.level}-${id}-${id1}`;
    const treeId  = `newtree-${this.pId}-${this.level}-${id}-${id1}`;

    const toggler = document.getElementById(baseId) as HTMLElement;
    const imgDiv  = document.getElementById(imgId)  as HTMLElement;
    const newTree = document.getElementById(treeId)  as HTMLElement;

    if(newTree){
      this.toggleSimpleVisibility(newTree);
    }

    if (toggler && imgDiv) {
      this.toggleChildVisibility(toggler, imgDiv);
      await this.fetchIfFirstExpand(`SGGC-${this.pId}-${this.level}-${id}-${id1}`, path);
    }
  }

  // ────────────────────────────────────────────
  // Navigation
  // ────────────────────────────────────────────

  async navigateToSelectedPath(evt: MouseEvent, name: string, path: string):Promise<void>{
    evt.stopPropagation();
    const uId = `filetreeview-1-${this.pId}`;
    this._fileService.addEventOriginator(uId);
    await this._audioService.play(this.NAV_AUDIO);
    this._fileService.goToDirectoryNotify.next([name, path]);
  }

  // ────────────────────────────────────────────
  // Chevron colour on hover
  // ────────────────────────────────────────────

  colorChevron(id?: number, id1?: number): void {
    this.setChevronFillById(this.resolveChevronImgId(id, id1), 'rgb(18, 107, 240)');
  }

  unColorChevron(id?: number, id1?: number): void {
    this.setChevronFillById(this.resolveChevronImgId(id, id1), 'var(--fx-text-dim, #ccc)');
  }

  // ────────────────────────────────────────────
  // Row highlight (click / hover)
  // ────────────────────────────────────────────

  onBtnClick(evt: MouseEvent, elmntId: string):void{
    this.removeBtnStyle(this.selectedElementId);
    this.selectedElementId = elmntId;
    this.isClicked = true;
    this.setBtnStyle(elmntId, true);
    evt.stopPropagation();
  }

  onMouseEnter(elmntId: string): void {
    this.setBtnStyle(elmntId, true);
  }

  onMouseLeave(elmntId: string):void{
    if (elmntId !== this.selectedElementId) {
      this.removeBtnStyle(elmntId);
    } else {
      this.setBtnStyle(elmntId, false);
    }
  }

  // ────────────────────────────────────────────
  // Context menu
  // ────────────────────────────────────────────

  onFileTreeContextMenu(evt: MouseEvent, node: FileTreeNode):void{
    evt.preventDefault();
    evt.stopPropagation();

    // Register this tree view as the open-menu owner; closes any other open menu.
    this._menuService.openContextMenu(`${this.name}-${this.processId}`);

    this.showIconCntxtMenu = true;
    this.selectedFileTreeNode = node;

    // `position: fixed` + viewport coordinates so the menu is correct after it
    // is lifted to document.body below. The -90/-115 offsets are the same
    // cursor-relative nudge the previous absolute placement resolved to on
    // screen, so the menu still appears in the same spot relative to the click.
    this.fileExplrTreeCntxtMenuStyle = {
      'position': 'fixed',
      'left': `${evt.clientX - 90}px`,
      'top': `${evt.clientY - 90}px`,
      'z-index': Constants.Z_INDEX_FILE_EXPLORER_CONTEXT_MENU,
    };

    // Lift the freshly-rendered menu out of the window into document.body.
    setTimeout(() => this.relocateMenuToBody(), 0);
  }

  /**
   * Move the tree-view context menu into `document.body` so it can extend past
   * the file-explorer window's clipped edges. Runs on every open because the
   * menu is an *ngIf node recreated each time. The `cos-menu` CSS is
   * self-contained (no `--fx-*` dependency), so no theme variables need copying.
   * Angular still owns the node by reference, so the `[style]` binding keeps
   * updating and `*ngIf` removal still tears it down correctly under body.
   */
  private relocateMenuToBody(): void {
    const menu = this.treeCtxMenuRef?.nativeElement;
    if(!menu) return;
    if(menu.parentElement !== document.body)
      document.body.appendChild(menu);
  }

  // ────────────────────────────────────────────
  // Context menu actions
  // ────────────────────────────────────────────

  openFolderPath(): void {
    this.showIconCntxtMenu = false;

    const file = new FileInfo();
    file.setFileName = this.selectedFileTreeNode.name;
    file.setOpensWith = Constants.FILE_EXPLORER;
    file.setIsFile = false;
    file.setCurrentPath = this.selectedFileTreeNode.path;

    this._processHandlerService.runApplication(file);
  }

  showPropertiesWindow(): void {
    this.showIconCntxtMenu = false;

    const file = new FileInfo();
    file.setFileName = this.selectedFileTreeNode.name;
    file.setCurrentPath = this.selectedFileTreeNode.path;
    file.setIsFile = false;
    file.setFileType = Constants.FOLDER;
    file.setIconPath = this.getIconPath(this.selectedFileTreeNode.name, this.selectedFileTreeNode.path);

    this._menuService.showPropertiesView.next(file);
  }

  getIconPath(nodeName:string, nodePath:string):string{
    const imgPath = (nodeName ==='3D-Objects' && nodePath === '/Users/3D-Objects') ? `${Constants.IMAGE_BASE_PATH}3d-objects_folder_small.png` : 
                    (nodeName === 'Desktop' && nodePath === '/Users/Desktop') ? `${Constants.IMAGE_BASE_PATH}desktop_folder_small.png` :  
                    (nodeName === 'Documents' && nodePath === '/Users/Documents') ? `${Constants.IMAGE_BASE_PATH}documents_folder_small.png` :
                    (nodeName === 'Downloads' && nodePath === '/Users/Downloads') ? `${Constants.IMAGE_BASE_PATH}downloads_folder_small.png` :
                    (nodeName === 'Games' && nodePath === '/Users/Games') ? `${Constants.IMAGE_BASE_PATH}games_folder_small.png` :
                    (nodeName === 'Music' && nodePath === '/Users/Music') ? `${Constants.IMAGE_BASE_PATH}music_folder_small.png` : 
                    (nodeName === 'Pictures' && nodePath === '/Users/Pictures') ? `${Constants.IMAGE_BASE_PATH}pictures_folder_small.png` :
                    (nodeName === 'Videos' && nodePath === '/Users/Videos') ? `${Constants.IMAGE_BASE_PATH}videos_folder_small.png` : 
                    (nodeName === Constants.OSDISK && nodePath === Constants.ROOT) ? `${Constants.IMAGE_BASE_PATH}os_disk.png` : `${Constants.IMAGE_BASE_PATH}folder_folder_small.png`

    return imgPath;                                                                                                                    
  }

  // ────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────

  private buildQuickAccessData(): FileTreeNode[] {
    return [
      { name: 'Pictures', path: '/Users/Pictures',       isFolder: true, children: [] },
      { name: 'Videos',   path: '/Users/Videos',         isFolder: true, children: [] },
      { name: 'PDFs',     path: '/Users/Documents/PDFs', isFolder: true, children: [] },
    ];
  }

  /** Navigate from the context-menu "Open" action. */
  private onContextOpen(): void {
    this.showIconCntxtMenu = false;
    const uId = `filetreeview-1-${this.pId}`;
    this._fileService.addEventOriginator(uId);
    this._fileService.goToDirectoryNotify.next([
      this.selectedFileTreeNode.name,
      this.selectedFileTreeNode.path,
    ]);
  }

  /** Toggle root-level (Quick Access / This PC) expand/collapse. */
  private toggleRootVisibility(ulId: string, imgId: string): void {
    const toggler = document.getElementById(ulId)  as HTMLElement;
    const imgDiv  = document.getElementById(imgId) as HTMLElement;
    if (!toggler || !imgDiv) { return; }

    const isActive = toggler.classList.contains('active');
    const isNested = toggler.classList.contains('nested');

    if (isActive || (!isActive && !isNested)) {
      // collapse
      toggler.classList.remove('active');
      imgDiv.classList.remove('root-caret-active');
      toggler.classList.add('nested');
      imgDiv.classList.add('root-caret-nested');
    } else {
      // expand
      toggler.classList.remove('nested');
      imgDiv.classList.remove('root-caret-nested');
      toggler.classList.add('active');
      imgDiv.classList.add('root-caret-active');
    }
  }

  /** Toggle child-level expand/collapse with optional content list. */
  private toggleChildVisibility(toggler: HTMLElement, imgDiv: HTMLElement, contentUl?: HTMLElement): void {
    const isActive = toggler.classList.contains('active');
    const isNested = toggler.classList.contains('nested');

    if(!isActive && !isNested){
      // first click → expand
      toggler.classList.add('active');
      imgDiv.classList.add('caret-active');
    }else if (isActive){
      // collapse
      toggler.classList.remove('active');
      imgDiv.classList.remove('caret-active');
      toggler.classList.add('nested');
      imgDiv.classList.add('caret-nested');
      if(contentUl){
        contentUl.classList.remove('active');
        contentUl.classList.add('nested');
      }
    }else{
      // re-expand from nested
      toggler.classList.remove('nested');
      imgDiv.classList.remove('caret-nested');
      toggler.classList.add('active');
      imgDiv.classList.add('caret-active');
      if(contentUl){
        contentUl.classList.remove('nested');
        toggler.classList.add('active');
      }
    }
  }

  /** Simple toggle for subtree containers without caret logic. */
  private toggleSimpleVisibility(el: HTMLElement): void {
    const isActive = el.classList.contains('active');
    const isNested = el.classList.contains('nested');

    if(!isActive && !isNested){
      el.classList.add('nested');
    } else if (isActive) {
      el.classList.remove('active');
      el.classList.add('nested');
    } else {
      el.classList.remove('nested');
      el.classList.add('active');
    }
  }

  /** Force-expand a node by id segments (used to restore expanded state). */
  private forceExpand(...ids: number[]): void {
    const suffix = ids.join('-');
    const ulId  = `tp-fileExplrTreeView-${this.pId}-${this.level}-${suffix}`;
    const imgId = `tp-fileExplrTreeView-img-${this.pId}-${this.level}-${suffix}`;

    const toggler = document.getElementById(ulId)  as HTMLElement;
    const imgDiv  = document.getElementById(imgId) as HTMLElement;
    if(toggler && imgDiv){
      toggler.classList.add('active');
      imgDiv.classList.add('caret-active');
    }
  }

  /** Fetch directory data on first expansion, then re-apply expanded states. */
  private async fetchIfFirstExpand(key: string, path: string): Promise<void> {
    if (this.expandedViewKeys.has(key)) { return; }
    this.expandedViewKeys.add(key);

    const uId = `${this.name}-${this.pId}`;
    this._fileService.addEventOriginator(uId);
    this._fileService.fetchDirectoryDataNotify.next(path);

    await CommonFunctions.sleep(this.EXPAND_DELAY_MS);
    this.restoreExpandedViews();
  }

  /** Re-apply 'active' state for all previously expanded nodes. */
  private restoreExpandedViews(): void {
    for (const key of this.expandedViewKeys) {
      const parts = key.split('-');
      if (parts[0] === 'SGC') {
        this.forceExpand(Number(parts[3]));
      } else {
        this.forceExpand(Number(parts[3]), Number(parts[4]));
      }
    }
  }

  /** Resolve the chevron SVG element id from optional index params. */
  private resolveChevronImgId(id?: number, id1?: number): string {
    if (id === this.QUICK_ACCESS_SENTINEL && id1 === this.QUICK_ACCESS_SENTINEL) {
      return `qa-fileExplrTreeView-img-${this.pId}`;
    }
    const base = `tp-fileExplrTreeView-img-${this.pId}-${this.level}`;
    if (id === undefined) { return base; }
    if (id1 === undefined) { return `${base}-${id}`; }
    return `${base}-${id}-${id1}`;
  }

  /** Set the fill colour on a chevron SVG element. */
  private setChevronFillById(imgId: string, color: string): void {
    const el = document.getElementById(imgId) as HTMLElement;
    if (el) { el.style.fill = color; }
  }

  /** Update the default chevron fill based on hover state. */
  private updateChevronFill(isActive: boolean): void {
    // Theme-aware: `--fx-text-dim` (visible) and `--fx-panel` (blends into the
    // pane so the chevron stays "hidden" until hover) inherit from the File
    // Explorer host via the CSS custom-property cascade. Hex fallbacks preserve
    // the original dark-theme look when used outside a themed host.
    this.chevronBtnStyle = isActive
      ? { 'fill': 'var(--fx-text-dim, #ccc)',    'transition': 'fill 0.5s ease' }
      : { 'fill': 'var(--fx-panel, #191919)', 'transition': 'fill 0.75s ease' };
  }

  private setBtnStyle(elmntId: string, isMouseHover: boolean): void {
    const el = document.getElementById(elmntId) as HTMLElement;
    if (!el) { return; }

    // Theme-aware row highlight. `--fx-icon-selected-bg` / `--fx-icon-hover-bg`
    // inherit from the File Explorer host via the CSS custom-property cascade;
    // hex fallbacks keep the original dark-theme colours elsewhere.
    el.style.backgroundColor = (this.selectedElementId === elmntId && isMouseHover)
      ? 'var(--fx-icon-selected-bg, #787474)'
      : 'var(--fx-icon-hover-bg, #4c4c4c)';
  }

  private removeBtnStyle(elmntId: string): void {
    const el = document.getElementById(elmntId) as HTMLElement;
    if (!el) return;

    el.style.backgroundColor = Constants.EMPTY_STRING;
    el.style.border = 'none';
  }
}