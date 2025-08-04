/**
 * 内测功能管理器
 * 负责管理内测功能的验证和状态管理
 */

import { IBetaFeatureManager, IBetaFeatureSettings } from "../types";
import { SettingsManager } from "./SettingsManager";

// 预设的内测码列表
const BETA_CODES: string[] = [
    "6z2ebok"
];

export class BetaFeatureManager implements IBetaFeatureManager {
    private settingsManager: SettingsManager;
    private pluginInstance: any;

    constructor(settingsManager: SettingsManager, pluginInstance?: any) {
        this.settingsManager = settingsManager;
        this.pluginInstance = pluginInstance;
    }

    async init(): Promise<void> {
        // 初始化时检查是否需要创建默认的内测设置
        const settings = this.settingsManager.getSettings();
        if (!settings.betaFeatures) {
            await this.settingsManager.updateSettings({
                betaFeatures: {
                    isVerified: false,
                    verifiedCodes: [],
                    verifiedAt: undefined
                }
            });
        }
    }

    destroy(): void {
        // 清理资源（如果需要的话）
    }

    /**
     * 检验是否加入内测
     */
    isBetaVerified(): boolean {
        const settings = this.settingsManager.getSettings();
        return settings.betaFeatures?.isVerified || false;
    }

    /**
     * 验证内测码
     * @param code 用户输入的内测码
     * @returns 是否验证成功
     */
    async verifyBetaCode(code: string): Promise<boolean> {
        if (!code || typeof code !== 'string') {
            return false;
        }

        // 检查内测码是否有效
        const isValidCode = BETA_CODES.includes(code.trim().toUpperCase());
        
        if (isValidCode) {
            const settings = this.settingsManager.getSettings();
            const betaSettings = settings.betaFeatures || {
                isVerified: false,
                verifiedCodes: [],
                verifiedAt: undefined
            };

            // 如果已经验证过该内测码，直接返回true
            if (betaSettings.verifiedCodes.includes(code.trim().toUpperCase())) {
                return true;
            }

            // 更新内测设置
            const updatedBetaSettings: IBetaFeatureSettings = {
                isVerified: true,
                verifiedCodes: [...betaSettings.verifiedCodes, code.trim().toUpperCase()],
                verifiedAt: Date.now()
            };

            await this.settingsManager.updateSettings({
                betaFeatures: updatedBetaSettings
            });

            console.log('DocumentStyler: 内测验证成功');
            return true;
        }

        console.log('DocumentStyler: 内测码无效');
        return false;
    }

    /**
     * 打开内测验证界面
     */
    openVerificationDialog(): void {
        if (!this.pluginInstance) {
            console.error('DocumentStyler: 插件实例未提供，无法打开验证对话框');
            return;
        }

        // 注册内测验证dock
        this.pluginInstance.addDock({
            config: {
                position: "RightTop",
                size: { width: 400, height: 300 },
                icon: "iconLock",
                title: "内测功能验证",
                show: true,
                index: 101
            },
            data: {},
            type: "beta-verification-dock",
            init: (custom: any) => this.initVerificationDock(custom),
            destroy: () => this.destroyVerificationDock()
        });
    }

    /**
     * 获取内测状态
     */
    getBetaStatus(): IBetaFeatureSettings {
        const settings = this.settingsManager.getSettings();
        return settings.betaFeatures || {
            isVerified: false,
            verifiedCodes: [],
            verifiedAt: undefined
        };
    }

    /**
     * 初始化验证dock
     */
    private async initVerificationDock(custom: any): Promise<void> {
        if (!custom || !custom.element) {
            console.error('DocumentStyler: Custom element not available for verification dock');
            return;
        }

        const isAlreadyVerified = this.isBetaVerified();
        
        custom.element.innerHTML = `
            <div class="beta-verification-panel" style="padding: 20px;">
                <div class="block__icons">
                    <div class="block__logo">
                        <svg class="block__logoicon"><use xlink:href="#iconLock"></use></svg>
                        内测功能验证
                    </div>
                </div>
                
                <div style="margin-top: 20px;">
                    ${isAlreadyVerified ? this.generateVerifiedHTML() : this.generateUnverifiedHTML()}
                </div>
            </div>
        `;

        if (!isAlreadyVerified) {
            this.bindVerificationEvents(custom.element);
        }
    }

    /**
     * 生成已验证状态的HTML
     */
    private generateVerifiedHTML(): string {
        const betaStatus = this.getBetaStatus();
        const verifiedDate = betaStatus.verifiedAt ? new Date(betaStatus.verifiedAt).toLocaleDateString() : '未知';
        
        return `
            <div class="verification-success" style="text-align: center;">
                <div style="color: var(--b3-theme-primary); font-size: 48px; margin-bottom: 16px;">
                    ✓
                </div>
                <h3 style="color: var(--b3-theme-primary); margin-bottom: 8px;">内测验证已完成</h3>
                <p style="color: var(--b3-theme-on-surface-light); margin-bottom: 16px;">
                    验证时间: ${verifiedDate}
                </p>
                <p style="color: var(--b3-theme-on-surface-light); margin-bottom: 20px;">
                    您已成功加入内测群体，可以使用所有内测功能！
                </p>
                <button class="b3-button b3-button--primary" id="close-verification-dock">
                    关闭
                </button>
            </div>
        `;
    }

    /**
     * 生成未验证状态的HTML
     */
    private generateUnverifiedHTML(): string {
        return `
            <div class="verification-form">
                <h3 style="margin-bottom: 16px;">加入内测群，获取更多功能</h3>
                <p style="color: var(--b3-theme-on-surface-light); margin-bottom: 20px;">
                    请输入内测码以解锁专属功能和提前体验新特性。
                </p>
                
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        内测码
                        <div class="b3-label__text">请输入您获得的内测验证码</div>
                    </div>
                    <span class="fn__space"></span>
                    <input class="b3-text-field fn__flex-center" 
                           id="beta-code-input" 
                           placeholder="请输入内测码" 
                           style="width: 200px;">
                </div>
                
                <div style="margin-top: 20px; text-align: center;">
                    <button class="b3-button b3-button--primary" id="verify-beta-code" style="margin-right: 8px;">
                        验证
                    </button>
                    <button class="b3-button" id="cancel-verification">
                        取消
                    </button>
                </div>
                
                <div id="verification-message" style="margin-top: 16px; text-align: center; display: none;">
                    <!-- 验证结果消息 -->
                </div>
            </div>
        `;
    }

    /**
     * 绑定验证界面事件
     */
    private bindVerificationEvents(element: Element): void {
        const codeInput = element.querySelector('#beta-code-input') as HTMLInputElement;
        const verifyButton = element.querySelector('#verify-beta-code') as HTMLButtonElement;
        const cancelButton = element.querySelector('#cancel-verification') as HTMLButtonElement;
        const messageDiv = element.querySelector('#verification-message') as HTMLDivElement;

        if (verifyButton && codeInput) {
            verifyButton.addEventListener('click', async () => {
                const code = codeInput.value.trim();
                if (!code) {
                    this.showMessage(messageDiv, '请输入内测码', 'error');
                    return;
                }

                verifyButton.disabled = true;
                verifyButton.textContent = '验证中...';

                try {
                    const isValid = await this.verifyBetaCode(code);
                    if (isValid) {
                        this.showMessage(messageDiv, '验证成功！内测功能已解锁', 'success');
                        setTimeout(() => {
                            // 刷新界面显示已验证状态
                            if (element.parentElement) {
                                this.initVerificationDock({ element: element.parentElement });
                            }
                        }, 1500);
                    } else {
                        this.showMessage(messageDiv, '内测码无效，请检查后重试', 'error');
                    }
                } catch (error) {
                    console.error('DocumentStyler: 验证内测码时出错:', error);
                    this.showMessage(messageDiv, '验证过程中发生错误，请重试', 'error');
                } finally {
                    verifyButton.disabled = false;
                    verifyButton.textContent = '验证';
                }
            });

            // 支持回车键验证
            codeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    verifyButton.click();
                }
            });
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.closeVerificationDock();
            });
        }

        // 绑定关闭按钮（已验证状态）
        const closeButton = element.querySelector('#close-verification-dock') as HTMLButtonElement;
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.closeVerificationDock();
            });
        }
    }

    /**
     * 显示消息
     */
    private showMessage(messageDiv: HTMLDivElement, message: string, type: 'success' | 'error'): void {
        if (!messageDiv) return;

        messageDiv.innerHTML = `
            <div style="color: ${type === 'success' ? 'var(--b3-theme-primary)' : 'var(--b3-theme-error)'};">
                ${message}
            </div>
        `;
        messageDiv.style.display = 'block';
    }

    /**
     * 关闭验证dock
     */
    private closeVerificationDock(): void {
        // 通过思源API关闭dock
        if (this.pluginInstance && typeof this.pluginInstance.removeDock === 'function') {
            this.pluginInstance.removeDock("beta-verification-dock");
        }
    }

    /**
     * 销毁验证dock
     */
    private destroyVerificationDock(): void {
        // 清理资源
        console.log('DocumentStyler: 内测验证dock已销毁');
    }
}