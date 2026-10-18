import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
export default defineConfig(({mode})=>({plugins:[react(),...(mode==='standalone'?[viteSingleFile()]:[])],base:'./',build:{outDir:mode==='standalone'?'dist-preview':'dist'},optimizeDeps:{entries:['index.html']},server:{host:'0.0.0.0',port:5173,strictPort:true}}));
