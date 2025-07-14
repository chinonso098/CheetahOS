import { basename, extname, join, resolve } from '@zenfs/core/vfs/path.js';
import { FileInfo2 } from "src/app/system-files/file.info2";
import { ShortCut } from 'src/app/system-files/shortcut';


import { Buffer } from 'buffer';
import ini from 'ini';

import type { Dirent, ErrnoError, IndexData, Stats } from '@zenfs/core';
import { configure, CopyOnWrite, Fetch, default as fs } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';
import OSFileSystemIndex from '../../../../index.json';

import { Constants } from "src/app/system-files/constants";
import { FileContent2 } from "src/app/system-files/file.content";
import { err } from "@zenfs/core/internal/log.js";
/// <reference types="node" />


const fsPrefix = 'osdrive';
const currentURL = window.location.href;
const fileAndAppIconAssociation:Map<string,string> =  new Map<string, string>();


export const configured = configure({

    mounts: {
        '/': {
            backend: CopyOnWrite,
            readable: {
                backend: Fetch,
                index: OSFileSystemIndex as IndexData,
                baseUrl: `${currentURL}${fsPrefix}`,
            },
            writable: {
                backend: IndexedDB,
                storeName: 'fs-cache',
            },
        },
    },
});

function throwWithPath(error: ErrnoError): never {
    // We want the path in the message, since Angular won't throw the actual error.
    error.message = error.toString();
    throw error;
}

export async function isDirectory(path: string):Promise<boolean>{
    await configured;
    try{
        const stats = await fs.promises.stat(path)
        return stats.isDirectory();
    }catch{
        console.error('isDirectory:', err);
        return false;
    }
}

export async function exists(dirPath: string): Promise<boolean> {
    await configured;
    return fs.promises.exists(dirPath).catch(throwWithPath);
}

export async function copy(source: string, destination: string): Promise<void> {
    await configured;
    const stats = await fs.promises.stat(destination);
    
    if (stats.isDirectory()) 
        destination = join(destination, basename(source));
    await fs.promises.cp(source, destination).catch(throwWithPath);
}

export async function readdir(path: string): Promise<string[]> {
    await configured;
    return await fs.promises.readdir(path).catch(throwWithPath);
}

export async function *loadDirectoryFiles(path: string): AsyncIterableIterator<FileInfo2> {
        console.log('loadDirectoryFiles:', path);
        await configured

        if (path === '/fileexplorer.url')
            debugger;

        for (const entry of await fs.promises
            .readdir(path, { withFileTypes: true })
            .catch(throwWithPath)) {
            yield await getFileInfo(join(path, entry.path), entry);
        }
}

async function getFileInfo(path:string, entry: Dirent):Promise<FileInfo2>{
    const extension = extname(path);
    let fileInfo = new FileInfo2();
    //const fileMetaData = await getExtraFileMetaDataAsync(path) as FileMetaData;
    
    if(!extension){
        const fc = await setOtherFolderProps(path) as FileContent2;
        fileInfo = populateFileInfo(path,false, Constants.EMPTY_STRING, Constants.EMPTY_STRING, false, undefined, fc);
        fileInfo.setIconPath = await changeFolderIcon(fc.fileName, fc.iconPath, path);
    }
    else if(extension === Constants.URL){
        const sc = await getShortCutFromURL(path) as ShortCut;
        fileInfo = populateFileInfo(path, true, Constants.EMPTY_STRING, Constants.EMPTY_STRING, true, sc);
        fileInfo.setIsShortCut = true;
    }
    else if(Constants.IMAGE_FILE_EXTENSIONS.includes(extension)){
        const fc = await getFileContentFromB64DataUrl(path, 'image') as FileContent2;
        fileInfo = populateFileInfo(path, true,'photoviewer', 'image_file.png', false,undefined, fc);
    }
    else if(Constants.VIDEO_FILE_EXTENSIONS.includes(extension)){
        const fc = await getFileContentFromB64DataUrl(path, 'video') as FileContent2;
        fileInfo = populateFileInfo(path,  true, 'videoplayer', 'video_file.png', false,undefined, fc);
    }
    else if(Constants.AUDIO_FILE_EXTENSIONS.includes(extension)){
        const fc = await getFileContentFromB64DataUrl(path, 'audio') as FileContent2;
        fileInfo = populateFileInfo(path,  true, 'audioplayer', 'music_file.png', false, undefined, fc);

    }else if(Constants.PROGRAMING_LANGUAGE_FILE_EXTENSIONS.includes(extension) || extension === '.wasm'){
        const img_file = (extension === '.wasm')? 'wasm_file.png' : 'code_file.png';
        fileInfo = populateFileInfo(path, true, 'codeeditor', img_file);
    }
    else if(extension === '.txt' || extension === '.properties' || extension === '.log'){
        fileInfo = populateFileInfo(path, true, 'texteditor', 'file.png');
    }
    else if(extension === '.md'){
        fileInfo = populateFileInfo(path, true, 'markdownviewer', 'markdown_file.png');
    }
    else if(extension === '.jsdos'){
        fileInfo = populateFileInfo(path, true, 'jsdos', 'js-dos_file.png');
    }
    else if(extension === '.swf'){
        fileInfo = populateFileInfo(path, true, 'ruffle', 'swf_file.png');
    }else if(extension === '.pdf'){
        fileInfo = populateFileInfo(path, true, 'pdfviewer', 'pdf.png');
    }
    else{
        fileInfo.setIconPath=`${Constants.IMAGE_BASE_PATH}unknown.png`;
        fileInfo.setCurrentPath = path;
        fileInfo.setFileName = basename(path, extname(path));
        // fileInfo.setDateModified = fileMetaData.getModifiedDate;
        // fileInfo.setSizeInBytes = fileMetaData.getSize;
        // fileInfo.setMode = fileMetaData.getMode;
        fileInfo.setFileExtension = extension;
    }
    addAppAssociaton(fileInfo.getOpensWith, fileInfo.getIconPath);
    return fileInfo;
}


function populateFileInfo(path:string, isFile =true, opensWith:string, imageName?:string, useImage=false, shortCut?:ShortCut, fileCntnt?:FileContent2):FileInfo2{
    const fileInfo2 = new FileInfo2();
    const img = `${Constants.IMAGE_BASE_PATH}${imageName}`;

    // fileInfo.setCurrentPath = path;
    // if(shortCut !== undefined){
    //     fileInfo.setIconPath = (useImage)? shortCut?.getIconPath || img : img;
    //     fileInfo.setContentPath = shortCut?.getContentPath || Constants.EMPTY_STRING;
    //     fileInfo.setFileType = shortCut?.getFileType || extname(path);
    //     fileInfo.setFileName = shortCut?.geFileName || basename(path, extname(path));
    //     fileInfo.setOpensWith = shortCut?.getOpensWith || opensWith;
    // }else{
    //     fileInfo.setIconPath = (useImage)? fileCntnt?.iconPath || img : img;
    //     fileInfo.setContentPath = fileCntnt?.contentPath || Constants.EMPTY_STRING;
    //     fileInfo.setFileType = fileCntnt?.fileType || extname(path);
    //     fileInfo.setFileName = fileCntnt?.fileName || basename(path, extname(path));
    //     fileInfo.setOpensWith = fileCntnt?.opensWith || opensWith;
    // }
    // fileInfo.setIsFile = isFile;
    // fileInfo.setDateModified = fileMetaData.getModifiedDate;
    // fileInfo.setSizeInBytes = fileMetaData.getSize;
    // fileInfo.setMode = fileMetaData.getMode;
    // fileInfo.setFileExtension = extname(path);

    return fileInfo2;
}

async function getFileContentFromB64DataUrl(path: string, contentType: string): Promise<FileContent2> {
    await configure;

    try {
        const contents = await fs.promises.readFile(path);
        const utf8Data = contents.toString('utf8');

        if (!isUtf8Encoded(utf8Data)) {
            return createFileContentFromBuffer(contents, contentType, path);
        }

        const dataPrefix = utf8Data.substring(Constants.NUM_ZERO, Constants.NUM_TEN);
        const isDataUrl = (dataPrefix === 'data:image') || (dataPrefix === 'data:video') || (dataPrefix === 'data:audio');

        if (isDataUrl) {
            const base64Data = utf8Data.split(',')[1];
            const binaryData = Buffer.from(base64Data, 'base64');
            const fileUrl = bufferToUrl(binaryData);

            return createFileContent(fileUrl, path, dataPrefix === 'data:image');
        } else {
            return createFileContentFromBuffer(contents, contentType, path);
        }
    } catch (err) {
        console.error('getFileContentFromB64DataUrl:', err);
        return populateFileContent();
    }
}

function createFileContentFromBuffer(buffer: Buffer, contentType: string, path: string): FileContent2 {
    const fileUrl = bufferToUrl2(buffer);
    return createFileContent(fileUrl, path, contentType === 'image');
}

function createFileContent(fileUrl: string,  path: string, isImage: boolean): FileContent2 {
    const fileName = basename(path, extname(path));
    return isImage
        ? populateFileContent(fileUrl, fileName, Constants.EMPTY_STRING, fileUrl, Constants.EMPTY_STRING)
        : populateFileContent(Constants.EMPTY_STRING, fileName, Constants.EMPTY_STRING, fileUrl, Constants.EMPTY_STRING);
}

function populateFileContent(iconPath = Constants.EMPTY_STRING, fileName = Constants.EMPTY_STRING, fileType = Constants.EMPTY_STRING, contentPath = Constants.EMPTY_STRING, opensWith = Constants.EMPTY_STRING ):FileContent2{
    return{
        iconPath: iconPath, fileName: fileName, fileType: fileType, contentPath: contentPath, opensWith: opensWith
    }
}

async function getShortCutFromURL(path:string):Promise<ShortCut>{
    await configure
    try{
        const contents = await fs.promises.readFile(path);
        const stage = contents? contents.toString(): Buffer.from(Constants.EMPTY_STRING).toString();
        const shortCut = ini.parse(stage) as unknown || {InternetShortcut:{ FileName:'hi', IconPath:Constants.EMPTY_STRING, FileType:Constants.EMPTY_STRING,ContentPath:Constants.EMPTY_STRING, OpensWith:Constants.EMPTY_STRING}};
        
        if (typeof shortCut === 'object') {
            const iSCut = (shortCut as {InternetShortcut:unknown})?.['InternetShortcut'];
            const  fileName=  (iSCut as {FileName:unknown})?.['FileName'] as string;
            const iconPath = (iSCut as {IconPath:unknown})?.['IconPath'] as string;
            const fileType = (iSCut as {FileType:unknown})?.['FileType'] as string;
            const contentPath = (iSCut as {ContentPath:unknown})?.['ContentPath'] as string;
            const opensWith = (iSCut as {OpensWith:unknown})?.['OpensWith'] as string;
            new ShortCut(iconPath,fileName,fileType,contentPath,opensWith);
        }

        return createEmptyShortCut();
    }catch(error){
        console.error('getShortCutFromURLAsync:', error);
        return createEmptyShortCut();
    }
}

async function changeFolderIcon(fileName:string, iconPath:string, path:string):Promise<string>{
    const iconMaybe = `/Cheetah/System/Imageres/${fileName.toLocaleLowerCase()}_folder.png`;

    if(path === Constants.RECYCLE_BIN_PATH){
        const count = await countFolderItems(Constants.RECYCLE_BIN_PATH);
        return (count === Constants.NUM_ZERO) 
            ? `${Constants.IMAGE_BASE_PATH}empty_bin.png`
            :`${Constants.IMAGE_BASE_PATH}non_empty_bin.png`;
    }

    if(path !== `/Users/${fileName}`)
        return iconPath;

    const result = await fs.promises.exists(iconMaybe);
    if(result){ 
        return `${Constants.IMAGE_BASE_PATH}${fileName.toLocaleLowerCase()}_folder.png`;
    }
    return iconPath;
}

async function setOtherFolderProps(path:string):Promise<FileContent2>{
    const fileName = basename(path, extname(path));
    let iconFile = Constants.EMPTY_STRING;
    const fileType = Constants.FOLDER;
    const opensWith = Constants.FILE_EXPLORER;

    try{
        const isDir = await isDirectory(path);
        if(!isDir){
            iconFile= `${Constants.IMAGE_BASE_PATH}unknown.png`;
            return populateFileContent(iconFile, fileName, Constants.EMPTY_STRING, fileName, Constants.EMPTY_STRING);
        }

        const count = await countFolderItems(path);
        if(count === Constants.NUM_ZERO){
            iconFile = `${Constants.IMAGE_BASE_PATH}empty_folder.png`;
            return populateFileContent(iconFile, fileName, fileType, fileName, opensWith);
        }

        iconFile = `${Constants.IMAGE_BASE_PATH}folder_w_c.png`;
        return populateFileContent(iconFile, fileName, fileType, fileName, opensWith);
    }catch (err){
        console.error('setOtherFolderProps:', err)
        return populateFileContent(iconFile, fileName, fileType, Constants.EMPTY_STRING, opensWith);
    }
}

async function countFolderItems(path:string):Promise<number>{
    try{
        const dirFiles = await fs.promises.readdir(path);
        return (dirFiles?.length || Constants.NUM_ZERO);
    }catch(err:any){
        console.error('countFolderItems:', err);
        return Constants.NUM_ZERO;
    }
}

function addAppAssociaton(appname:string, img:string):void{
    if(!fileAndAppIconAssociation.get(appname)){
        if(appname === 'photoviewer' || appname === 'videoplayer' || appname === 'audioplayer' || appname === 'ruffle'){
            fileAndAppIconAssociation.set(appname,`${Constants.IMAGE_BASE_PATH}${appname}.png`);
        }else{
            fileAndAppIconAssociation.set(appname, img);
        }
    }
}

function createEmptyShortCut(): ShortCut {
    const empty = Constants.EMPTY_STRING;
    return new ShortCut(empty, empty, empty, empty, empty);
}

function bufferToUrl(buffer:Buffer):string{
    return URL.createObjectURL(new Blob([new Uint8Array(buffer)]));
}

function bufferToUrl2(arr:Uint8Array):string{
    return URL.createObjectURL(new Blob([arr]));
    }

function isUtf8Encoded(data: string): boolean {
    try {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(data);
        const decoder = new TextDecoder('utf-8', { fatal: true });
        decoder.decode(bytes);
        return true;
    } catch (error) {
        return false;
    }
}
