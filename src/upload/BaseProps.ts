/*
 * @Description:Upload Props
 * @Author: SZEWEC
 * @Date: 2021-04-01 10:38:38
 * @LastEditTime: 2021-04-01 17:16:03
 * @LastEditors: Sam
 */

/**文件状态 */
export enum FileStatus{

    /**切片 */
    CUTTING = 'CUTTING',
    CUT_ERROR = 'CUT_ERROR',
    CUT_SUCCESS = 'CUT_SUCCESS',


    /**上传 */
    UPLOADING = 'UPLOADING',
    UPLOAD_ERROR = 'UPLOAD_ERROR',
    UPLOAD_SUCCESS = 'UPLOAD_SUCCESS',

    /**合并 */
    MERGING = 'MERGING',
    MERGE_ERROR = 'MERGE_ERROR',
    MERGE_SUCCESS = 'MERGE_SUCCESS',

    /**解压 */
    DECOMPRESSING = 'DECOMPRESSING',
    DECOMPRESS_ERROR = 'DECOMPRESSING_ERROR',
    DECOMPRESS_SUCCESS = 'DECOMPRESS_SUCCESS',

    /**上传成功 */
    SUCCESS = 'SUCCESS',
}

/**返回的消息类型 */
export enum ReturnMessageType{

    /**成功 */
    SUCCESS = 'SUCCESS',

    /**错误 */
    ERROR = 'ERROR',

    /**警告 */
    WARNING = 'WARNING',

    /**等待 */
    PENDING = 'PENDING',

    /**取消任务 */
    CANCEL = 'CANCEL',

    /**重试任务 */
    RETRY = 'RETRY',

    /**暂停 */
    PUASE = 'PUASE',

    /**已存在 */
    EXIST = 'EXIST',

    /**进度 */
    PROGRESS = 'PROGRESS'
}


/**接受的消息类型 */
export enum PostMessageType{

    /**新增文件 */
    ADD = 'ADD',

    /**暂停 */
    PAUSE = 'PAUSE',

    /**取消 */
    CANCEL = 'CANCEL',

    /**重试 */
    RETRY = 'RETRY',
}


/**分片信息 */
export interface ChunkProps{

    /**数据 */
    data:Blob;

    /**索引 */
    index:Number;
}

export interface BaseFileProps{

    /**任务id-与文件id一致 */
    id:string;

    /**事件戳-切图完成 */
    timestemp:number;

    /**名称 */
    name:string;

    /**后缀格式 */
    extention:string;

    /**文件 */
    file:File;

    /**体积BYTE */
    size:number;

    /**状态 */
    status:FileStatus;

    /**进度 */
    progress:number;
}


/**任务信息 */
export interface FileProps extends BaseFileProps{

    /**md5 */
    md5:string;

    /**分片列表 */
    chunks:ChunkProps[];

    /**分片总数 */
    total:number;

    /**当前分片索引 */
    index:number;
}


/**任务信息 */
export interface TaskProps{

    /**id */
    id:string;

    /**文件 */
    file:File,

    /**状态 */
    status:'RUNNING'|'PAUSE'|'CANCEL'|'PENDING'|'ERROR',

    /**已有分片 */
    chunks:ChunkProps[],

    /**当前分片索引 */
    currentIndex:number;
}


/**消息信息 */
export interface MessageData{

    /**消息id，与任务id一致，同一任务的id，通过消息类型区分 */
    id:string;

    /**类型 */
    type:ReturnMessageType|PostMessageType;

    /**提示 */
    message?:string;

    /**任务信息 */
    task?:BaseFileProps;

    /**进度 */
    progress?:number;

    /**切片解构 */
    file?:FileProps;

}
