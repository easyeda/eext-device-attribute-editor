(function () {
	'use strict';
	let libraries = []; let currentLibUuid = ''; let stopSearch = false; let allMatches = [];
	let STD_KEYS = ['name', 'designator', 'manufacturer', 'manufacturerId', 'supplier', 'supplierId', 'net', 'addIntoBom', 'addIntoPcb'];
	let CN_MAP = { '名称': 'name', '位号': 'designator', '制造商': 'manufacturer', '制造商编号': 'manufacturerId', '供应商': 'supplier', '供应商编号': 'supplierId', '网络': 'net', '加入BOM': 'addIntoBom', '转到PCB': 'addIntoPcb', '数据手册': 'Datasheet', '封装': 'Footprint', '符号': 'Symbol', '3D模型': '3D Model', '描述': 'Description', '价格': 'Price', '品牌': 'Brand', '分类': 'Category' };

	function toast(m, t, d) {
		try { eda.sys_Message.showToastMessage(m, t || 'info', d || 3, false); }
		catch (e) {}
	}
	let $libSelect = document.getElementById('libSelect'); let $attrKeys = document.getElementById('attrKeys'); let $btnSearch = document.getElementById('btnSearch'); let $btnStop = document.getElementById('btnStop'); let $resultInfo = document.getElementById('resultInfo'); let $selectedInfo = document.getElementById('selectedInfo'); let $tableWrap = document.getElementById('tableWrap'); let $tableStatus = document.getElementById('tableStatus'); let $btable = document.getElementById('btable'); let $btbody = document.getElementById('btbody'); let $placeholder = document.getElementById('placeholder'); let $selectAll = document.getElementById('selectAll'); let $newVal = document.getElementById('newVal'); let $btnModify = document.getElementById('btnModify'); let $btnDelete = document.getElementById('btnDelete');
	function syncTheme() {
		try {
			let pt = window.parent.document.documentElement.getAttribute('data-theme'); if (pt === 'dark')
				document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
		}
		catch (e) {}
	}syncTheme();

	async function loadLibs() {
		try {
			let libs = await eda.lib_LibrariesList.getAllLibrariesList(); libraries = []; if (libs) {
				for (let i = 0; i < libs.length; i++)libraries.push({ name: libs[i].name, uuid: libs[i].uuid });
			} $libSelect.innerHTML = ''; if (libraries.length === 0) { $libSelect.innerHTML = '<option value="">无可用库</option>'; return; } for (let j = 0; j < libraries.length; j++) { let o = document.createElement('option'); o.value = libraries[j].uuid; o.textContent = libraries[j].name; $libSelect.appendChild(o); }currentLibUuid = libraries[0].uuid; let saved = eda.sys_Storage.getExtensionUserConfig('_libAttr_lastLibUuid'); if (saved) { for (let x = 0; x < libraries.length; x++) { if (libraries[x].uuid === saved) { currentLibUuid = saved; $libSelect.value = saved; break; } } }
		}
		catch (e) { $libSelect.innerHTML = '<option value="">加载失败</option>'; }
	}
	loadLibs(); $libSelect.addEventListener('change', function () { currentLibUuid = this.value; eda.sys_Storage.setExtensionUserConfig('_libAttr_lastLibUuid', currentLibUuid); });

	function resolveKeys(queries) { return queries.map((q) => { return CN_MAP[q] || q; }); }

	async function doSearch() {
		let raw = $attrKeys.value.trim(); if (!raw || !currentLibUuid)
			return;
		let queries = raw.split(',').map((s) => { return s.trim(); }).filter(Boolean);
		if (queries.length === 0)
			return;
		let engQueries = resolveKeys(queries);
		stopSearch = false; allMatches = [];
		$btnSearch.style.display = 'none'; $btnStop.style.display = ''; $selectAll.checked = false; $btbody.innerHTML = ''; $btable.style.display = 'none'; $placeholder.style.display = 'none'; $tableStatus.style.display = 'block'; $tableStatus.textContent = '搜索中...'; $resultInfo.textContent = ''; $selectedInfo.textContent = '';
		try {
			let page = 1; let pageSize = 100; let maxPages = 1000; let checkedTotal = 0;
			while (page <= maxPages && !stopSearch) {
				let results = await eda.lib_Device.search('', currentLibUuid, undefined, undefined, pageSize, page);
				if (!results || results.length === 0)
					break;
				for (let i = 0; i < results.length && !stopSearch; i++) {
					let item = results[i]; checkedTotal++;
					try {
						let dev = await eda.lib_Device.get(item.uuid, currentLibUuid); if (!dev || !dev.property)
							continue;
						for (let q = 0; q < engQueries.length; q++) {
							let qk = engQueries[q];
							for (let s = 0; s < STD_KEYS.length; s++) {
								if (STD_KEYS[s] === 'name')
									continue; if (STD_KEYS[s] === qk) { let sv = dev.property[STD_KEYS[s]]; appendMatch(item.uuid, item.name, currentLibUuid, qk, qk, sv != null ? String(sv) : ''); }
							}
							let op = dev.property.otherProperty || {}; if (op.hasOwnProperty(qk) && op[qk] != null)
								appendMatch(item.uuid, item.name, currentLibUuid, qk, qk, String(op[qk]));
						}
					}
					catch (e) {}
					$tableStatus.textContent = `搜索中... 已查 ${checkedTotal} 个器件, 找到 ${allMatches.length} 条`;
				}
				page++;
			}
			if (stopSearch)
				$tableStatus.textContent = `已停止 (找到 ${allMatches.length} 条)`;
			else if (page > maxPages)
				$tableStatus.textContent = `已搜索 ${checkedTotal} 个器件(达上限), 找到 ${allMatches.length} 条，建议缩小搜索范围`;
			else $tableStatus.style.display = 'none';
			$resultInfo.textContent = `${allMatches.length} 条属性, ${new Set(allMatches.map((m) => { return m.deviceUuid; })).size} 个器件`;
			if (allMatches.length === 0) { $placeholder.style.display = ''; $placeholder.textContent = '无匹配属性'; $btable.style.display = 'none'; $tableStatus.style.display = 'none'; }
		}
		catch (e) { $placeholder.style.display = ''; $placeholder.textContent = `搜索失败: ${e.message || ''}`; $tableStatus.style.display = 'none'; }
		finally { $btnSearch.style.display = ''; $btnStop.style.display = 'none'; stopSearch = false; }
	}
	$btnSearch.addEventListener('click', doSearch); $btnStop.addEventListener('click', () => { stopSearch = true; }); $attrKeys.addEventListener('keydown', (e) => {
		if (e.key === 'Enter')
			doSearch();
	});

	function appendMatch(duid, dname, luid, key, label, val) {
		let id = `${duid}|${key}`;
		for (let i = 0; i < allMatches.length; i++) {
			if (allMatches[i]._id === id)
				return;
		}
		allMatches.push({ deviceUuid: duid, deviceName: dname, libUuid: luid, key, label, value: val, _id: id });
		if (allMatches.length === 1) { $btable.style.display = ''; $placeholder.style.display = 'none'; }
		let m = allMatches[allMatches.length - 1]; let tr = document.createElement('tr'); tr.dataset.id = m._id;
		let ts = document.createElement('td'); ts.className = 'b-sel'; let cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.id = m._id; cb.addEventListener('change', updateSelected); ts.appendChild(cb); tr.appendChild(ts);
		let td = document.createElement('td'); td.className = 'b-dev'; td.textContent = m.deviceName; tr.appendChild(td);
		let tk = document.createElement('td'); tk.className = 'b-key'; tk.textContent = m.label; tr.appendChild(tk);
		let tv = document.createElement('td'); tv.textContent = m.value; tr.appendChild(tv);
		$btbody.appendChild(tr); $tableWrap.scrollTop = $tableWrap.scrollHeight;
	}
	$selectAll.addEventListener('change', function () { let cbs = $btbody.querySelectorAll('input[type="checkbox"]'); for (let i = 0; i < cbs.length; i++)cbs[i].checked = this.checked; updateSelected(); });
	function updateSelected() { let cbs = $btbody.querySelectorAll('input[type="checkbox"]:checked'); $selectedInfo.textContent = `已选 ${cbs.length} 条`; }

	function showProgress(text) { $tableStatus.style.display = 'block'; $tableStatus.textContent = text; }

	$btnModify.addEventListener('click', () => {
		let v = $newVal.value.trim(); if (v === '') { toast('请输入目标值', 'warn'); return; }
		let cbs = $btbody.querySelectorAll('input[type="checkbox"]:checked'); if (cbs.length === 0) { toast('请勾选属性', 'warn'); return; }
		let items = []; let attrLabels = {}; for (let i = 0; i < cbs.length; i++) { let cid = cbs[i].dataset.id; items.push(cid); for (let j = 0; j < allMatches.length; j++) { if (allMatches[j]._id === cid) { attrLabels[allMatches[j].label] = true; break; } } }
		let attrNames = Object.keys(attrLabels).join(', ');
		eda.sys_Dialog.showConfirmationMessage(`批量修改 ${items.length} 条 ${attrNames} 属性的值 为 "${v}"？`, '批量修改', '修改', '取消', async (ok) => {
			if (!ok)
				return;
			$btnModify.disabled = true; $btnDelete.disabled = true;
			let byDevice = {}; for (let i = 0; i < items.length; i++) {
				let id = items[i]; let m = null; for (let j = 0; j < allMatches.length; j++) { if (allMatches[j]._id === id) { m = allMatches[j]; break; } } if (!m)
					continue; if (!byDevice[m.deviceUuid])
					byDevice[m.deviceUuid] = { libUuid: m.libUuid, keys: {} }; byDevice[m.deviceUuid].keys[m.key] = { newVal: v };
			}
			let devUids = Object.keys(byDevice); let total = devUids.length; let ok2 = 0; let fail = 0;
			showProgress(`修改中 0/${total} ...`);
			for (let di = 0; di < total; di++) {
				let duid = devUids[di]; let d = byDevice[duid]; let p = {}; let op2 = {}; for (let k in d.keys) { op2[k] = d.keys[k].newVal; }p.otherProperty = op2; try {
					let r = await eda.lib_Device.modify(duid, d.libUuid, undefined, undefined, undefined, undefined, p); if (r)
						ok2++; else fail++;
				}
				catch (e) { fail++; }showProgress(`修改中 ${di + 1}/${total} ...`);
			}
			showProgress(`修改完成: ${ok2} 成功, ${fail} 失败`); setTimeout(() => { $tableStatus.style.display = 'none'; }, 3000);
			toast(`修改完成: ${ok2} 成功, ${fail} 失败`, fail > 0 ? 'warn' : 'info', 4);
			$btnModify.disabled = false; $btnDelete.disabled = false;
			if (ok2 > 0) { allMatches = []; $selectAll.checked = false; $btbody.innerHTML = ''; $btable.style.display = 'none'; $placeholder.style.display = ''; $placeholder.textContent = '修改完成，请重新搜索'; $resultInfo.textContent = ''; $selectedInfo.textContent = ''; $newVal.value = ''; }
		});
	});

	$btnDelete.addEventListener('click', () => {
		let cbs = $btbody.querySelectorAll('input[type="checkbox"]:checked'); if (cbs.length === 0) { toast('请勾选属性', 'warn'); return; }
		let items = []; let attrLabels = {}; for (let i = 0; i < cbs.length; i++) { let cid = cbs[i].dataset.id; items.push(cid); for (let j = 0; j < allMatches.length; j++) { if (allMatches[j]._id === cid) { attrLabels[allMatches[j].label] = true; break; } } }
		let attrNames = Object.keys(attrLabels).join(', ');
		eda.sys_Dialog.showConfirmationMessage(`批量删除 ${items.length} 条 "${attrNames}" 属性？`, '批量删除', '删除', '取消', async (ok) => {
			if (!ok)
				return;
			$btnModify.disabled = true; $btnDelete.disabled = true;
			let byDevice = {}; for (let i = 0; i < items.length; i++) {
				let id = items[i]; let m = null; for (let j = 0; j < allMatches.length; j++) { if (allMatches[j]._id === id) { m = allMatches[j]; break; } } if (!m)
					continue; if (!byDevice[m.deviceUuid])
					byDevice[m.deviceUuid] = { libUuid: m.libUuid, keys: {} }; byDevice[m.deviceUuid].keys[m.key] = { action: 'delete' };
			}
			let devUids = Object.keys(byDevice); let total = devUids.length; let ok2 = 0; let fail = 0;
			showProgress(`删除中 0/${total} ...`);
			for (let di = 0; di < total; di++) {
				let duid = devUids[di]; let d = byDevice[duid]; let p = {}; let op2 = {}; for (let k in d.keys) { op2[k] = undefined; }p.otherProperty = op2; try {
					let r = await eda.lib_Device.modify(duid, d.libUuid, undefined, undefined, undefined, undefined, p); if (r)
						ok2++; else fail++;
				}
				catch (e) { fail++; }showProgress(`删除中 ${di + 1}/${total} ...`);
			}
			showProgress(`删除完成: ${ok2} 成功, ${fail} 失败`); setTimeout(() => { $tableStatus.style.display = 'none'; }, 3000);
			toast(`删除完成: ${ok2} 成功, ${fail} 失败`, fail > 0 ? 'warn' : 'info', 4);
			$btnModify.disabled = false; $btnDelete.disabled = false;
			if (ok2 > 0) { allMatches = []; $selectAll.checked = false; $btbody.innerHTML = ''; $btable.style.display = 'none'; $placeholder.style.display = ''; $placeholder.textContent = '删除完成，请重新搜索'; $resultInfo.textContent = ''; $selectedInfo.textContent = ''; }
		});
	});
})();
