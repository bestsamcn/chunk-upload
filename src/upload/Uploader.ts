/*
 * @Description: File Upload
 * @Author: SZEWEC
 * @Date: 2021-04-01 15:36:34
 * @LastEditTime: 2021-04-01 17:18:14
 * @LastEditors: Sam
 */

import { BaseFileProps, FileProps, FileStatus, PostMessageType } from './BaseProps';
import { ThreadPool } from './ThreadPool';
import { TypeUtils } from './TypeUtils';


/**文件上传类 */
export class Uploader{

    /**线程池 */
    private _threadPool = ThreadPool.create();

    /**实列 */
    private static _instance:Uploader;

    /**文件列表 */
    private _fileList:FileProps[] = [];

    /**获取文件列表 */
    public get fileList(){
        return this._fileList;
    }

    /**
     * 提交
     * @param file
     */
    public post(file:File){

        /**后缀获取 */
        const name = file.name;
        const matches = name.match(/.*\.([^\.]*)/);
        let extention = '';
        if (matches && matches.length) {
            extention = matches[1];
        }
        const timestemp = Date.now();

        const id = TypeUtils.getId('task');
        const task:BaseFileProps = {
            id,
            name: name,
            extention,
            timestemp,
            file,
            size:file.size,
            status:FileStatus.CUTTING,
            progress:0,
        }

        const thread = this._threadPool.get();
        if(thread){
            thread.postMessage({id, type:PostMessageType.ADD, task});
        }
    }
}
