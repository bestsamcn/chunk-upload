/*
 * @Description: File Upload
 * @Author: SZEWEC
 * @Date: 2021-04-01 15:36:34
 * @LastEditTime: 2021-04-08 00:42:28
 * @LastEditors: Sam
 */

import {
    BaseFileProps,
    FileProps,
    FileStatus,
    PostMessageType,
    ReturnMessageType,
} from './BaseProps';
import { ThreadPool } from './ThreadPool';
import { TypeUtils } from './TypeUtils';
import SparkMD5 from 'spark-md5';
import Axios, { Canceler } from 'axios';

const HOUR = 60 * 60 * 1000;

/**文件上传类 */
export class Uploader {
    public timeout = 20 * HOUR;

    /**线程池 */
    private _threadPool: ThreadPool = ThreadPool.create();

    /**实列 */
    private static _instance: Uploader;

    /**文件列表 */
    private _fileList: FileProps[] = [];

    /**获取文件列表 */
    public get fileList() {
        return this._fileList;
    }

    /**
     * 超时-单位小时
     * @param timeout
     */
    private constructor(timeout: number = 20) {
        this.timeout = timeout * HOUR;
    }

    /**变更 */
    public onChange(
        fileId: string,
        file: FileProps,
        fileList: FileProps[],
        message?: string,
    ) {}

    /**
     * 提交
     * @param file
     */
    public post(file: File, override?: boolean) {
        /**后缀获取 */
        const name = file.name;
        const matches = name.match(/.*\.([^\.]*)/);
        let extention = '';
        if (matches && matches.length) {
            extention = matches[1];
        }
        const timestemp = Date.now();

        const id = TypeUtils.getId('file');
        const simpleMD5 = this._getSimpleMD5(file);

        if (
            !override &&
            this._fileList.some((file) => file.simpleMD5 === simpleMD5)
        ) {
            console.warn(
                'there is a existed file, which has same simple-md5. ',
            );
            return;
        }
        const fileProps: FileProps = {
            simpleMD5,
            id,
            key: id,
            name: name,
            extention,
            timestemp,
            transformedTime: TypeUtils.dateFormat(timestemp, 'yyyy-mm-dd'),
            file,
            size: file.size,
            transformedSize: TypeUtils.transformFileSize(file.size)!,
            status: FileStatus.CUT_PENDING,
            progress: 0,
            md5: '',
            chunks: [],
            total: 0,
            index: 0,
        };

        const thread = this._threadPool.get();
        debugger;
        this._fileList.push(fileProps);
        if (!thread) {
            return fileProps;
        }

        thread.postMessage({ id, type: PostMessageType.ADD, file: fileProps });
        fileProps.thread = thread;
        thread.onmessage = ({ id, type, progress, message, file }) => {
            console.log(id, type, file, progress, message, 'message');
            const index = this._fileList.findIndex((file) => file.id === id);
            if (index === -1) return;
            const fileProps = this._fileList[index];
            if (type === ReturnMessageType.PROGRESS && fileProps) {
                fileProps.status = FileStatus.CUTTING;
                fileProps.progress = progress!;
                this.onChange(id, fileProps, this._fileList, message!);
            }

            if (type === ReturnMessageType.PENDING && fileProps) {
                fileProps.status = FileStatus.CUT_PENDING;
                this.onChange(id, fileProps, this._fileList, message!);
            }

            if (type === ReturnMessageType.ERROR && fileProps) {
                fileProps.status = FileStatus.CUT_ERROR;
                this.onChange(id, fileProps, this._fileList, message!);
            }

            if (type === ReturnMessageType.PAUSE && fileProps) {
                fileProps.status = FileStatus.CUT_PAUSE;
                this.onChange(id, fileProps, this._fileList, message!);
            }

            if (type === ReturnMessageType.CANCEL && fileProps) {
                fileProps.status = FileStatus.CUT_CANCEL;
                this._fileList.splice(index, 1);
                this.onChange(id, fileProps, this._fileList, message!);
            }

            if (type === ReturnMessageType.SUCCESS && fileProps) {
                fileProps.status = FileStatus.CUT_SUCCESS;
                fileProps.progress = 100;
                fileProps.md5 = file!.md5;
                fileProps.chunks = file!.chunks;
                fileProps.total = file!.total;
                this._upload(fileProps);
                this._threadPool.free(fileProps.thread!);
                fileProps.thread = undefined;
                this.onChange(id, fileProps, this._fileList, message!);
            }

            if (type === ReturnMessageType.CANCEL && fileProps) {
                this._fileList.splice(index, 1);
                this.onChange(id, fileProps, this._fileList, message!);
            }
        };
        return fileProps;
    }

    /**上传文件 */
    private _upload(file: FileProps) {
        let { chunks, md5, total, index, extention, id } = file;
        const uploadNext = async (chunkIndex: number): Promise<void> => {
            const chunk = chunks[chunkIndex];
            const formData = new FormData();
            formData.append('data', chunk.data);
            formData.append('index', chunk.index + '');
            formData.append('total', total + '');
            formData.append('md5', md5);
            formData.append('ext', extention);
            const totalChunkProgress = (index / total) * 100;
            const oneChunkProgress = 1 / total;
            const cancelToken = new Axios.CancelToken((cancel) => {
                file.canceler = (message: string) => {
                    const index = this._fileList.findIndex(
                        (_file) => _file.id === file.id,
                    );
                    if (index === -1) return;
                    this._fileList.splice(index, 1);
                    cancel(message);
                };
            });

            const res = await Axios.post(
                'http://localhost:4000/uploadChunck',
                formData,
                {
                    onUploadProgress: (p) => {
                        const chunkProgress = Math.floor(
                            100 * oneChunkProgress * (p.loaded / p.total),
                        );
                        const progress = totalChunkProgress + chunkProgress;
                        if (progress > 99) {
                            file.progress = Math.floor(progress);
                            file.status = FileStatus.MERGING;
                            this.onChange(id, file, this._fileList, '合并');
                            return;
                        }
                        file.progress = Math.floor(progress);
                        file.status = FileStatus.UPLOADING;
                        this.onChange(id, file, this._fileList, '上传');
                    },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: this.timeout,
                    cancelToken,
                },
            );

            if (index < total - 1) {
                index++;
                console.log('current index: ' + index);
                console.log('total: ' + total);
                file.index = index;
                file.total = total;
                return uploadNext(index);
            }
            if (res.data.code === 'SUCCESS' || res.data.code === 'UPLOADED') {
                file.progress = 100;
                file.status = FileStatus.COMPLETE;
                this.onChange(id, file, this._fileList, '完成');
            }
        };
        uploadNext(index);
    }

    /**移除文件 */
    public remove(id: string) {
        const index = this._fileList.findIndex((file) => file.id === id);
        if (index === -1) {
            console.warn('the specifed file do not exist');
            return false;
        }
        const file = this._fileList[index];

        if (file?.canceler) {
            file?.canceler?.('upload was canceled by user');
            this._fileList.splice(index, 1);
            return;
        }

        /**切片中的文件，在message中删除 */
        file?.thread?.postMessage({ id, type: PostMessageType.CANCEL });
    }

    /**
     * 获取简单的MD5
     * @param file
     */
    private _getSimpleMD5(file: File) {
        const name = file.name;
        const size = file.size;
        const lastModified = file.lastModified;
        const spark = new SparkMD5();
        spark.append(name);
        spark.append(size + '');
        spark.append(lastModified + '');
        const md5 = spark.end();
        return md5;
    }

    /**
     * 创建单例
     * @param timeout
     */
    public static create(timeout?: number) {
        if (this._instance) {
            return this._instance;
        }
        this._instance = new Uploader(timeout);
        return this._instance;
    }
}
