/// <reference types="vite/client" />
export const publicRelease = import.meta.env.MODE === 'pages';
export const assetUrl = (relative: string) =>
    `${import.meta.env.BASE_URL}${relative.replace(/^\//, '')}`;
