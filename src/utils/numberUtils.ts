/**
 * 数字处理工具函数
 * 仅保留在outlineUtils.ts中使用的函数
 */

/**
 * 将数字转换为中文数字
 * @param num 要转换的数字
 * @returns 转换后的中文数字
 */
export function num2Chinese(num: number): string {
    const units = ['', '十', '百', '千', '万'];
    const numbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

    if (num === 0) return numbers[0];
    if (num < 0) return '负' + num2Chinese(-num);
    if (num < 10) return numbers[num];

    let result = '';
    let temp = num;
    let unitIndex = 0;

    while (temp > 0) {
        const digit = temp % 10;
        if (digit === 0) {
            if (result && result[0] !== numbers[0]) {
                result = numbers[0] + result;
            }
        } else {
            result = numbers[digit] + units[unitIndex] + result;
        }
        temp = Math.floor(temp / 10);
        unitIndex++;
    }

    // 处理特殊情况
    result = result.replace(/零+$/, ''); // 移除末尾的零
    result = result.replace(/零+/g, '零'); // 多个零合并为一个

    // 处理"一十"开头的情况
    if (result.startsWith('一十')) {
        result = result.substring(1);
    }

    return result;
}





