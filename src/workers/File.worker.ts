/*
 * @Description:file worker
 * @Author: SZEWEC
 * @Date: 2021-03-31 17:30:37
 * @LastEditTime: 2021-03-31 19:05:47
 * @LastEditors: Sam
 */


import SparkMD5 from 'spark-md5';
const MB = 1024 * 1024;

/**返回的消息类型 */
enum RETURN_MESSAGE_TYPE{

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
enum ACCEPT_MESSAGE_TYPE{

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
interface ChunkProps{

    /**数据 */
    data:Blob;

    /**索引 */
    index:Number;
}


/**任务信息 */
interface FileProps{

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
interface TaskProps{

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
interface MessageData{

    /**消息id, 消息id与任务id区分还是有需要的， 同一个任务，可能发出多条消息*/
    id:string;

    /**类型 */
    type:RETURN_MESSAGE_TYPE|ACCEPT_MESSAGE_TYPE;

    /**提示 */
    message?:string;

    /**任务信息 */
    task?:TaskProps;

    /**进度 */
    progress?:number;

    /**切片解构 */
    file?:FileProps;

}


/**上传线程 */
class FileWorker{

    /**上下文 */
    private readonly _global = self;

    /**最大任务处理数 */
    private static readonly MAX_TASK_NUM = 1;

    /**任务列表 */
    private _taskList:TaskProps[] = [];

    /**当前任务 */
    private _currentTask:TaskProps|null = null;

    /**构造 */
    public constructor(){
        this._initialize();
    }

    public postMessage(data:any){}
    public onmessage(evt:MessageData){}

    /**初始化 */
    private _initialize(){
        this._global.onmessage = this._acceptMessage.bind(this);
    }

    /**
     * 返回消息
     * @param data
     */
    private _returnMessage(data:MessageData){
        this._global.postMessage(data);
    }


    /**
     * 接受消息
     * @param evt
     */
    private _acceptMessage(evt:MessageEvent){

        const { type, task, id } = evt.data as MessageData;

        /**新增 */
        if(type === ACCEPT_MESSAGE_TYPE.ADD){

            if(!task || !task.id){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.ERROR, message:'the specified task is undefined!'});
            }

            if(this._taskList.some(_task=>_task.id === task.id)){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.EXIST, message:'the specified task already exist!'});
            }

            this._taskList.push({...task, chunks:[], currentIndex:0, status:'PENDING'});

            /** 用户暂停的任务，只能用户自己重新执行, 每次仅读取PENDING的任务 */
            if(!this._currentTask){
                const pendingTaskList = this._taskList.filter(task=>task.status === 'PENDING');
                if(pendingTaskList.length){
                    this._currentTask = pendingTaskList[0];
                    this._currentTask.status = 'RUNNING';
                    this._executeTask(this._currentTask);
                }
            }
        }

        /**重试只能触发PAUSE与ERROR状态的任务-且必须当前无任务在执行 */
        if(type === ACCEPT_MESSAGE_TYPE.RETRY){
            if(!task || !task.id){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.ERROR, message:'task id do not exist!'});
            }

            if(this._taskList.some(_task=>_task.id === task.id)){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.EXIST, message:'the specified task already exist!'});
            }

            if(this._currentTask){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.PENDING, message:'one task is running now!'});
            }

            const taskToRun =  this._taskList.find(_task=>_task.id === task.id);
            if(taskToRun){
                taskToRun.status = 'RUNNING';
                this._currentTask = taskToRun;
                this._executeTask(this._currentTask);
            }


        }

        if(type === ACCEPT_MESSAGE_TYPE.CANCEL){
            if(!task || !task.id){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.ERROR, message:'the specified task task id do not exist!'});
            }

            const existTask = this._taskList.find(_task=>_task.id === task.id);
            if(!existTask){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.ERROR, message:'the specified task task id do not exist!'});
            }

            /**运行中的任务，在execute中取消 */
            if(existTask.status !== 'RUNNING'){
                existTask.status = 'CANCEL';

                /**获取最新的位置 */
                const index = this._taskList.findIndex(_task=>_task.id === task.id);
                if(index !== -1){
                    this._taskList.splice(index, 1);
                }
            }
        }

        if(type === ACCEPT_MESSAGE_TYPE.PAUSE){
            if(!task || !task.id){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.ERROR, message:'the specified task task id do not exist!'});
            }

            const existTask = this._taskList.find(_task=>_task.id === task.id);
            if(!existTask){
                return this._returnMessage({id, type:RETURN_MESSAGE_TYPE.ERROR, message:'the specified task task id do not exist!'});
            }

            /**运行中的任务，在execute中暂停 */
            if(existTask.status !== 'RUNNING'){
                existTask.status = 'PAUSE';
            }
        }
    }

    /**
     * 获取分片与md5
     * @param task
     */
    private async _executeTask(task:TaskProps){


        const { file, status } = task;
        if(status !== 'RUNNING'){
            return this._returnMessage({type:RETURN_MESSAGE_TYPE.ERROR, id:task.id, message:"the specified task's status is not running"});
        }

        /**后缀获取 */
        const name = file.name;
        const matches = name.match(/.*\.([^\.]*)/);
        let extention = '';
        if (matches && matches.length) {
            extention = matches[1];
        }

        const spark = new SparkMD5();

        /**转换为字节 */
        let chunkByteSize = 100 * MB; //

        /**如果 chunkByteSize 比文件大，则直接取文件的大小 */
        if (chunkByteSize > file.size) {
            chunkByteSize = file.size;
        } else {

            /** 因为最多 10000 chunk，所以如果 chunkSize 不符合则把每片 chunk 大小扩大两倍 */
            while (file.size > chunkByteSize * 10000) {
                chunkByteSize *= 2;
            }
        }

        /**已有分片索引优先读取 */
        const chunks = task.chunks || [];
        const count = Math.ceil(file.size / chunkByteSize);
        for (task.currentIndex = task.currentIndex || 0; task.currentIndex < count; task.currentIndex++) {


            /**执行过程中暂停 */
            if(task.status === 'PAUSE'){


                /**不需要移除task */
                this._shiftTaskAndExecuteNext();
                return this._returnMessage({type:RETURN_MESSAGE_TYPE.PUASE, id:task.id, message:'the specified task has paused'});
            }

            /**取消 */
            if(task.status === 'CANCEL'){

                task.status = 'CANCEL';

                /**需要移除task */
                this._shiftTaskAndExecuteNext(task);
                return this._returnMessage({type:RETURN_MESSAGE_TYPE.PUASE, id:task.id, message:'the specified task has canceled'});
            }

            const begin = chunkByteSize * task.currentIndex;
            const end = task.currentIndex === count - 1 ? file.size : chunkByteSize * (task.currentIndex + 1);
            const chunk = file.slice(begin, end);
            try{
                const ab = await this._readAsArrayBuffer(chunk) as ArrayBuffer;

                //@ts-ignore
                spark.append(ab);
                const progress = task.currentIndex / count * 100;
                const returnProgress = Math.floor(progress);
                this._returnMessage({id:task.id, type:RETURN_MESSAGE_TYPE.PROGRESS, progress:returnProgress});
                chunks.push({ data: chunk, index: task.currentIndex });
            }catch(error){
                task.status = 'ERROR';

                /**不需要移除task */
                this._shiftTaskAndExecuteNext();
                return this._returnMessage({id:task.id, type:RETURN_MESSAGE_TYPE.ERROR, message:'catch an error while reading blob to arraybuffer'})
            }

        }
        // const md5Features = file.name+'-'+file.modifiedTime+'-'+file.size;
        // spark.append(md5Features);
        const md5 = spark.end();
        const fileProps = {id:task.id, file, md5, chunks:[...chunks], total:chunks.length, index:0, extention};
        this._returnMessage({id:task.id, type:RETURN_MESSAGE_TYPE.SUCCESS, file:fileProps});

        /**重新取第一个PENDING任务执行 */
       this._shiftTaskAndExecuteNext(task);
    }

    /**
     * 移除第一个任务，并执行下一个非PAUSE|ERROR的任务
     */
    private _shiftTaskAndExecuteNext(task?:TaskProps){

        if(task){
            const index = this._taskList.findIndex(_task=>_task.id === task.id);
            if(index !== -1) this._taskList.splice(index, 1);
        }

        this._currentTask = null;
        if(this._taskList.length){
            const pendingTaskList = this._taskList.filter(task=>task.status === 'PENDING');
            if(pendingTaskList.length){
                this._currentTask = pendingTaskList[0];
                this._currentTask.status = 'RUNNING';
                this._executeTask(this._currentTask);
            }
        }
    }

    /**
     * 转blob为arraybuffer
     * @param blobData
     */
    private _readAsArrayBuffer(blobData:Blob):Promise<ArrayBuffer|Error>{
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            // evt 类型目前存在问题 https://github.com/Microsoft/TypeScript/issues/4163
            reader.onload = (evt) => {
                if (evt.target) {
                    const body = evt.target.result as ArrayBuffer;
                    resolve(body);
                } else {
                    reject(new Error('progress event target is undefined'));
                }
            }
            reader.onerror = () => {
                reject(new Error('fileReader read failed'));
            }
            reader.readAsArrayBuffer(blobData);
        });
    }

}
new FileWorker();









