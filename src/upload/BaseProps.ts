/*
 * @Description:Upload Props
 * @Author: SZEWEC
 * @Date: 2021-04-01 10:38:38
 * @LastEditTime: 2021-04-08 00:18:52
 * @LastEditors: Sam
 */

import { Canceler } from 'axios';
import { Thread } from './ThreadPool';

/**文件状态 */

export enum FileStatus {
    /**切片 */
    CUT_PENDING = '切片等待中',
    CUT_PAUSE = '切片暂停',
    CUT_CANCEL = '切片取消',
    CUT_RETRY = '切片重试',
    CUTTING = '切片中',
    CUT_ERROR = '切片出错',
    CUT_SUCCESS = '切片成功',

    /**上传 */
    UPLOAD_PENDING = '上传等待中',
    UPLOADING = '上传中',
    UPLOAD_PAUSE = '上传暂停',
    UPLOAD_CANCEL = '上传取消',
    UPLOAD_RETRY = '上传重试',
    UPLOAD_ERROR = '上传出错',
    UPLOAD_SUCCESS = '上传成功',

    /**合并 */
    MERGING = '切片合并中',
    MERGE_ERROR = '切片合并出错',
    MERGE_SUCCESS = '切片合并成功',

    /**解压 */
    DECOMPRESSING = '文件解压中',
    DECOMPRESS_ERROR = '文件解压出错',
    DECOMPRESS_SUCCESS = '文件解压成功',

    /**上传完成 */
    COMPLETE = '文件上传完成',
}

/**返回的消息类型 */
export enum ReturnMessageType {
    /**成功 */
    SUCCESS = '成功',

    /**错误 */
    ERROR = '出错',

    /**警告 */
    WARNING = '警告',

    /**等待 */
    PENDING = '等待',

    /**取消任务 */
    CANCEL = '取消',

    /**重试任务 */
    RETRY = '重试',

    /**暂停 */
    PAUSE = '暂停',

    /**已存在 */
    EXIST = '已存在',

    /**不存在 */
    NOT_EXIST = '不存在',

    /**进度 */
    PROGRESS = '进度',
}

/**接受的消息类型 */
export enum PostMessageType {
    /**新增文件 */
    ADD = '新增',

    /**暂停 */
    PAUSE = '暂停',

    /**取消 */
    CANCEL = '取消',

    /**重试 */
    RETRY = '重试',
}

/**分片信息 */
export interface ChunkProps {
    /**数据 */
    data: Blob;

    /**索引 */
    index: Number;
}

/**文件基础信息 */
export interface BaseFileProps {
    /**任务id-与文件id一致 */
    id: string;

    /**与id一致 */
    key: string;

    /**简单的md5 */
    simpleMD5: string;

    /**事件戳-切图完成 */
    timestemp: number;

    /**转换好的日期 */
    transformedTime: string;

    /**名称 */
    name: string;

    /**后缀格式 */
    extention: string;

    /**文件 */
    file: File;

    /**体积BYTE */
    size: number;

    /**转换好的体积 */
    transformedSize: string;

    /**状态 */
    status: FileStatus;

    /**进度 */
    progress: number;

    /**线程 */
    thread?: Thread;
}

/**文件信息 */
export interface FileProps extends BaseFileProps {
    /**md5 */
    md5: string;

    /**分片列表 */
    chunks: ChunkProps[];

    /**分片总数 */
    total: number;

    /**当前分片索引, 有两重含义，1. 切片索引；2. 上传索引 */
    index: number;

    /**取消器 */
    canceler?: (message: string) => void;
}

/**任务信息 */
export interface TaskProps extends FileProps {
    /**状态 */
    executeStatus: 'RUNNING' | 'PAUSE' | 'CANCEL' | 'PENDING' | 'ERROR';
}

/**消息信息 */
export interface MessageData {
    /**消息id，与任务id一致，同一任务的id，通过消息类型区分 */
    id: string;

    /**类型 */
    type: ReturnMessageType | PostMessageType;

    /**提示 */
    message?: string;

    /**任务信息 */
    task?: TaskProps;

    /**进度 */
    progress?: number;

    /**文件基础信息-从外部传入 */
    file?: FileProps;
}
