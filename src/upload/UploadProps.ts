/*
 * @Description:Upload Props
 * @Author: SZEWEC
 * @Date: 2021-04-01 10:38:38
 * @LastEditTime: 2021-04-01 10:41:03
 * @LastEditors: Sam
 */
/**返回的消息类型 */
export enum RETURN_MESSAGE_TYPE{

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
export enum POST_MESSAGE_TYPE{

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


/**任务信息 */
export interface FileProps{

    /**任务id-与文件id一致 */
    id:string;

    /**文件 */
    file:File;

    /**md5 */
    md5:string;

    /**分片列表 */
    chunks:ChunkProps[];

    /**分片总数 */
    total:number;

    /**当前分片索引 */
    index:number;

    /**后缀格式 */
    extention:string;
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
    type:RETURN_MESSAGE_TYPE|POST_MESSAGE_TYPE;

    /**提示 */
    message?:string;

    /**任务信息 */
    task?:TaskProps;

    /**进度 */
    progress?:number;

    /**切片解构 */
    file?:FileProps;

}
