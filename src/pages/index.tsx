import React, { ChangeEventHandler } from 'react';
import SparkMD5 from 'spark-md5';
import Axios from 'axios';
import {
  BaseFileProps,
  FileProps,
  FileStatus,
  MessageData,
  PostMessageType,
  ReturnMessageType,
} from '../upload/BaseProps';
import { ThreadPool } from '../upload/ThreadPool';
import { TypeUtils } from '../upload/TypeUtils';
import { Uploader } from '../upload/Uploader';
import { Table, Button } from 'antd';

interface UploadState {
  fileList: FileProps[];
}

/**1MB的字节 */
const MB = 1024 * 1024;
export default class ChunkUpload extends React.Component<{}, UploadState> {
  private chunks = [];
  private _uploader = Uploader.create();
  private _files: FileProps[] = [];
  constructor(props: {}) {
    super(props);

    this.state = {
      fileList: [],
    };
    this.initialize();
  }

  async initialize() {
    await this._uploader.defer.promise;
    this._uploader.onChange = (fileId, file, fileList) => {
      console.log(fileId, 'render');
      this.setState({ fileList: [...fileList] });
    };
  }

  /**选择文件 */
  async onChange(evt: any) {
    const files = evt.target.files;
    if (!files.length) return;
    for (const file of files) {
      this.postFile(file);
    }
    evt.target.value = '';
  }

  /**
   * 提交文件
   * @param file
   */
  postFile(file: File) {
    const fileProps = this._uploader.post(file);
    if (!fileProps) return;
    this.state.fileList.push(fileProps);
    this.setState({ fileList: [...this.state.fileList] });
  }

  /**暂停 */
  onPause(id: string) {
    this._uploader.pause(id);
  }

  /**
   * 重试
   * @param id
   */
  onRetry(id: string) {
    this._uploader.retry(id);
  }

  /**
   * 取消任务
   * @param id
   */
  onCancel(id: string) {
    this._uploader.remove(id);
  }

  /**释放 */
  onDrop(evt: React.DragEvent<HTMLDivElement>) {
    if (!evt.dataTransfer) return;
    const files = evt.dataTransfer.files;
    for (const file of files) {
      this.postFile(file);
    }
    evt.preventDefault();
  }

  /**
   * 阻止默认事件
   * @param evt
   */
  onDragOver(evt: React.DragEvent<HTMLDivElement>) {
    evt.preventDefault();
  }

  render() {
    const columns = [
      {
        title: '名称',
        dataIndex: 'name',
      },
      {
        title: '大小',
        dataIndex: 'transformedSize',
      },
      {
        title: '上传时间',
        dataIndex: 'transformedTime',
      },
      {
        title: '状态',
        dataIndex: 'status',
      },
      {
        title: '进度',
        dataIndex: 'progress',
        render(progress: number) {
          return progress + '%';
        },
      },
      {
        title: '操作',
        dataIndex: 'id',
        render: (id: string) => {
          return (
            <div>
              <Button onClick={this.onPause.bind(this, id)}>暂停</Button>
              <Button onClick={this.onRetry.bind(this, id)}>重试</Button>
              <Button onClick={this.onCancel.bind(this, id)}>取消</Button>
            </div>
          );
        },
      },
    ];
    const { fileList } = this.state;
    return (
      <div style={{ padding: 10 }}>
        <div>
          <div
            style={{ width: 200, height: 200, background: '#ebebeb' }}
            contentEditable="true"
            onDrop={this.onDrop.bind(this)}
            onDragOver={this.onDragOver.bind(this)}
          >
            <input
              multiple
              onChange={this.onChange.bind(this)}
              type="file"
              id="file"
            />
          </div>
        </div>
        <Table columns={columns} dataSource={fileList} />
      </div>
    );
  }
}
