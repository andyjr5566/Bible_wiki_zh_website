export { ReadAloud } from './components/index.js';
import '@quartz-community/types';

declare const manifest: {
    name: string;
    displayName: string;
    category: string;
    version: string;
    quartzVersion: string;
    components: {
        ReadAloud: {
            displayName: string;
            defaultPosition: string;
            defaultPriority: number;
        };
    };
};

export { manifest };
