/**
 * API 调用工具函数
 */

import { fetchPost } from "siyuan";

/**
 * 获取思源版本号
 * @returns 版本号字符串
 */
export async function getVersion(): Promise<string> {
    return new Promise((resolve) => {
        fetchPost("/api/system/version", {}, (response) => {
            if (response.code === 0 && response.data) {
                resolve(response.data);
            } else {
                resolve("0.0.0");
            }
        });
    });
}

/**
 * 批量更新块内容
 * @param updates 更新内容映射 {blockId: content}
 * @param dataType 数据类型 "dom" | "markdown"
 * @param useBulkApi 是否使用批量API
 */
export async function batchUpdateBlockContent(
    updates: Record<string, string>,
    dataType: "dom" | "markdown" = "dom",
    useBulkApi: boolean = false
): Promise<void> {
    const blockIds = Object.keys(updates);
    if (blockIds.length === 0) return;

    if (useBulkApi && blockIds.length > 1) {
        // 使用批量更新API（需要思源版本 >= 3.1.25）
        const transactions = blockIds.map(blockId => ({
            id: blockId,
            data: updates[blockId],
            dataType: dataType
        }));

        return new Promise((resolve, reject) => {
            fetchPost("/api/block/updateBlocks", {
                transactions: transactions
            }, (response) => {
                if (response.code === 0) {
                    resolve();
                } else {
                    reject(new Error(response.msg || "批量更新失败"));
                }
            });
        });
    } else {
        // 逐个更新
        const promises = blockIds.map(blockId => 
            updateBlockContent(blockId, updates[blockId], dataType)
        );
        await Promise.all(promises);
    }
}

/**
 * 更新单个块内容
 * @param blockId 块ID
 * @param content 内容
 * @param dataType 数据类型
 */
export function updateBlockContent(
    blockId: string, 
    content: string, 
    dataType: "dom" | "markdown" = "dom"
): Promise<void> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/block/updateBlock", {
            id: blockId,
            data: content,
            dataType: dataType
        }, (response) => {
            if (response.code === 0) {
                resolve();
            } else {
                reject(new Error(response.msg || "更新块失败"));
            }
        });
    });
}

/**
 * 获取块属性
 * @param blockId 块ID
 * @returns 块属性对象
 */
export function getBlockAttrs(blockId: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/attr/getBlockAttrs", {
            id: blockId
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data || {});
            } else {
                reject(new Error(response.msg || "获取块属性失败"));
            }
        });
    });
}

/**
 * 设置块属性
 * @param blockId 块ID
 * @param attrs 属性对象
 */
export function setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/attr/setBlockAttrs", {
            id: blockId,
            attrs: attrs
        }, (response) => {
            if (response.code === 0) {
                resolve();
            } else {
                reject(new Error(response.msg || "设置块属性失败"));
            }
        });
    });
}

/**
 * 执行SQL查询
 * @param sql SQL语句
 * @returns 查询结果
 */
export function querySQL(sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/query/sql", {
            stmt: sql
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data || []);
            } else {
                reject(new Error(response.msg || "SQL查询失败"));
            }
        });
    });
}

/**
 * 查询文档中的图片和表格
 * 使用getDoc API获取完整DOM结构，并从中解析符合条件的图表
 * 只处理在超级块内，且超级块只有图表和文本两个元素的情况
 * @param docId 文档ID
 * @returns 图片和表格信息数组
 */
export async function queryDocumentFigures(docId: string): Promise<any[]> {
    // 使用getDoc API获取完整的文档DOM结构
    const htmlContent = await getDocumentFullContent(docId);
    if (!htmlContent) {
        throw new Error('无法获取文档内容');
    }

    // 从DOM结构中解析符合条件的图表
    const figuresFromDOM = await parseFiguresFromDOM(htmlContent);

    console.log(`从DOM解析到 ${figuresFromDOM.length} 个符合条件的图表`);

    return figuresFromDOM;
}

/**
 * 从DOM结构中解析符合条件的图表
 * 只处理在超级块内，且超级块只有图表和文本两个元素的情况
 * @param htmlContent 文档的HTML内容
 * @returns 符合条件的图表信息数组
 */
async function parseFiguresFromDOM(htmlContent: string): Promise<any[]> {
    const results: any[] = [];

    try {
        // 创建DOM解析器
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // 查找所有超级块
        const superBlocks = doc.querySelectorAll('[data-type="NodeSuperBlock"]');

        for (const superBlock of superBlocks) {
            const figuresInSuperBlock = analyzeSuperBlockForFigures(superBlock);
            results.push(...figuresInSuperBlock);
        }

        console.log(`从 ${superBlocks.length} 个超级块中解析到 ${results.length} 个符合条件的图表`);

    } catch (error) {
        console.error('解析DOM中的图表失败:', error);
    }

    return results;
}

/**
 * 分析超级块中的图表
 * @param superBlock 超级块DOM元素
 * @returns 符合条件的图表信息数组
 */
function analyzeSuperBlockForFigures(superBlock: Element): any[] {
    const results: any[] = [];

    try {
        // 获取超级块的布局
        const layout = superBlock.getAttribute('data-sb-layout');

        // 只处理竖直布局（row）的超级块
        if (layout !== 'row') {
            return results;
        }

        // 获取所有直接子元素（排除属性元素）
        const children = Array.from(superBlock.children).filter(child =>
            !child.classList.contains('protyle-attr')
        );

        // 必须恰好有两个子元素
        if (children.length !== 2) {
            return results;
        }

        // 分析两个子元素，找出图表和文本的组合
        const figureInfo = identifyFigureAndTextPair(children);
        if (figureInfo) {
            results.push(figureInfo);
        }

    } catch (error) {
        console.error('分析超级块失败:', error);
    }

    return results;
}

/**
 * 识别图表和文本的配对
 * @param children 超级块的子元素数组
 * @returns 图表信息，如果不符合条件则返回null
 */
function identifyFigureAndTextPair(children: Element[]): any | null {
    let figureElement: Element | null = null;
    let textElement: Element | null = null;
    let figureType: 'image' | 'table' | null = null;

    // 分析两个子元素
    for (const child of children) {
        const nodeType = child.getAttribute('data-type');

        if (nodeType === 'NodeTable') {
            // 表格元素
            if (figureElement) return null; // 已经有图表了，不符合条件
            figureElement = child;
            figureType = 'table';
        } else if (nodeType === 'NodeParagraph') {
            // 段落元素，检查是否包含图片
            const imgElement = child.querySelector('[data-type="img"]');
            if (imgElement) {
                // 包含图片的段落
                if (figureElement) return null; // 已经有图表了，不符合条件
                figureElement = child;
                figureType = 'image';
            } else {
                // 纯文本段落
                if (textElement) return null; // 已经有文本了，不符合条件
                textElement = child;
            }
        } else {
            // 其他类型的元素，不符合条件
            return null;
        }
    }

    // 必须同时有图表和文本元素
    if (!figureElement || !textElement || !figureType) {
        return null;
    }

    // 提取图表信息
    const figureId = figureElement.getAttribute('data-node-id');
    const textId = textElement.getAttribute('data-node-id');
    if (!figureId || !textId) {
        return null;
    }

    // 提取内容和标题
    const content = extractElementContent(figureElement, figureType);
    const caption = extractElementText(textElement);

    return {
        id: figureId,
        type: figureElement.getAttribute('data-type') || (figureType === 'image' ? 'p' : 't'),
        subtype: figureElement.getAttribute('data-subtype') || '',
        content: content,
        figureType: figureType,
        caption: caption,
        // 保存标题元素的ID，用于生成CSS样式
        captionId: textId,
        // 保存DOM顺序信息，用于后续排序
        domOrder: Array.from(figureElement.parentElement?.parentElement?.children || []).indexOf(figureElement.parentElement!)
    };
}

/**
 * 提取元素内容
 * @param element DOM元素
 * @param figureType 图表类型
 * @returns 内容字符串
 */
function extractElementContent(element: Element, figureType: 'image' | 'table'): string {
    if (figureType === 'image') {
        // 对于图片，尝试提取markdown格式
        const editableDiv = element.querySelector('[contenteditable="true"]');
        if (editableDiv) {
            return editableDiv.innerHTML || '';
        }
        return element.innerHTML || '';
    } else if (figureType === 'table') {
        // 对于表格，提取表格内容
        return element.innerHTML || '';
    }
    return '';
}

/**
 * 提取元素的纯文本内容
 * @param element DOM元素
 * @returns 文本内容
 */
function extractElementText(element: Element): string {
    const editableDiv = element.querySelector('[contenteditable="true"]');
    if (editableDiv) {
        return editableDiv.textContent?.trim() || '';
    }
    return element.textContent?.trim() || '';
}



/**
 * 获取文档的完整内容和结构
 * @param docId 文档ID
 * @returns 文档的完整DOM内容
 */
export async function getDocumentFullContent(docId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/filetree/getDoc", {
            id: docId,
            mode: 3, // 上下都加载
            size: 2147483647, // 最大值，加载所有内容
            isBacklink: false
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data.content || "");
            } else {
                reject(new Error(response.msg || "获取文档内容失败"));
            }
        });
    });
}





/**
 * 获取文档标题
 * @param docId 文档ID
 * @returns 文档标题
 */
export function getDocumentTitle(docId: string): Promise<string> {
    return new Promise((resolve) => {
        fetchPost("/api/block/getBlockInfo", {
            id: docId
        }, (response) => {
            if (response.code === 0 && response.data) {
                resolve(response.data.name || "未命名文档");
            } else {
                resolve("未命名文档");
            }
        });
    });
}

/**
 * 获取块信息
 * @param blockId 块ID
 * @returns 块信息
 */
export function getBlockInfo(blockId: string): Promise<any> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/block/getBlockInfo", {
            id: blockId
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data);
            } else {
                reject(new Error(response.msg || "获取块信息失败"));
            }
        });
    });
}

/**
 * 检查API是否可用
 * @param apiPath API路径
 * @returns 是否可用
 */
export async function checkApiAvailable(apiPath: string): Promise<boolean> {
    try {
        const response = await fetch(apiPath, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * 获取文档大纲
 * @param docId 文档ID
 * @param preview 是否为预览模式
 * @returns 大纲数据
 */
export function getDocumentOutline(docId: string, preview: boolean = false): Promise<any[]> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/outline/getDocOutline", {
            id: docId,
            preview: preview
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data || []);
            } else {
                reject(new Error(response.msg || "获取文档大纲失败"));
            }
        });
    });
}

/**
 * 安全地执行API调用
 * @param apiCall API调用函数
 * @param fallback 失败时的回调函数
 * @returns API调用结果
 */
export async function safeApiCall<T>(
    apiCall: () => Promise<T>,
    fallback?: (error: Error) => T
): Promise<T | undefined> {
    try {
        return await apiCall();
    } catch (error) {
        console.error('API调用失败:', error);
        if (fallback) {
            return fallback(error as Error);
        }
        return undefined;
    }
}

/**
 * 获取文档属性
 * @param docId 文档ID
 * @param attrName 属性名
 * @returns 属性值
 */
export async function getDocumentAttr(docId: string, attrName: string): Promise<string | null> {
    try {
        const attrs = await getBlockAttrs(docId);
        return attrs[attrName] || null;
    } catch (error) {
        console.error('获取文档属性失败:', error);
        return null;
    }
}

/**
 * 设置文档属性
 * @param docId 文档ID
 * @param attrs 属性对象
 * @returns 是否成功
 */
export async function setDocumentAttr(docId: string, attrs: Record<string, string>): Promise<boolean> {
    try {
        await setBlockAttrs(docId, attrs);
        return true;
    } catch (error) {
        console.error('设置文档属性失败:', error);
        return false;
    }
}


