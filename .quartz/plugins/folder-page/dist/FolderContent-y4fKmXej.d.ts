import { QuartzComponent } from '@quartz-community/types';

interface FolderContentOptions {
    showFolderCount: boolean;
    showSubfolders: boolean;
    sortBy?: "date" | "alphabetical" | "chapter";
}
declare const _default: (opts?: Partial<FolderContentOptions>) => QuartzComponent;

export { _default as _ };
