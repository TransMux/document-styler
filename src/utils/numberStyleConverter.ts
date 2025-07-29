/**
 * 标题编号样式转换工具
 */

import { HeadingNumberStyle } from "../types";

/**
 * 数字转换器接口
 */
interface INumberConverter {
    convert(num: number): string;
    getDisplayName(): string;
    getExample(): string;
}

/**
 * 阿拉伯数字转换器
 */
class ArabicConverter implements INumberConverter {
    convert(num: number): string {
        return num.toString();
    }
    
    getDisplayName(): string {
        return "阿拉伯数字";
    }
    
    getExample(): string {
        return "1";
    }
}

/**
 * 中文数字转换器
 */
class ChineseConverter implements INumberConverter {
    private readonly chineseNums = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    private readonly chineseUnits = ['', '十', '百', '千'];
    
    convert(num: number): string {
        if (num === 0) return '零';
        if (num < 0) return '';
        
        if (num < 10) {
            return this.chineseNums[num];
        }
        
        if (num < 20) {
            return num === 10 ? '十' : '十' + this.chineseNums[num % 10];
        }
        
        if (num < 100) {
            const tens = Math.floor(num / 10);
            const ones = num % 10;
            return this.chineseNums[tens] + '十' + (ones > 0 ? this.chineseNums[ones] : '');
        }
        
        // 简化处理，超过100的数字直接返回阿拉伯数字
        return num.toString();
    }
    
    getDisplayName(): string {
        return "中文数字";
    }
    
    getExample(): string {
        return "一";
    }
}

/**
 * 中文大写数字转换器
 */
class ChineseUpperConverter implements INumberConverter {
    private readonly chineseUpperNums = ['', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    
    convert(num: number): string {
        if (num === 0) return '零';
        if (num < 0 || num >= this.chineseUpperNums.length) return num.toString();
        
        if (num < 10) {
            return this.chineseUpperNums[num];
        }
        
        if (num === 10) return '拾';
        if (num < 20) {
            return '拾' + this.chineseUpperNums[num % 10];
        }
        
        if (num < 100) {
            const tens = Math.floor(num / 10);
            const ones = num % 10;
            return this.chineseUpperNums[tens] + '拾' + (ones > 0 ? this.chineseUpperNums[ones] : '');
        }
        
        return num.toString();
    }
    
    getDisplayName(): string {
        return "中文大写";
    }
    
    getExample(): string {
        return "壹";
    }
}

/**
 * 圆圈数字转换器
 */
class CircledConverter implements INumberConverter {
    private readonly circledNums = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', 
                                   '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
    
    convert(num: number): string {
        if (num > 0 && num < this.circledNums.length) {
            return this.circledNums[num];
        }
        return num.toString();
    }
    
    getDisplayName(): string {
        return "圆圈数字";
    }
    
    getExample(): string {
        return "①";
    }
}

/**
 * 圆圈中文转换器
 */
class CircledChineseConverter implements INumberConverter {
    private readonly circledChineseNums = ['', '❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '❿'];
    
    convert(num: number): string {
        if (num > 0 && num < this.circledChineseNums.length) {
            return this.circledChineseNums[num];
        }
        return num.toString();
    }
    
    getDisplayName(): string {
        return "圆圈中文";
    }
    
    getExample(): string {
        return "❶";
    }
}

/**
 * 表情数字转换器
 */
class EmojiConverter implements INumberConverter {
    private readonly emojiNums = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    convert(num: number): string {
        if (num > 0 && num < this.emojiNums.length) {
            return this.emojiNums[num];
        }
        return num.toString();
    }
    
    getDisplayName(): string {
        return "表情数字";
    }
    
    getExample(): string {
        return "1️⃣";
    }
}

/**
 * 英文大写转换器
 */
class UpperAlphaConverter implements INumberConverter {
    convert(num: number): string {
        if (num < 1 || num > 26) return num.toString();
        return String.fromCharCode(64 + num); // A=65
    }
    
    getDisplayName(): string {
        return "英文大写";
    }
    
    getExample(): string {
        return "A";
    }
}

/**
 * 英文小写转换器
 */
class LowerAlphaConverter implements INumberConverter {
    convert(num: number): string {
        if (num < 1 || num > 26) return num.toString();
        return String.fromCharCode(96 + num); // a=97
    }
    
    getDisplayName(): string {
        return "英文小写";
    }
    
    getExample(): string {
        return "a";
    }
}

/**
 * 罗马数字大写转换器
 */
class UpperRomanConverter implements INumberConverter {
    private readonly romanNums = [
        '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
        'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'
    ];
    
    convert(num: number): string {
        if (num > 0 && num < this.romanNums.length) {
            return this.romanNums[num];
        }
        return num.toString();
    }
    
    getDisplayName(): string {
        return "罗马数字大写";
    }
    
    getExample(): string {
        return "I";
    }
}

/**
 * 罗马数字小写转换器
 */
class LowerRomanConverter implements INumberConverter {
    private readonly romanNums = [
        '', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
        'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'
    ];
    
    convert(num: number): string {
        if (num > 0 && num < this.romanNums.length) {
            return this.romanNums[num];
        }
        return num.toString();
    }
    
    getDisplayName(): string {
        return "罗马数字小写";
    }
    
    getExample(): string {
        return "i";
    }
}

/**
 * 天干转换器
 */
class HeavenlyStemsConverter implements INumberConverter {
    private readonly heavenlyStems = ['', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    
    convert(num: number): string {
        if (num > 0 && num < this.heavenlyStems.length) {
            return this.heavenlyStems[num];
        }
        return num.toString();
    }
    
    getDisplayName(): string {
        return "天干";
    }
    
    getExample(): string {
        return "甲";
    }
}

/**
 * 地支转换器
 */
class EarthlyBranchesConverter implements INumberConverter {
    private readonly earthlyBranches = ['', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    
    convert(num: number): string {
        if (num > 0 && num < this.earthlyBranches.length) {
            return this.earthlyBranches[num];
        }
        return num.toString();
    }
    
    getDisplayName(): string {
        return "地支";
    }
    
    getExample(): string {
        return "子";
    }
}

/**
 * 转换器映射
 */
const converterMap = new Map<HeadingNumberStyle, INumberConverter>([
    [HeadingNumberStyle.ARABIC, new ArabicConverter()],
    [HeadingNumberStyle.CHINESE, new ChineseConverter()],
    [HeadingNumberStyle.CHINESE_UPPER, new ChineseUpperConverter()],
    [HeadingNumberStyle.CIRCLED, new CircledConverter()],
    [HeadingNumberStyle.CIRCLED_CHINESE, new CircledChineseConverter()],
    [HeadingNumberStyle.EMOJI, new EmojiConverter()],
    [HeadingNumberStyle.UPPER_ALPHA, new UpperAlphaConverter()],
    [HeadingNumberStyle.LOWER_ALPHA, new LowerAlphaConverter()],
    [HeadingNumberStyle.UPPER_ROMAN, new UpperRomanConverter()],
    [HeadingNumberStyle.LOWER_ROMAN, new LowerRomanConverter()],
    [HeadingNumberStyle.HEAVENLY_STEMS, new HeavenlyStemsConverter()],
    [HeadingNumberStyle.EARTHLY_BRANCHES, new EarthlyBranchesConverter()]
]);

/**
 * 数字样式转换器
 */
export class NumberStyleConverter {
    /**
     * 转换数字为指定样式
     * @param num 数字
     * @param style 样式
     * @param format 格式模板，如 "{1}."、"({1})"、"[{1}]"
     * @returns 转换后的字符串
     */
    static convert(num: number, style: HeadingNumberStyle, format: string = "{1}"): string {
        const converter = converterMap.get(style);
        if (!converter) {
            return num.toString();
        }
        
        const convertedNum = converter.convert(num);
        
        return format.replace('{1}', convertedNum);
    }
    
    /**
     * 获取样式的显示名称
     * @param style 样式
     * @returns 显示名称
     */
    static getDisplayName(style: HeadingNumberStyle): string {
        const converter = converterMap.get(style);
        if (!converter) {
            return style;
        }
        
        return converter.getDisplayName();
    }
    
    /**
     * 获取样式的示例
     * @param style 样式
     * @returns 示例字符串
     */
    static getExample(style: HeadingNumberStyle): string {
        const converter = converterMap.get(style);
        if (!converter) {
            return "1";
        }

        return converter.getExample();
    }
    
    /**
     * 获取所有可用的样式
     * @returns 样式数组
     */
    static getAllStyles(): HeadingNumberStyle[] {
        return Object.values(HeadingNumberStyle);
    }
    
    /**
     * 获取样式选项列表（用于UI）
     * @returns 样式选项数组
     */
    static getStyleOptions(): Array<{value: HeadingNumberStyle, label: string, example: string}> {
        return this.getAllStyles().map(style => ({
            value: style,
            label: this.getDisplayName(style),
            example: this.getExample(style)
        }));
    }
}
