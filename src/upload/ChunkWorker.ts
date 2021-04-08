/*
 * @Description:file worker
 * @Author: SZEWEC
 * @Date: 2021-03-31 17:30:37
 * @LastEditTime: 2021-04-08 14:08:09
 * @LastEditors: Sam
 */

import SparkMD5 from 'spark-md5';
import {
	PostMessageType,
	MessageData,
	ReturnMessageType,
	TaskProps,
} from './BaseProps';
const MB = 1024 * 1024;

/**上传线程 */
class ChunkWorker {
	/**上下文 */
	private readonly _global = self;

	/**最大任务处理数 */
	private static readonly MAX_TASK_NUM = 1;

	/**任务列表 */
	private _taskList: TaskProps[] = [];

	/**当前任务 */
	private _currentTask: TaskProps | null = null;

	/**构造 */
	public constructor() {
		this._initialize();
	}

	public postMessage(data: any) {}
	public onmessage(evt: MessageData) {}

	/**初始化 */
	private _initialize() {
		this._global.onmessage = this._acceptMessage.bind(this);
	}

	/**
	 * 返回消息
	 * @param data
	 */
	private _returnMessage(data: MessageData) {
		this._global.postMessage(data);
	}

	/**
	 * 接受消息
	 * @param evt
	 */
	private _acceptMessage(evt: MessageEvent) {
		const { type, file, id } = evt.data as MessageData;

		/**新增 */
		if (type === PostMessageType.ADD) {
			if (!file || !file.id) {
				return this._returnMessage({
					id: 'UNDEFINED',
					type: ReturnMessageType.ERROR,
					message: 'the specified task is undefined!',
				});
			}

			if (this._taskList.some((_task) => _task.id === file.id)) {
				return this._returnMessage({
					id: file.id,
					type: ReturnMessageType.EXIST,
					message: 'the specified task already exist!',
				});
			}

			this._taskList.push({
				...file,
				chunks: [],
				executeStatus: 'PENDING',
				total: 0,
				md5: '',
				index: 0,
			});

			/** 用户暂停的任务，只能用户自己重新执行, 每次仅读取PENDING的任务 */
			if (!this._currentTask) {
				const pendingTaskList = this._taskList.filter(
					(task) => task.executeStatus === 'PENDING',
				);
				if (pendingTaskList.length) {
					this._currentTask = pendingTaskList[0];
					this._currentTask.executeStatus = 'RUNNING';
					this._executeTask(this._currentTask);
				}
			}
		}

		/**重试只能触发PAUSE与ERROR状态的任务-且必须当前无任务在执行 */
		if (type === PostMessageType.RETRY) {
			console.log('task retry');
			if (!id) {
				return this._returnMessage({
					id: 'UNDEFINED',
					type: ReturnMessageType.ERROR,
					message: 'file id do not exist!',
				});
			}

			if (!this._taskList.some((_task) => _task.id === id)) {
				return this._returnMessage({
					id,
					type: ReturnMessageType.NOT_EXIST,
					message: 'the specified file do not exist!',
				});
			}

			if (this._currentTask) {
				return this._returnMessage({
					id,
					type: ReturnMessageType.PENDING,
					message: 'one file is processing now!',
				});
			}

			const taskToRun = this._taskList.find((_task) => _task.id === id);
			if (taskToRun) {
				console.log('retry running');
				taskToRun.executeStatus = 'RUNNING';
				this._currentTask = taskToRun;
				this._executeTask(this._currentTask);
			}
		}

		if (type === PostMessageType.CANCEL) {
			console.log('task cancel');
			if (!id) {
				return this._returnMessage({
					id: 'UNDEFINED',
					type: ReturnMessageType.ERROR,
					message: 'the specified file id do not exist!',
				});
			}

			const existTask = this._taskList.find((_task) => _task.id === id);
			if (!existTask) {
				return this._returnMessage({
					id,
					type: ReturnMessageType.ERROR,
					message: 'the specified file id do not exist!',
				});
			}

			/**运算中的任务，在运行中结束 */
			if (existTask.executeStatus === 'RUNNING') {
				existTask.executeStatus = 'CANCEL';
				return;
			}

			/**获取最新的位置 */
			const index = this._taskList.findIndex((_task) => _task.id === id);
			if (index !== -1) {
				this._taskList.splice(index, 1);
				this._returnMessage({
					id,
					type: ReturnMessageType.CANCEL,
					message: 'the specified file has been successfully removed',
				});
			}
		}

		if (type === PostMessageType.PAUSE) {
			console.log('task pause');
			if (!id) {
				return this._returnMessage({
					id,
					type: ReturnMessageType.ERROR,
					message: 'the specified file id do not exist!',
				});
			}

			const existTask = this._taskList.find((_task) => _task.id === id);
			if (!existTask) {
				return this._returnMessage({
					id,
					type: ReturnMessageType.ERROR,
					message: 'the specified file id do not exist!',
				});
			}

			/**运行中的任务，在execute中暂停 */
			existTask.executeStatus = 'PAUSE';
		}
	}

	/**
	 * 获取分片与md5
	 * @param task
	 */
	private async _executeTask(task: TaskProps) {
		const { file, executeStatus } = task;
		if (executeStatus !== 'RUNNING') {
			return this._returnMessage({
				type: ReturnMessageType.ERROR,
				id: task.id,
				message: "the specified task's status is not running",
			});
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
		console.log(task, 'running task');
		for (task.index = task.index || 0; task.index < count; task.index++) {
			/**执行过程中暂停 */
			if (task.executeStatus === 'PAUSE') {
				/**不需要移除task */
				this._shiftTaskAndExecuteNext();
				return this._returnMessage({
					type: ReturnMessageType.PAUSE,
					id: task.id,
					message: 'the specified task has been successfully paused',
				});
			}

			/**取消 */
			if (task.executeStatus === 'CANCEL') {
				task.executeStatus = 'CANCEL';

				/**需要移除task */
				this._shiftTaskAndExecuteNext(task);
				return this._returnMessage({
					type: ReturnMessageType.CANCEL,
					id: task.id,
					message:
						'the specified task has been successfully canceled',
				});
			}

			const begin = chunkByteSize * task.index;
			const end =
				task.index === count - 1
					? file.size
					: chunkByteSize * (task.index + 1);
			const chunk = file.slice(begin, end);
			try {
				if (task.useMD5) {
					const ab = (await this._readAsArrayBuffer(
						chunk,
					)) as ArrayBuffer;

					//@ts-ignore
					spark.append(ab);
				}

				const progress = (task.index / count) * 100;
				const returnProgress = Math.floor(progress);
				this._returnMessage({
					id: task.id,
					type: ReturnMessageType.PROGRESS,
					progress: returnProgress,
				});
				chunks.push({ data: chunk, index: task.index });
			} catch (error) {
				task.executeStatus = 'ERROR';

				/**不需要移除task */
				this._shiftTaskAndExecuteNext();
				return this._returnMessage({
					id: task.id,
					type: ReturnMessageType.ERROR,
					message: 'catch an error while reading blob to arraybuffer',
				});
			}
		}

		let md5 = '';
		if (task.useMD5) {
			md5 = spark.end();
		}
		const fileProps = {
			...task,
			md5,
			chunks: [...chunks],
			total: chunks.length,
			index: 0,
			progress: 0,
		};
		this._returnMessage({
			id: task.id,
			type: ReturnMessageType.SUCCESS,
			file: fileProps,
		});

		/**重新取第一个PENDING任务执行 */
		this._shiftTaskAndExecuteNext(task);
	}

	/**
	 * 移除第一个任务，并执行下一个非PAUSE|ERROR的任务
	 */
	private _shiftTaskAndExecuteNext(task?: TaskProps) {
		if (task) {
			const index = this._taskList.findIndex(
				(_task) => _task.id === task.id,
			);
			if (index !== -1) this._taskList.splice(index, 1);
		}

		this._currentTask = null;
		if (this._taskList.length) {
			const pendingTaskList = this._taskList.filter(
				(task) => task.executeStatus === 'PENDING',
			);
			if (pendingTaskList.length) {
				this._currentTask = pendingTaskList[0];
				this._currentTask.executeStatus = 'RUNNING';
				this._executeTask(this._currentTask);
			}
		}
	}

	/**
	 * 转blob为arraybuffer
	 * @param blobData
	 */
	private _readAsArrayBuffer(blobData: Blob): Promise<ArrayBuffer | Error> {
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
			};
			reader.onerror = () => {
				reject(new Error('fileReader read failed'));
			};
			reader.readAsArrayBuffer(blobData);
		});
	}
}

//@ts-ignore
self.worker = new ChunkWorker();
