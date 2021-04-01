/*
 * @Description: Type utils
 * @Author: SZEWEC
 * @Date: 2021-04-01 16:18:42
 * @LastEditTime: 2021-04-01 17:17:53
 * @LastEditors: Sam
 */

export namespace TypeUtils{

    /*
    * 转换文件体积
    * @param {number} size
    */
    export const transformFileSize = (size:number)=>{
        if(!size || size < 0) return '0 B';
        if(size < 1024){
            return size+' B';
        }
        if(size > 1024*1024*1024){
            return (size/(1024*1024*1024)).toFixed(2)+' GB';
        }
        if(size > 1024*1024){
            return (size/(1024*1024)).toFixed(2)+' MB';
        }
        if(size > 1024){
            return (size/1024).toFixed(2)+' KB';
        }
    }

    /**获取id */
    export const getId = (prefix?:string)=>{
        const s:any[] = [];
        const hexDigits = "0123456789abcdef";
        for (let i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "-";
        const uuid = s.join("");
        return prefix ? prefix+'-'+uuid : uuid;
    }
}
