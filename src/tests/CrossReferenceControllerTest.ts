/**
 * CrossReferenceController 测试用例
 * 测试重构后的交叉引用控制器功能
 */

import { CrossReferenceController } from '../core/CrossReferenceController';
import { IFigureInfo } from '../types';

export class CrossReferenceControllerTest {
    private controller: CrossReferenceController;
    private testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

    constructor() {
        this.controller = new CrossReferenceController({
            imagePrefix: '图',
            tablePrefix: '表',
            autoUpdate: false, // 测试时禁用自动更新
            enableUI: false,   // 测试时禁用UI
            enableWebSocket: false // 测试时禁用WebSocket
        });
    }

    /**
     * 运行所有测试
     */
    async runAllTests(): Promise<void> {
        console.log('CrossReferenceControllerTest: 开始运行测试...');

        await this.testInitialization();
        await this.testDocumentSwitch();
        await this.testFiguresList();
        await this.testPerformanceMonitoring();
        await this.testMemoryManagement();
        await this.testSystemHealth();
        await this.testConfigUpdate();
        await this.testDestroy();

        this.printTestResults();
    }

    /**
     * 测试初始化
     */
    private async testInitialization(): Promise<void> {
        try {
            await this.controller.init();
            const stats = this.controller.getStats();
            
            this.assert(stats.isInitialized === true, '控制器应该已初始化');
            this.recordTest('初始化测试', true);

        } catch (error) {
            this.recordTest('初始化测试', false, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 测试文档切换
     */
    private async testDocumentSwitch(): Promise<void> {
        try {
            const testDocId = '20231201120000-test123';
            
            // 模拟文档切换
            await this.controller.handleDocumentSwitch(testDocId);
            
            const stats = this.controller.getStats();
            this.assert(stats.currentDocId === testDocId, '当前文档ID应该已更新');
            
            this.recordTest('文档切换测试', true);

        } catch (error) {
            this.recordTest('文档切换测试', false, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 测试图表列表获取
     */
    private async testFiguresList(): Promise<void> {
        try {
            const testDocId = '20231201120000-test123';
            
            // 获取图表列表
            const figures = await this.controller.getFiguresList(testDocId);
            
            this.assert(Array.isArray(figures), '图表列表应该是数组');
            this.recordTest('图表列表获取测试', true);

        } catch (error) {
            this.recordTest('图表列表获取测试', false, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 测试性能监控
     */
    private async testPerformanceMonitoring(): Promise<void> {
        try {
            const performanceReport = this.controller.getPerformanceReport();
            
            this.assert(typeof performanceReport === 'object', '性能报告应该是对象');
            this.assert('summary' in performanceReport, '性能报告应该包含摘要');
            this.assert('slowOperations' in performanceReport, '性能报告应该包含慢操作');
            
            this.recordTest('性能监控测试', true);

        } catch (error) {
            this.recordTest('性能监控测试', false, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 测试内存管理
     */
    private async testMemoryManagement(): Promise<void> {
        try {
            const memoryReport = this.controller.getMemoryReport();
            
            this.assert(typeof memoryReport === 'object', '内存报告应该是对象');
            this.assert('currentStats' in memoryReport, '内存报告应该包含当前统计');
            this.assert('warnings' in memoryReport, '内存报告应该包含警告');
            
            // 测试性能优化
            await this.controller.optimizePerformance();
            
            this.recordTest('内存管理测试', true);

        } catch (error) {
            this.recordTest('内存管理测试', false, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 测试系统健康检查
     */
    private async testSystemHealth(): Promise<void> {
        try {
            const healthReport = this.controller.checkSystemHealth();
            
            this.assert(typeof healthReport === 'object', '健康报告应该是对象');
            this.assert('isHealthy' in healthReport, '健康报告应该包含健康状态');
            this.assert('warnings' in healthReport, '健康报告应该包含警告');
            this.assert('recommendations' in healthReport, '健康报告应该包含建议');
            
            this.recordTest('系统健康检查测试', true);

        } catch (error) {
            this.recordTest('系统健康检查测试', false, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 测试配置更新
     */
    private async testConfigUpdate(): Promise<void> {
        try {
            // 更新配置
            this.controller.updateConfig({
                imagePrefix: '图片',
                tablePrefix: '表格'
            });
            
            // 验证配置是否生效（通过统计信息间接验证）
            const stats = this.controller.getStats();
            this.assert(typeof stats === 'object', '统计信息应该是对象');
            
            this.recordTest('配置更新测试', true);

        } catch (error) {
            this.recordTest('配置更新测试', false, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 测试销毁
     */
    private async testDestroy(): Promise<void> {
        try {
            await this.controller.destroy();
            
            const stats = this.controller.getStats();
            this.assert(stats.isInitialized === false, '控制器应该已销毁');
            
            this.recordTest('销毁测试', true);

        } catch (error) {
            this.recordTest('销毁测试', false, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 断言函数
     * @param condition 条件
     * @param message 错误消息
     */
    private assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(message);
        }
    }

    /**
     * 记录测试结果
     * @param name 测试名称
     * @param passed 是否通过
     * @param error 错误信息
     */
    private recordTest(name: string, passed: boolean, error?: string): void {
        this.testResults.push({ name, passed, error });
        
        if (passed) {
            console.log(`✅ ${name}: 通过`);
        } else {
            console.error(`❌ ${name}: 失败 - ${error}`);
        }
    }

    /**
     * 打印测试结果
     */
    private printTestResults(): void {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;

        console.log('\n=== CrossReferenceController 测试结果 ===');
        console.log(`总测试数: ${totalTests}`);
        console.log(`通过: ${passedTests}`);
        console.log(`失败: ${failedTests}`);
        console.log(`通过率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

        if (failedTests > 0) {
            console.log('\n失败的测试:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => console.log(`- ${r.name}: ${r.error}`));
        }

        console.log('=====================================\n');
    }

    /**
     * 获取测试结果
     * @returns 测试结果
     */
    getTestResults(): Array<{ name: string; passed: boolean; error?: string }> {
        return [...this.testResults];
    }

    /**
     * 创建模拟图表数据
     * @returns 模拟数据
     */
    private createMockFigures(): IFigureInfo[] {
        return [
            {
                id: '20231201120000-img001',
                type: 'image',
                content: '![测试图片](test.jpg)',
                caption: '这是一个测试图片',
                number: 1,
                captionId: '20231201120000-cap001'
            },
            {
                id: '20231201120000-tbl001',
                type: 'table',
                content: '<table><tr><td>测试</td></tr></table>',
                caption: '这是一个测试表格',
                number: 1,
                captionId: '20231201120000-cap002'
            }
        ];
    }
}

// 导出测试运行函数
export async function runCrossReferenceControllerTests(): Promise<void> {
    const test = new CrossReferenceControllerTest();
    await test.runAllTests();
}
