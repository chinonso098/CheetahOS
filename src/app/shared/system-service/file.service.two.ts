import { basename, extname, join, resolve } from '@zenfs/core/vfs/path.js';
import * as constants from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/fileinfo';
import { ShortCut } from 'src/app/system-files/shortcut';

import { Buffer } from 'buffer';
import ini from 'ini';
import { Subject } from 'rxjs';

import type { Dirent, ErrnoError, IndexData, Stats } from '@zenfs/core';
import { configure, CopyOnWrite, Fetch, default as fs } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';
import OSFileSystemIndex from '../../../../index.json';
import { dirname } from 'path';
/// <reference types="node" />

const fsPrefix = 'osdrive';
const currentURL = window.location.href;

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