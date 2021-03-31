

import React, { ChangeEventHandler } from 'react';
import SparkMD5 from 'spark-md5';
import Axios from 'axios';
import FileWorker from 'worker-loader!../workers/File.worker';


const fileWorker = new FileWorker();

/**分片信息 */
interface ChunkProps{

    /**数据 */
    data:Blob;

    /**索引 */
    index:number;
}

/**文件信息 */
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

    /**格式 */
    extention:string;
}

/**1MB的字节 */
const MB = 1024 * 1024;
export default class ChunkUpload extends React.Component<{}, {progress:number, status:string}> {


    private chunks = [];
    constructor(props:{}) {
        super(props);

        /**
         * chunk:{name:string, blob:Blob}
         */
        this.chunks = [];
        this.state = {
            progress: 0,

            /**MD5_AND_CHUNK UPLOAD */
            status:''
        }
        this.initialize();
    }


    initialize(){

        fileWorker.onmessage = (evt)=>{

            const { id, file, message, type, progress } = evt.data;

            if(type === 'PROGRESS'){
                this.setState({status:'正在计算MD5与切片', progress:progress});
            }
            if(type === 'SUCCESS'){
                this.setState({status:'正在上传', progress:0});
                if(file){
                    this.uploadChunks(file);
                }
            }
        }
    }

    /**选择文件 */
    async onChange(evt:any) {
        const files = evt.target.files;
        if (!files.length) return;
        const file = files[0];
        this.setState({status:'正在计算MD5与切片', progress:0});
        const task = {id:'123', file:file};
        fileWorker.postMessage({type:'ADD', task, id:'123'});
    }

    /**上传分片 */
    uploadChunks(upload:FileProps) {
        let { chunks, md5, total, index, extention } = upload;
        const uploadNext = async (chunkIndex:number):Promise<void> => {
            const chunk = chunks[chunkIndex];
            const formData = new FormData();
            formData.append('data', chunk.data);
            formData.append('index', chunk.index+'');
            formData.append('total', total+'');
            formData.append('md5', md5);
            formData.append('ext', extention);
            const totalChunkProgress = index / total * 100;
            const oneChunkProgress = 1 / total;
            const res = await Axios.post('http://localhost:4000/uploadChunck', formData, {
                onUploadProgress: (p) => {
                    const chunkProgress = Math.floor(100 * oneChunkProgress * (p.loaded / p.total));
                    const progress = totalChunkProgress + chunkProgress;
                    if(progress > 99){
                        return this.setState({ status:'正在合并', progress: Math.floor(progress) });
                    }
                    this.setState({ progress: Math.floor(progress) });
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 20 * 60 * 60 * 1000
            });
            if (res.data.code === 'UPLOADED') {
                this.setState({ progress: 100 });
                return console.log(res.data.msg);
            }

            if (index < total - 1) {
                index++;
                console.log('current index: ' + index);
                console.log('total: ' + total);
                return uploadNext(index);
            }
            if (res.data.code === 'SUCCESS') {
                this.setState({ progress: 100 , status:'上传完成'});
            }
            console.log('upload end');
        }
        uploadNext(index);
    }

    render() {
        const { status, progress } = this.state;
        return <div>
            选择<input onChange={this.onChange.bind(this)} type="file" id="file" />
            {status}：<span>{progress + '%'}</span>
        </div>
    }
}
