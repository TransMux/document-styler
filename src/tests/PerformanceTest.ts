/**
 * 性能测试用例
 * 测试重构后系统的性能表现
 */

import { CrossReferenceController } from '../core/CrossReferenceController';
import { PerformanceMonitor } from '../core/utils/PerformanceMonitor';

export class PerformanceTest {
    private controller: CrossReferenceController;
    private performanceMonitor: PerformanceMonitor;
    private testResults: Array<{
        testName: string;
        duration: number;
        memoryUsage: number;
        passed: boolean;
        threshold: number;
    }> = [];

    constructor() {
        this.controller = new CrossReferenceController({
            autoUpdate: false,
            enableUI: false,
            enableWebSocket: false
        });
        this.performanceMonitor = new PerformanceMonitor();
    }

    /**
     * 运行所有性能测试
     */
    async runAllTests(): Promise<void> {
        console.log('PerformanceTest: 开始运行性能测试...');

        await this.controller.init();

        await this.testDocumentSwitchPerformance();
        await this.testFiguresListPerformance();
        await this.testStyleApplicationPerformance();
        await this.testMemoryUsagePerformance();
        await this.testConcurrentOperationsPerformance();

        await this.controller.destroy();

        this.printPerformanceResults();
    }

    /**
     * 测试文档切换性能
     */
    private async testDocumentSwitchPerformance(): Promise<void> {
        const testName = '文档切换性能';
        const threshold = 100; // 100ms阈值

        const { metric } = await this.performanceMonitor.measureAsync(
            'document-switch-performance',
            async () => {
                const testDocId = '20231201120000-perf001';
                await this.controller.handleDocumentSwitch(testDocId);
            }
        );

        this.recordPerformanceTest(
            testName,
            metric.duration,
            metric.memoryUsage || 0,
            metric.duration <= threshold,
            threshold
        );
    }

    /**
     * 测试图表列表获取性能
     */
    private async testFiguresListPerformance(): Promise<void> {
        const testName = '图表列表获取性能';
        const threshold = 50; // 50ms阈值

        const { metric } = await this.performanceMonitor.measureAsync(
            'figures-list-performance',
            async () => {
                const testDocId = '20231201120000-perf002';
                await this.controller.getFiguresList(testDocId);
            }
        );

        this.recordPerformanceTest(
            testName,
            metric.duration,
            metric.memoryUsage || 0,
            metric.duration <= threshold,
            threshold
        );
    }

    /**
     * 测试样式应用性能
     */
    private async testStyleApplicationPerformance(): Promise<void> {
        const testName = '样式应用性能';
        const threshold = 30; // 30ms阈值

        const { metric } = await this.performanceMonitor.measureAsync(
            'style-application-performance',
            async () => {
                const testDocId = '20231201120000-perf003';
                // 模拟样式应用
                await this.controller.enableCrossReference(testDocId);
            }
        );

        this.recordPerformanceTest(
            testName,
            metric.duration,
            metric.memoryUsage || 0,
            metric.duration <= threshold,
            threshold
        );
    }

    /**
     * 测试内存使用性能
     */
    private async testMemoryUsagePerformance(): Promise<void> {
        const testName = '内存使用性能';
        const threshold = 10 * 1024 * 1024; // 10MB阈值

        const beforeMemory = this.getMemoryUsage();

        // 执行一系列操作
        for (let i = 0; i < 10; i++) {
            const testDocId = `20231201120000-mem${i.toString().padStart(3, '0')}`;
            await this.controller.handleDocumentSwitch(testDocId);
        }

        const afterMemory = this.getMemoryUsage();
        const memoryIncrease = afterMemory - beforeMemory;

        this.recordPerformanceTest(
            testName,
            0, // 不测试时间
            memoryIncrease,
            memoryIncrease <= threshold,
            threshold
        );
    }

    /**
     * 测试并发操作性能
     */
    private async testConcurrentOperationsPerformance(): Promise<void> {
        const testName = '并发操作性能';
        const threshold = 200; // 200ms阈值

        const { metric } = await this.performanceMonitor.measureAsync(
            'concurrent-operations-performance',
            async () => {
                // 并发执行多个操作
                const promises = [];
                for (let i = 0; i < 5; i++) {
                    const testDocId = `20231201120000-conc${i.toString().padStart(3, '0')}`;
                    promises.push(this.controller.getFiguresList(testDocId));
                }
                await Promise.all(promises);
            }
        );

        this.recordPerformanceTest(
            testName,
            metric.duration,
            metric.memoryUsage || 0,
            metric.duration <= threshold,
            threshold
        );
    }

    /**
     * 获取当前内存使用量
     * @returns 内存使用量（字节）
     */
    private getMemoryUsage(): number {
        if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize || 0;
        }
        return 0;
    }

    /**
     * 记录性能测试结果
     * @param testName 测试名称
     * @param duration 持续时间
     * @param memoryUsage 内存使用量
     * @param passed 是否通过
     * @param threshold 阈值
     */
    private recordPerformanceTest(
        testName: string,
        duration: number,
        memoryUsage: number,
        passed: boolean,
        threshold: number
    ): void {
        this.testResults.push({
            testName,
            duration,
            memoryUsage,
            passed,
            threshold
        });

        const status = passed ? '✅' : '❌';
        const durationStr = duration > 0 ? `${duration.toFixed(2)}ms` : 'N/A';
        const memoryStr = this.formatBytes(memoryUsage);
        const thresholdStr = threshold > 1024 * 1024 
            ? this.formatBytes(threshold)
            : `${threshold}ms`;

        console.log(`${status} ${testName}: ${durationStr} / ${memoryStr} (阈值: ${thresholdStr})`);
    }

    /**
     * 格式化字节数
     * @param bytes 字节数
     * @returns 格式化后的字符串
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 打印性能测试结果
     */
    private printPerformanceResults(): void {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;

        console.log('\n=== 性能测试结果 ===');
        console.log(`总测试数: ${totalTests}`);
        console.log(`通过: ${passedTests}`);
        console.log(`失败: ${failedTests}`);
        console.log(`通过率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

        // 统计平均性能
        const avgDuration = this.testResults
            .filter(r => r.duration > 0)
            .reduce((sum, r) => sum + r.duration, 0) / 
            this.testResults.filter(r => r.duration > 0).length;

        const totalMemory = this.testResults
            .reduce((sum, r) => sum + r.memoryUsage, 0);

        console.log(`平均执行时间: ${avgDuration.toFixed(2)}ms`);
        console.log(`总内存使用: ${this.formatBytes(totalMemory)}`);

        if (failedTests > 0) {
            console.log('\n未通过的测试:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => {
                    const actual = r.duration > 0 
                        ? `${r.duration.toFixed(2)}ms`
                        : this.formatBytes(r.memoryUsage);
                    const threshold = r.threshold > 1024 * 1024
                        ? this.formatBytes(r.threshold)
                        : `${r.threshold}ms`;
                    console.log(`- ${r.testName}: ${actual} > ${threshold}`);
                });
        }

        console.log('==================\n');
    }

    /**
     * 获取性能测试结果
     * @returns 测试结果
     */
    getTestResults(): Array<{
        testName: string;
        duration: number;
        memoryUsage: number;
        passed: boolean;
        threshold: number;
    }> {
        return [...this.testResults];
    }

    /**
     * 生成性能报告
     * @returns 性能报告
     */
    generatePerformanceReport(): {
        summary: {
            totalTests: number;
            passedTests: number;
            failedTests: number;
            passRate: number;
            averageDuration: number;
            totalMemoryUsage: number;
        };
        details: typeof this.testResults;
        recommendations: string[];
    } {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;

        const avgDuration = this.testResults
            .filter(r => r.duration > 0)
            .reduce((sum, r) => sum + r.duration, 0) / 
            this.testResults.filter(r => r.duration > 0).length;

        const totalMemoryUsage = this.testResults
            .reduce((sum, r) => sum + r.memoryUsage, 0);

        const recommendations: string[] = [];

        if (avgDuration > 50) {
            recommendations.push('平均执行时间较长，建议优化算法或减少DOM操作');
        }

        if (totalMemoryUsage > 50 * 1024 * 1024) {
            recommendations.push('内存使用量较高，建议优化缓存策略或清理无用数据');
        }

        if (failedTests > 0) {
            recommendations.push('存在性能不达标的测试，建议针对性优化');
        }

        return {
            summary: {
                totalTests,
                passedTests,
                failedTests,
                passRate: (passedTests / totalTests) * 100,
                averageDuration: avgDuration || 0,
                totalMemoryUsage
            },
            details: this.testResults,
            recommendations
        };
    }
}

// 导出测试运行函数
export async function runPerformanceTests(): Promise<void> {
    const test = new PerformanceTest();
    await test.runAllTests();
}
