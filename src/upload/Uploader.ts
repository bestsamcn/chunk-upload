/*
 * @Description: File Upload
 * @Author: SZEWEC
 * @Date: 2021-04-01 15:36:34
 * @LastEditTime: 2021-04-08 15:21:15
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

/**配置 */
export interface UploaderConfig {
	/**超时单位时，默认20小时 */
	timeout?: number;

	/**最大线程数，默认5 */
	maxThreadNumber?: number;

	/**是否使用MD5, 默认true */
	useMD5?: boolean;
}

const defaultConfig = {
	timeout: 20,
	maxThreadNumber: 5,
	useMD5: false,
};

/**文件上传类 */
export class Uploader {
	public timeout = 20 * HOUR;

	/**线程池 */
	private _threadPool!: ThreadPool;

	/**实列 */
	private static _instance: Uploader;

	/**文件列表 */
	private _fileList: FileProps[] = [];
	private _unfinishList: { md5: string; chunks: number[] }[] = [];

	/**初始化完成承诺 */
	private _defer = TypeUtils.defer();
	public get defer() {
		return this._defer;
	}

	/**获取文件列表 */
	public get fileList() {
		return this._fileList;
	}

	/**配置 */
	private _config = defaultConfig;

	/**
	 * 超时-单位小时
	 * @param timeout
	 */
	private constructor(config?: UploaderConfig) {
		this._config = { ...this._config, ...config };
		this.timeout = this._config.timeout * HOUR;
		this._initialize();
	}

	/**初始化 */
	private async _initialize() {
		this._threadPool = ThreadPool.create(this._config.maxThreadNumber);
		await this._getUnfinishList();
		this.defer.resolve();
	}

	/**获取未完成的文件列表 */
	private async _getUnfinishList() {
		const res = await Axios.get('http://localhost:4000/getTempList');
		if (res.data.code === 'SUCCESS') {
			this._unfinishList = res.data.data;
			return true;
		}
		return false;
	}

	/**
	 * 变更
	 * @param fileId
	 * @param file
	 * @param fileList
	 * @param message
	 */
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
		let extension = '';
		if (matches && matches.length) {
			extension = matches[1];
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
			extension,
			timestemp,
			transformedTime: TypeUtils.dateFormat(timestemp, 'yyyy-MM-dd'),
			file,
			size: file.size,
			transformedSize: TypeUtils.transformFileSize(file.size)!,
			status: FileStatus.CUT_PENDING,
			progress: 0,
			md5: '',
			chunks: [],
			total: 0,
			index: 0,
			useMD5: this._config.useMD5,
		};

		const thread = this._threadPool.get();
		console.log(thread, 'get thread');
		this._fileList.push(fileProps);
		if (!thread) {
			return fileProps;
		}

		thread.postMessage({ id, type: PostMessageType.ADD, file: fileProps });
		fileProps.thread = thread;
		thread.onmessage = ({ id, type, progress, message, file }) => {
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

				/**md5校验，确定当前分片下标 */
				const usingMD5 = this._config.useMD5
					? fileProps.md5
					: fileProps.simpleMD5;
				const unfinish = this._unfinishList.find(
					(file) => file.md5 === usingMD5,
				);
				const beginIndex = unfinish ? unfinish.chunks.length : 0;
				fileProps.index = beginIndex;

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
		let { chunks, md5, total, index, extension, id, simpleMD5 } = file;
		const uploadNext = async (chunkIndex: number): Promise<void> => {
			const chunk = chunks[chunkIndex];
			const formData = new FormData();
			formData.append('data', chunk.data);
			formData.append('index', chunk.index + '');
			formData.append('total', total + '');
			formData.append('md5', md5);
			formData.append('simpleMD5', simpleMD5);
			formData.append('extension', extension);
			const totalChunkProgress = (index / total) * 100;
			const oneChunkProgress = 1 / total;

			/**中断上传 */
			const cancelToken = new Axios.CancelToken((cancel) => {
				file.canceler = (message: string, shouldRemove = false) => {
					const index = this._fileList.findIndex(
						(_file) => _file.id === file.id,
					);
					if (index === -1) return;
					!!shouldRemove && this._fileList.splice(index, 1);
					this.onChange(
						file.id,
						file,
						this._fileList,
						'the upload is canceled',
					);
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
						if (progress >= 99) {
							file.progress = 99;
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

			/**成功或者已经上传过都会结束 */
			if (res.data.code === 'COMPLETE') {
				file.progress = 100;
				file.status = FileStatus.COMPLETE;
				return this.onChange(id, file, this._fileList, '完成');
			}

			/**分片上传成功 */
			if (res.data.code === 'SUCCESS') {
				if (index < total - 1) {
					index++;
					file.index = index;
					file.total = total;
					return uploadNext(index);
				}
			}
		};
		uploadNext(index);
	}

	/**移除文件 */
	public remove(id: string) {
		const index = this._fileList.findIndex((file) => file.id === id);
		if (index === -1) {
			console.error('the specifed file do not exist');
			return false;
		}
		const file = this._fileList[index];

		if (file?.canceler) {
			file?.canceler?.('upload was canceled by user', true);
			return;
		}

		/**切片中的文件，在message中删除 */
		file?.thread?.postMessage({ id, type: PostMessageType.CANCEL });
	}

	/**
	 * 暂停
	 * @param id
	 */
	public pause(id: string) {
		const index = this._fileList.findIndex((file) => file.id === id);
		if (index === -1) {
			console.error('the specifed file do not exist');
			return false;
		}
		const file = this._fileList[index];
		if (file?.canceler) {
			file.status = FileStatus.UPLOAD_PAUSE;
			file?.canceler?.('upload was canceled by user');
			file.canceler = undefined;
			return;
		}

		/**切片中的文件，在message中删除 */
		file?.thread?.postMessage({ id, type: PostMessageType.PAUSE });
		file.status = FileStatus.CUT_PAUSE;
	}

	/**
	 * 重试
	 * @param id
	 */
	public retry(id: string) {
		const index = this._fileList.findIndex((file) => file.id === id);
		if (index === -1) {
			console.error('the specifed file do not exist');
			return false;
		}
		const file = this._fileList[index];
		if (file.status === FileStatus.CUT_PAUSE) {
			file?.thread?.postMessage({ id, type: PostMessageType.RETRY });
		}

		if (file.status === FileStatus.UPLOAD_PAUSE) {
			this._upload(file);
		}
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
	public static create(config?: UploaderConfig) {
		if (this._instance) {
			return this._instance;
		}
		this._instance = new Uploader(config);
		return this._instance;
	}
}
