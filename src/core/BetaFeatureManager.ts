/**
 * 内测功能管理器
 * 负责管理内测功能的验证和状态管理
 */

import { Dialog } from "siyuan";
import { IBetaFeatureManager, IBetaFeatureSettings } from "../types";
import { SettingsManager } from "./SettingsManager";

// 预设的内测码列表
const BETA_CODES: string[] = [
    "6z2ebok"
];

export class BetaFeatureManager implements IBetaFeatureManager {
    private settingsManager: SettingsManager;
    private currentDialog: Dialog | null = null;

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
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
        const isValidCode = BETA_CODES.includes(code.trim().toLowerCase());
        
        if (isValidCode) {
            const settings = this.settingsManager.getSettings();
            const betaSettings = settings.betaFeatures || {
                isVerified: false,
                verifiedCodes: [],
                verifiedAt: undefined
            };

            // 如果已经验证过该内测码，直接返回true
            if (betaSettings.verifiedCodes.includes(code.trim().toLowerCase())) {
                return true;
            }

            // 更新内测设置
            const updatedBetaSettings: IBetaFeatureSettings = {
                isVerified: true,
                verifiedCodes: [...betaSettings.verifiedCodes, code.trim().toLowerCase()],
                verifiedAt: Date.now()
            };

            await this.settingsManager.updateSettings({
                betaFeatures: updatedBetaSettings
            });


            return true;
        }


        return false;
    }

    /**
     * 打开内测验证界面
     */
    openVerificationDialog(): void {
        // 如果已有对话框打开，先关闭
        if (this.currentDialog) {
            this.currentDialog.destroy();
            this.currentDialog = null;
        }

        const isAlreadyVerified = this.isBetaVerified();
        
        this.currentDialog = new Dialog({
            title: "🚀 加入内测，获取更多功能",
            content: this.generateDialogContent(isAlreadyVerified),
            width: "450px",
            destroyCallback: () => {
                this.currentDialog = null;
            }
        });

        if (!isAlreadyVerified) {
            this.bindDialogEvents();
        } else {
            this.bindVerifiedDialogEvents();
        }
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
     * 生成对话框内容
     */
    private generateDialogContent(isAlreadyVerified: boolean): string {
        return `
            <div class="b3-dialog__content" style="padding: 20px;">
                ${isAlreadyVerified ? this.generateVerifiedHTML() : this.generateUnverifiedHTML()}
            </div>
            <div class="b3-dialog__action">
                ${isAlreadyVerified ? 
                    '<button class="b3-button b3-button--text" id="close-beta-dialog">关闭</button>' :
                    '<button class="b3-button b3-button--cancel" id="cancel-beta-verification">取消</button><div class="fn__space"></div><button class="b3-button b3-button--text" id="verify-beta-code">验证</button>'
                }
            </div>
        `;
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
                    您已成功加入内测，可以使用所有内测功能！
                </p>
            </div>
        `;
    }

    /**
     * 生成未验证状态的HTML
     */
    private generateUnverifiedHTML(): string {
        return `
            <div class="verification-form">
                <p style="color: var(--b3-theme-on-surface-light); margin-bottom: 20px;">
                    请输入内测码以解锁专属功能和提前体验新特性。
                </p>
                
                <div class="fn__flex config__item">
                    <input class="b3-text-field fn__flex-center" 
                           id="beta-code-input" 
                           placeholder="请输入内测码" 
                           style="width: 100%;">
                </div>
                
                <div id="verification-message" style="margin-top: 16px; text-align: center; display: none;">
                    <!-- 验证结果消息 -->
                </div>
            </div>
        `;
    }

    /**
     * 绑定未验证状态的对话框事件
     */
    private bindDialogEvents(): void {
        if (!this.currentDialog) return;

        const codeInput = this.currentDialog.element.querySelector('#beta-code-input') as HTMLInputElement;
        const verifyButton = this.currentDialog.element.querySelector('#verify-beta-code') as HTMLButtonElement;
        const cancelButton = this.currentDialog.element.querySelector('#cancel-beta-verification') as HTMLButtonElement;
        const messageDiv = this.currentDialog.element.querySelector('#verification-message') as HTMLDivElement;

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
                            // 关闭对话框并重新打开显示已验证状态
                            if (this.currentDialog) {
                                this.currentDialog.destroy();
                                this.currentDialog = null;
                                this.openVerificationDialog();
                            }
                        }, 500);
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
                if (this.currentDialog) {
                    this.currentDialog.destroy();
                    this.currentDialog = null;
                }
            });
        }
    }

    /**
     * 绑定已验证状态的对话框事件
     */
    private bindVerifiedDialogEvents(): void {
        if (!this.currentDialog) return;

        const closeButton = this.currentDialog.element.querySelector('#close-beta-dialog') as HTMLButtonElement;
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                if (this.currentDialog) {
                    this.currentDialog.destroy();
                    this.currentDialog = null;
                }
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


}