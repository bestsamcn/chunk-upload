import { defineConfig } from 'umi';

export default defineConfig({
    nodeModulesTransform: {
        type: 'none',
    },
    alias: {
        '@': require('path').resolve(__dirname, 'src')
    },
    routes: [
        { path: '/', component: '@/pages/index' },
    ],
    fastRefresh: {},
    chainWebpack(config, { webpack }) {
        // config.plugin('worker-plugin').use(WorkerPlugin);
        // config.module.rule('worker-loader').test(/\.worker\.js$/).use('worker-loader').loader('worker-loader');
    }
});
