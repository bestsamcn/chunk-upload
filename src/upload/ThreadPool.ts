/*
 * @Description:Thread Pool
 * @Author: SZEWEC
 * @Date: 2021-04-01 14:01:51
 * @LastEditTime: 2021-04-01 17:12:38
 * @LastEditors: Sam
 */

import ChunkWorker from 'worker-loader!../upload/ChunkWorker';
import { MessageData } from './BaseProps';

/**线程信息 */
export interface ThreadProps{

    /**是否繁忙 */
    busy:boolean;

    /**worker */
    worker:ChunkWorker;
}

type onmessage = (...args:any[])=>void;

/**线程 */
class Thread implements ThreadProps{
    private _busy = false;
    private _worker = new ChunkWorker();

    /**获取worker */
    public get worker(){
        return this._worker;
    }

    /**是否繁忙 */
    public get busy(){
        return this._busy;
    }

    /**设置状态 */
    public set busy(value:boolean){
        this._busy = value;
    }

    /**消息监听 */
    public set onmessage(onmessage:onmessage | null){
        this._worker.onmessage = (evt:MessageEvent)=>{
            onmessage?.(evt.data);
        };
    }

    /**
     * 推送消息
     * @param data
     */
    public postMessage(data:MessageData){
        this._worker.postMessage(data);
    }
}

/**
 * 线程池
 */
export class ThreadPool{

    /**单例 */
    public static _instance:ThreadPool;

    /**线程列表 */
    private _threads:Thread[] = [];

    /**最大线程数 */
    private _maxThreadNumber = 5;

    /**
     *  构造
     * @param maxThreadNumber
     */
    private constructor(maxThreadNumber?:number){

        this._maxThreadNumber = maxThreadNumber || this._maxThreadNumber;
        this._initialize();
    }

    /**初始化 */
    private _initialize(){

        for(let i=0; i< this._maxThreadNumber; i++){

            const thread = new Thread();
            this._threads.push(thread);
        }

    }

    /**获取空闲线程 */
    public get(){
        const threads = this._threads.filter(thread=>!thread.busy);
        if(threads.length){
            const thread = threads[0];
            thread.busy = true;
            return thread;
        }
        return null;
    }

    /**
     * 释放线程
     * @param thread
     */
    public free(thread:Thread){
        thread.busy = false;
        thread.onmessage = null;
    }

    /**
     * 创建
     * @param maxThreadNumber
     */
    public static create(maxThreadNumber?:number){
        if(this._instance){
            return this._instance;
        }
        this._instance = new ThreadPool(maxThreadNumber);
        return this._instance;
    }
}
