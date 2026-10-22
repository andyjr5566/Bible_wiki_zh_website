export { BookGrid, BookGridProps, BookPicker, ChapterGrid, ChapterGridProps } from './components/index.js';
import '@quartz-community/types';
import 'preact';

declare const manifest: {
    name: string;
    displayName: string;
    category: string;
    version: string;
    quartzVersion: string;
    components: {
        BookPicker: {
            displayName: string;
            defaultPosition: string;
            defaultPriority: number;
        };
    };
};

export { manifest };
