(function () {
	'use strict';
	let libraries = []; let currentLibUuid = ''; let currentDevice = null; let editedProps = {}; let hasChanges = false; let stopSearch = false; let lastSearchKw = ''; let deleteCount = 0; let modifyCount = 0;
	let STD_KEYS = ['name', 'designator', 'manufacturer', 'manufacturerId', 'supplier', 'supplierId', 'net', 'addIntoBom', 'addIntoPcb'];
	let CN_MAP = { '名称': 'name', '位号': 'designator', '制造商': 'manufacturer', '制造商编号': 'manufacturerId', '供应商': 'supplier', '供应商编号': 'supplierId', '网络': 'net', '加入BOM': 'addIntoBom', '转到PCB': 'addIntoPcb', '数据手册': 'Datasheet', '封装': 'Footprint', '符号': 'Symbol', '3D模型': '3D Model', '描述': 'Description' };
	function toast(msg, type, dur) {
		try { eda.sys_Message.showToastMessage(msg, type || 'info', dur || 3, false); }
		catch (e) {}
	}
	let $libSelect = document.getElementById('libSelect'); let $searchInput = document.getElementById('searchInput'); let $btnSearch = document.getElementById('btnSearch'); let $btnStopSearch = document.getElementById('btnStopSearch'); let $searchCount = document.getElementById('searchCount'); let $resultList = document.getElementById('resultList'); let $deviceName = document.getElementById('deviceName'); let $matchInfo = document.getElementById('matchInfo'); let $attrTable = document.getElementById('attrTable'); let $attrBody = document.getElementById('attrBody'); let $attrPlaceholder = document.getElementById('attrPlaceholder'); let $addPropRow = document.getElementById('addPropRow'); let $newPropKey = document.getElementById('newPropKey'); let $newPropVal = document.getElementById('newPropVal'); let $btnAddProp = document.getElementById('btnAddProp'); let $btnDeleteDevice = document.getElementById('btnDeleteDevice'); let $btnReset = document.getElementById('btnReset'); let $btnSave = document.getElementById('btnSave');
	function syncTheme() {
		try {
			let pt = window.parent.document.documentElement.getAttribute('data-theme'); if (pt === 'dark')
				document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
		}
		catch (e) {}
	}syncTheme();

	async function loadLibraries() {
		try {
			let allLibs = await eda.lib_LibrariesList.getAllLibrariesList(); libraries = []; if (allLibs) {
				for (let i = 0; i < allLibs.length; i++)libraries.push({ name: allLibs[i].name, uuid: allLibs[i].uuid });
			} $libSelect.innerHTML = ''; if (libraries.length === 0) { $libSelect.innerHTML = '<option value="">无可用库</option>'; return; } for (let j = 0; j < libraries.length; j++) { let opt = document.createElement('option'); opt.value = libraries[j].uuid; opt.textContent = libraries[j].name; $libSelect.appendChild(opt); }currentLibUuid = libraries[0].uuid; let saved = eda.sys_Storage.getExtensionUserConfig('_libAttr_lastLibUuid'); if (saved) { for (let x = 0; x < libraries.length; x++) { if (libraries[x].uuid === saved) { currentLibUuid = saved; $libSelect.value = saved; break; } } }
		}
		catch (e) { $libSelect.innerHTML = '<option value="">加载失败</option>'; }
	}
	loadLibraries(); $libSelect.addEventListener('change', function () { currentLibUuid = this.value; eda.sys_Storage.setExtensionUserConfig('_libAttr_lastLibUuid', currentLibUuid); });

	async function doSearch() {
		let kw = $searchInput.value.trim(); if (!kw)
			return; if (!currentLibUuid) { toast('请先选择库', 'warn'); return; }stopSearch = false; lastSearchKw = kw; $btnSearch.style.display = 'none'; $btnStopSearch.style.display = ''; $resultList.textContent = ''; let statusEl = document.createElement('div'); statusEl.className = 'result-empty search-status'; statusEl.textContent = '搜索中... 已搜索 0 个器件'; $resultList.appendChild(statusEl); $searchCount.textContent = ''; currentDevice = null; $deviceName.textContent = ''; $matchInfo.textContent = ''; deleteCount = 0; modifyCount = 0; $attrPlaceholder.style.display = ''; $attrTable.style.display = 'none'; $addPropRow.style.display = 'none'; $btnDeleteDevice.style.display = 'none'; $btnSave.disabled = true; try {
			let kwLower = kw.toLowerCase(); let matchCount = 0; let checkedTotal = 0; let seen = {}; let page = 1; let pageSize = 100; let maxPages = 1000; while (page <= maxPages && !stopSearch) {
				let results = await eda.lib_Device.search('', currentLibUuid, undefined, undefined, pageSize, page); if (!results || results.length === 0)
					break; for (let i = 0; i < results.length && !stopSearch; i++) {
					let item = results[i]; if (seen[item.uuid])
						continue; seen[item.uuid] = true; checkedTotal++; let matchReason = ''; if (item.name && item.name.toLowerCase().includes(kwLower)) { matchReason = '名称'; }
					else {
						try {
							let dev = await eda.lib_Device.get(item.uuid, currentLibUuid); if (!dev || !dev.property)
								continue; let found = false; let sp = ['name', 'designator', 'manufacturer', 'manufacturerId', 'supplier', 'supplierId', 'net']; for (let s = 0; s < sp.length && !found; s++) { let ek = sp[s]; let cnLabel = ''; for (let ck in CN_MAP) { if (CN_MAP[ck] === ek) { cnLabel = ck; break; } } if (ek.toLowerCase().includes(kwLower) || cnLabel.toLowerCase().includes(kwLower) || (CN_MAP[kw] && CN_MAP[kw] === ek)) { matchReason = cnLabel || ek; found = true; break; } let pv = dev.property[sp[s]]; if (pv != null && String(pv).toLowerCase().includes(kwLower)) { matchReason = `${cnLabel || ek}=${pv}`; found = true; break; } } if (!found) {
								let op = dev.property.otherProperty || {}; for (let k in op) {
									if (!op.hasOwnProperty(k))
										continue; if (k.toLowerCase().includes(kwLower) || (CN_MAP[kw] && CN_MAP[kw] === k)) { matchReason = k; found = true; break; } let ov = op[k]; if (ov != null && String(ov).toLowerCase().includes(kwLower)) { matchReason = `${k}=${ov}`; found = true; break; }
								}
							} if (!found)
								continue;
						}
						catch (e) { continue; }
					} if (matchCount === 0) { while ($resultList.firstChild)$resultList.removeChild($resultList.firstChild); statusEl = document.createElement('div'); statusEl.className = 'result-empty search-status'; $resultList.appendChild(statusEl); }matchCount++; let div = document.createElement('div'); div.className = 'result-item'; div.dataset.uuid = item.uuid; div.dataset.kw = kw; let spName = document.createElement('span'); spName.textContent = item.name; div.appendChild(spName); let spHint = document.createElement('span'); spHint.className = 'match-hint'; spHint.textContent = matchReason; div.appendChild(spHint); div.addEventListener('click', function () { selectDevice(this.dataset.uuid, this.dataset.kw); }); $resultList.appendChild(div); if (matchCount % 5 === 0)
						$resultList.scrollTop = $resultList.scrollHeight; if (checkedTotal % 10 === 0)
						statusEl.textContent = `搜索中... 已搜索 ${checkedTotal} 个器件, 找到 ${matchCount} 个`;
				}statusEl.textContent = `搜索中... 已搜索 ${checkedTotal} 个器件, 找到 ${matchCount} 个`; $resultList.scrollTop = $resultList.scrollHeight; page++;
			} if (stopSearch) { statusEl.textContent = `已停止 (找到 ${matchCount} 个)`; }
			else if (page > maxPages) { statusEl.textContent = `已搜索 ${checkedTotal} 个器件(达上限), 找到 ${matchCount} 个，建议缩小搜索范围`; }
			else { statusEl.remove(); }
		}
		catch (e) { $resultList.innerHTML = `<div class="result-empty">搜索失败: ${e.message || ''}</div>`; }
		finally { $btnSearch.style.display = ''; $btnStopSearch.style.display = 'none'; stopSearch = false; }
	}
	$btnSearch.addEventListener('click', doSearch); $btnStopSearch.addEventListener('click', () => { stopSearch = true; }); $searchInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter')
			doSearch();
	});

	async function selectDevice(uuid, kw) {
		let items = $resultList.querySelectorAll('.result-item'); for (let i = 0; i < items.length; i++)items[i].classList.toggle('selected', items[i].dataset.uuid === uuid); try { currentDevice = await eda.lib_Device.get(uuid, currentLibUuid); if (!currentDevice) { toast('获取器件详情失败', 'error'); return; }deleteCount = 0; modifyCount = 0; renderAttributes(kw || lastSearchKw); }
		catch (e) { toast(`获取器件详情失败: ${e.message || ''}`, 'error'); }
	}

	function renderAttributes(highlightKw) {
		if (!currentDevice)
			return; $deviceName.textContent = currentDevice.name || ''; $matchInfo.textContent = ''; $attrPlaceholder.style.display = 'none'; $attrTable.style.display = ''; $addPropRow.style.display = ''; $btnDeleteDevice.style.display = ''; hasChanges = false; deleteCount = 0; modifyCount = 0; $btnSave.disabled = true; let prop = currentDevice.property || {}; editedProps = {}; let sfs = [{ key: 'name', label: '名称', readOnly: true }, { key: 'designator', label: '位号' }, { key: 'manufacturer', label: '制造商' }, { key: 'manufacturerId', label: '制造商编号' }, { key: 'supplier', label: '供应商' }, { key: 'supplierId', label: '供应商编号' }, { key: 'net', label: '网络' }]; let bfs = [{ key: 'addIntoBom', label: '加入BOM' }, { key: 'addIntoPcb', label: '转到PCB' }]; for (let s = 0; s < sfs.length; s++) { let f = sfs[s]; editedProps[f.key] = { value: prop[f.key] || '', type: 'text', label: f.label, _original: prop[f.key] || '', readOnly: !!f.readOnly }; } for (let b = 0; b < bfs.length; b++) { let bf = bfs[b]; editedProps[bf.key] = { value: prop[bf.key] !== false, type: 'bool', label: bf.label, _original: prop[bf.key] !== false }; } let other = prop.otherProperty || {}; for (let k in other) {
			if (other.hasOwnProperty(k) && other[k] != null)
				editedProps[k] = { value: other[k], type: 'custom', label: k, _original: other[k], canDelete: true };
		}buildTable(highlightKw);
	}

	function buildTable(highlightKw) {
		$attrBody.innerHTML = ''; let hk = highlightKw ? highlightKw.toLowerCase() : ''; let engHk = (CN_MAP[highlightKw] || '').toLowerCase(); let matched = []; if (hk) {
			for (let key in editedProps) {
				let e = editedProps[key]; if (e._deleted)
					continue; if (key.toLowerCase().includes(hk) || (engHk && key.toLowerCase().includes(engHk)) || (e.type !== 'bool' && e.value != null && String(e.value).toLowerCase().includes(hk)))
					matched.push(key);
			} if (matched.length > 0)
				$matchInfo.textContent = `匹配: ${matched.join(', ')}`;
		} let first = null; for (let k2 in editedProps) {
			let e2 = editedProps[k2]; if (e2._deleted)
				continue; let tr = document.createElement('tr'); if (matched.includes(k2)) {
				tr.classList.add('highlight'); if (!first)
					first = tr;
			} let tn = document.createElement('td'); tn.className = 'attr-name'; tn.textContent = e2.label; tr.appendChild(tn); let tv = document.createElement('td'); tv.className = 'attr-value'; if (e2.type === 'bool') { let lb = document.createElement('label'); lb.className = 'attr-check'; let cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!e2.value; cb.dataset.key = k2; cb.addEventListener('change', function () { editedProps[this.dataset.key].value = this.checked; onPropChange(this.dataset.key); }); lb.appendChild(cb); tv.appendChild(lb); }
			else {
				let inp = document.createElement('input'); inp.type = 'text'; inp.className = 'erc-input'; inp.style.width = '100%'; inp.value = e2.value != null ? String(e2.value) : ''; inp.dataset.key = k2; if (e2.readOnly)
					inp.disabled = true; inp.addEventListener('input', function () { editedProps[this.dataset.key].value = this.value; onPropChange(this.dataset.key); }); tv.appendChild(inp);
			}tr.appendChild(tv); let ta = document.createElement('td'); ta.className = 'attr-action'; if (e2.canDelete && !e2.readOnly) { let db = document.createElement('button'); db.className = 'del-btn'; db.textContent = '✕'; db.title = '删除此属性'; db.addEventListener('click', (function (k) { return function () { deleteProp(k); }; })(k2)); ta.appendChild(db); }tr.appendChild(ta); $attrBody.appendChild(tr);
		} if (first)
			setTimeout(() => { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 100);
	}

	function onPropChange(key) {
		let e = editedProps[key]; if (!e || e._deleted || (e._original == null && (e.value === '' || e.value == null)))
			return; if (e.value === e._original)
			return; hasChanges = true; modifyCount++; $btnSave.disabled = false;
	}
	function markChanged() { hasChanges = true; $btnSave.disabled = false; }
	function deleteProp(key) {
		editedProps[key]._deleted = true; deleteCount++; let el = $attrBody.querySelector(`[data-key="${key}"]`); if (el) {
			let tr = el.closest('tr'); if (tr)
				tr.remove();
		}hasChanges = true; $btnSave.disabled = false;
	}

	$btnAddProp.addEventListener('click', () => {
		let key = $newPropKey.value.trim(); let val = $newPropVal.value.trim(); if (!key)
			return; editedProps[key] = { value: val, type: 'custom', label: key, _original: undefined, _added: true, canDelete: true }; let tr = document.createElement('tr'); let tn = document.createElement('td'); tn.className = 'attr-name'; tn.textContent = key; let tv = document.createElement('td'); tv.className = 'attr-value'; let inp = document.createElement('input'); inp.type = 'text'; inp.className = 'erc-input'; inp.style.width = '100%'; inp.value = val; inp.dataset.key = key; inp.addEventListener('input', function () { editedProps[key].value = this.value; onPropChange(key); }); tv.appendChild(inp); let ta = document.createElement('td'); ta.className = 'attr-action'; let db = document.createElement('button'); db.className = 'del-btn'; db.textContent = '✕'; db.addEventListener('click', () => { deleteProp(key); }); ta.appendChild(db); tr.appendChild(tn); tr.appendChild(tv); tr.appendChild(ta); $attrBody.appendChild(tr); $newPropKey.value = ''; $newPropVal.value = ''; hasChanges = true; $btnSave.disabled = false;
	});
	$btnReset.addEventListener('click', () => { if (currentDevice) { deleteCount = 0; modifyCount = 0; renderAttributes(lastSearchKw); } });

	$btnSave.addEventListener('click', () => {
		if (!currentDevice || !hasChanges)
			return; eda.sys_Dialog.showConfirmationMessage('是否确定保存修改？', '确认保存', '保存', '取消', async (ok) => {
			if (!ok)
				return; await doSave();
		});
	});
	async function doSave() {
		$btnSave.disabled = true; $btnSave.textContent = '保存中...'; let property = {}; let otherProperty = {}; let hasProp = false; for (let key in editedProps) {
			let e = editedProps[key]; if (e._deleted) { otherProperty[key] = undefined; continue; } let cv = e.value; let ov = e._original; if (!e._added && cv === ov)
				continue; if (STD_KEYS.includes(key)) { property[key] = cv; hasProp = true; }
			else {
				if (cv === '' || cv == null)
					otherProperty[key] = undefined; else otherProperty[key] = cv;
			}
		} if (Object.keys(otherProperty).length > 0) { property.otherProperty = otherProperty; hasProp = true; } if (!hasProp) { toast('没有需要保存的更改', 'info'); $btnSave.disabled = false; $btnSave.textContent = '保存'; return; } try {
			let lu = currentDevice.libraryUuid || currentLibUuid; let ok = await eda.lib_Device.modify(currentDevice.uuid, lu, undefined, undefined, undefined, undefined, property); if (ok) {
				toast('保存成功', 'info', 3); hasChanges = false; deleteCount = 0; modifyCount = 0; $btnSave.disabled = true; $btnSave.textContent = '保存'; currentDevice = await eda.lib_Device.get(currentDevice.uuid, lu); if (currentDevice)
					renderAttributes(lastSearchKw);
			}
			else { toast('保存失败，请重试', 'error', 5); $btnSave.disabled = false; $btnSave.textContent = '保存'; }
		}
		catch (e) { toast(`保存出错: ${e.message || ''}`, 'error', 5); $btnSave.disabled = false; $btnSave.textContent = '保存'; }
	}

	$btnDeleteDevice.addEventListener('click', () => {
		if (!currentDevice)
			return; eda.sys_Dialog.showConfirmationMessage(`确定删除器件"${currentDevice.name}"？不可撤销。`, '确认删除', '确定删除', '取消', async (ok) => {
			if (!ok)
				return; await doDeleteDevice();
		});
	});
	async function doDeleteDevice() {
		try {
			let ok = await eda.lib_Device.delete(currentDevice.uuid, currentLibUuid); if (ok) { toast('删除成功', 'info', 3); currentDevice = null; $deviceName.textContent = ''; $matchInfo.textContent = ''; $attrPlaceholder.style.display = ''; $attrTable.style.display = 'none'; $addPropRow.style.display = 'none'; $btnDeleteDevice.style.display = 'none'; $btnSave.disabled = true; hasChanges = false; deleteCount = 0; modifyCount = 0; }
			else { toast('删除失败', 'error', 5); }
		}
		catch (e) { toast(`删除出错: ${e.message || ''}`, 'error', 5); }
	}
})();
