
/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { FileTreeNode } from 'src/app/system-files/common.interfaces';
import { Constants } from 'src/app/system-files/constants';
import { AudioService } from '../../system-service/audio.services';
import { FileService } from '../../system-service/file.service';
import { MenuService } from '../../system-service/menu.services';
import { GeneralMenu } from '../menu/menu.types';
import { FileInfo } from 'src/app/system-files/file.info';
import { ProcessHandlerService } from '../../system-service/process.handler.service';

/** Map of known folder names/paths to their icon filenames */
const ICON_MAP: Record<string, string> = {
  '3D-Objects:/Users/3D-Objects': '3d-objects_folder_small.png',
  'Desktop:/Users/Desktop':       'desktop_folder_small.png',
  'Documents:/Users/Documents':   'documents_folder_small.png',
  'Downloads:/Users/Downloads':   'downloads_folder_small.png',
  'Games:/Users/Games':           'games_folder_small.png',
  'Music:/Users/Music':           'music_folder_small.png',
  'Pictures:/Users/Pictures':     'pictures_folder_small.png',
  'Videos:/Users/Videos':         'videos_folder_small.png',
  [`${Constants.OSDISK}:${Constants.ROOT}`]: 'os_disk.png',
};

const ICON_BASE = 'osdrive/Cheetah/System/Imageres/';
const DEFAULT_FOLDER_ICON = `${ICON_BASE}folder_folder_small.png`;

@Component({
  selector: 'cos-filetreeview',
  templateUrl: './filetreeview.component.html',
  styleUrl: './filetreeview.component.css',
  standalone: false,
})
export class FileTreeViewComponent implements OnInit, OnChanges {

  // ── Inputs ──
  @Input() pId = 0;
  @Input() level = 0;
  @Input() showRoot = true;
  @Input() isHoverActive = false;
  @Input() levelSrcId = Constants.EMPTY_STRING;
  @Input() treeData: FileTreeNode[] = [];

  // ── Template-bound state ──
  quickAccessData: FileTreeNode[] = [];
  selectedFileTreeNode!: FileTreeNode;
  chevronBtnStyle: Record<string, unknown> = {};
  fileExplrTreeCntxtMenuStyle: Record<string, unknown> = {};
  showIconCntxtMenu = false;
  processId = 0;
  nextLevel = 0;
  nextLevelSrcId = Constants.EMPTY_STRING;

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
  private rect!: DOMRect;

  constructor(
    private _fileService: FileService,
    private _audioService: AudioService,
    private _menuService: MenuService,
    private _processHandlerService: ProcessHandlerService,
  ) {}

  // ────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────

  ngOnInit(): void {
    this.updateChevronFill(this.isHoverActive);
    this.quickAccessData = this.buildQuickAccessData();
  }

  ngOnChanges(): void {
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
  showChildren(prefix: string): void {
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
  showGrandChildren(path: string, id: number): void {
    const baseId  = `tp-fileExplrTreeView-${this.pId}-${this.level}-${id}`;
    const imgId   = `tp-fileExplrTreeView-img-${this.pId}-${this.level}-${id}`;
    const contentId = `ul-${this.pId}-${this.level}-${id}`;

    const toggler  = document.getElementById(baseId) as HTMLElement;
    const imgDiv   = document.getElementById(imgId)  as HTMLElement;
    const contentUl = document.getElementById(contentId) as HTMLElement;

    if (toggler && imgDiv) {
      this.toggleChildVisibility(toggler, imgDiv, contentUl);
      this.fetchIfFirstExpand(`SGC-${this.pId}-${this.level}-${id}`, path);
    }
  }

  /**
   * Toggle a great-grandchild node (second-level expansion).
   */
  showGreatGrandChildren(path: string, id: number, id1: number): void {
    const baseId  = `tp-fileExplrTreeView-${this.pId}-${this.level}-${id}-${id1}`;
    const imgId   = `tp-fileExplrTreeView-img-${this.pId}-${this.level}-${id}-${id1}`;
    const treeId  = `newtree-${this.pId}-${this.level}-${id}-${id1}`;

    const toggler = document.getElementById(baseId) as HTMLElement;
    const imgDiv  = document.getElementById(imgId)  as HTMLElement;
    const newTree = document.getElementById(treeId)  as HTMLElement;

    if (newTree) {
      this.toggleSimpleVisibility(newTree);
    }

    if (toggler && imgDiv) {
      this.toggleChildVisibility(toggler, imgDiv);
      this.fetchIfFirstExpand(`SGGC-${this.pId}-${this.level}-${id}-${id1}`, path);
    }
  }

  // ────────────────────────────────────────────
  // Navigation
  // ────────────────────────────────────────────

  async navigateToSelectedPath(evt: MouseEvent, name: string, path: string): Promise<void> {
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
    this.setChevronFillById(this.resolveChevronImgId(id, id1), '#ccc');
  }

  // ────────────────────────────────────────────
  // Row highlight (click / hover)
  // ────────────────────────────────────────────

  onBtnClick(evt: MouseEvent, elmntId: string): void {
    this.removeBtnStyle(this.selectedElementId);
    this.selectedElementId = elmntId;
    this.isClicked = true;
    this.setBtnStyle(elmntId, true);
    evt.stopPropagation();
  }

  onMouseEnter(elmntId: string): void {
    this.setBtnStyle(elmntId, true);
  }

  onMouseLeave(elmntId: string): void {
    if (elmntId !== this.selectedElementId) {
      this.removeBtnStyle(elmntId);
    } else {
      this.setBtnStyle(elmntId, false);
    }
  }

  // ────────────────────────────────────────────
  // Context menu
  // ────────────────────────────────────────────

  onFileTreeContextMenu(evt: MouseEvent, node: FileTreeNode): void {
    evt.preventDefault();
    evt.stopPropagation();

    this._menuService.hideContextMenus.next(this.name);

    if (!this.rect) {
      const el = document.getElementById(`qa-FileExplrTreeView-main-${this.processId}`) as HTMLElement;
      if (el) { this.rect = el.getBoundingClientRect(); }
    }

    this.showIconCntxtMenu = true;
    this.selectedFileTreeNode = node;

    const x = evt.clientX - this.rect.left;
    const y = evt.clientY - this.rect.top;
    this.fileExplrTreeCntxtMenuStyle = {
      'position': 'absolute',
      'transform': `translate(${x - 90}px, ${y - 115}px)`,
      'z-index': 2,
    };
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

  // ────────────────────────────────────────────
  // Icon resolution
  // ────────────────────────────────────────────

  getIconPath(nodeName: string, nodePath: string): string {
    const key = `${nodeName}:${nodePath}`;
    const fileName = ICON_MAP[key];
    return fileName ? `${ICON_BASE}${fileName}` : DEFAULT_FOLDER_ICON;
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

    if (!isActive && !isNested) {
      // first click → expand
      toggler.classList.add('active');
      imgDiv.classList.add('caret-active');
    } else if (isActive) {
      // collapse
      toggler.classList.remove('active');
      imgDiv.classList.remove('caret-active');
      toggler.classList.add('nested');
      imgDiv.classList.add('caret-nested');
      if (contentUl) {
        contentUl.classList.remove('active');
        contentUl.classList.add('nested');
      }
    } else {
      // re-expand from nested
      toggler.classList.remove('nested');
      imgDiv.classList.remove('caret-nested');
      toggler.classList.add('active');
      imgDiv.classList.add('caret-active');
      if (contentUl) {
        contentUl.classList.remove('nested');
        toggler.classList.add('active');
      }
    }
  }

  /** Simple toggle for subtree containers without caret logic. */
  private toggleSimpleVisibility(el: HTMLElement): void {
    const isActive = el.classList.contains('active');
    const isNested = el.classList.contains('nested');

    if (!isActive && !isNested) {
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
    if (toggler && imgDiv) {
      toggler.classList.add('active');
      imgDiv.classList.add('caret-active');
    }
  }

  /** Fetch directory data on first expansion, then re-apply expanded states. */
  private fetchIfFirstExpand(key: string, path: string): void {
    if (this.expandedViewKeys.has(key)) { return; }
    this.expandedViewKeys.add(key);

    const uId = `${this.name}-${this.pId}`;
    this._fileService.addEventOriginator(uId);
    this._fileService.fetchDirectoryDataNotify.next(path);
    setTimeout(() => this.restoreExpandedViews(), this.EXPAND_DELAY_MS);
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
    this.chevronBtnStyle = isActive
      ? { 'fill': '#ccc',    'transition': 'fill 0.5s ease' }
      : { 'fill': '#191919', 'transition': 'fill 0.75s ease' };
  }

  private setBtnStyle(elmntId: string, isMouseHover: boolean): void {
    const el = document.getElementById(elmntId) as HTMLElement;
    if (!el) { return; }

    el.style.backgroundColor = (this.selectedElementId === elmntId && isMouseHover)
      ? '#787474'
      : '#4c4c4c';
  }

  private removeBtnStyle(elmntId: string): void {
    const el = document.getElementById(elmntId) as HTMLElement;
    if (el) {
      el.style.backgroundColor = Constants.EMPTY_STRING;
      el.style.border = 'none';
    }
  }
}