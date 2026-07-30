/**
 * 库属性编辑 — 搜索库中器件并编辑其扩展属性
 */
import extensionConfig from '../extension.json' with { type: 'json' };

const EDITOR_IFRAME = '__lib_attr_editor__';
const BATCH_IFRAME = '__lib_attr_batch__';

// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {}

export function openPanel(): void {
	void eda.sys_IFrame.openIFrame('iframe/index.html', 500, 540, EDITOR_IFRAME, {
		title: '库属性编辑', maximizeButton: true, minimizeButton: true, minimizeStyle: 'constricted',
	});
}

export function openBatchPanel(): void {
	void eda.sys_IFrame.openIFrame('iframe/batch.html', 500, 480, BATCH_IFRAME, {
		title: '批量操作库属性', maximizeButton: true, minimizeButton: true, minimizeStyle: 'constricted',
	});
}

export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		eda.sys_I18n.text('EasyEDA extension SDK v', undefined, undefined, extensionConfig.version),
		eda.sys_I18n.text('About'),
	);
}
