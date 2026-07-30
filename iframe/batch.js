(function(){"use strict";
var libraries=[],currentLibUuid="",stopSearch=false,allMatches=[];
var STD_KEYS=["name","designator","manufacturer","manufacturerId","supplier","supplierId","net","addIntoBom","addIntoPcb"];
var CN_MAP={"名称":"name","位号":"designator","制造商":"manufacturer","制造商编号":"manufacturerId","供应商":"supplier","供应商编号":"supplierId","网络":"net","加入BOM":"addIntoBom","转到PCB":"addIntoPcb","数据手册":"Datasheet","封装":"Footprint","符号":"Symbol","3D模型":"3D Model","描述":"Description","价格":"Price","品牌":"Brand","分类":"Category"};

function toast(m,t,d){try{eda.sys_Message.showToastMessage(m,t||"info",d||3,false)}catch(e){}}
var $libSelect=document.getElementById("libSelect"),$attrKeys=document.getElementById("attrKeys"),$btnSearch=document.getElementById("btnSearch"),$btnStop=document.getElementById("btnStop"),$resultInfo=document.getElementById("resultInfo"),$selectedInfo=document.getElementById("selectedInfo"),$tableWrap=document.getElementById("tableWrap"),$tableStatus=document.getElementById("tableStatus"),$btable=document.getElementById("btable"),$btbody=document.getElementById("btbody"),$placeholder=document.getElementById("placeholder"),$selectAll=document.getElementById("selectAll"),$newVal=document.getElementById("newVal"),$btnModify=document.getElementById("btnModify"),$btnDelete=document.getElementById("btnDelete");
function syncTheme(){try{var pt=window.parent.document.documentElement.getAttribute("data-theme");if(pt==="dark")document.documentElement.setAttribute("data-theme","dark");else document.documentElement.removeAttribute("data-theme")}catch(e){}}syncTheme();

async function loadLibs(){try{var libs=await eda.lib_LibrariesList.getAllLibrariesList();libraries=[];if(libs)for(var i=0;i<libs.length;i++)libraries.push({name:libs[i].name,uuid:libs[i].uuid});$libSelect.innerHTML="";if(libraries.length===0){$libSelect.innerHTML='<option value="">无可用库</option>';return}for(var j=0;j<libraries.length;j++){var o=document.createElement("option");o.value=libraries[j].uuid;o.textContent=libraries[j].name;$libSelect.appendChild(o)}currentLibUuid=libraries[0].uuid;var saved=eda.sys_Storage.getExtensionUserConfig("_libAttr_lastLibUuid");if(saved){for(var x=0;x<libraries.length;x++){if(libraries[x].uuid===saved){currentLibUuid=saved;$libSelect.value=saved;break}}}}catch(e){$libSelect.innerHTML='<option value="">加载失败</option>'}}
loadLibs();$libSelect.addEventListener("change",function(){currentLibUuid=this.value;eda.sys_Storage.setExtensionUserConfig("_libAttr_lastLibUuid",currentLibUuid)});

function resolveKeys(queries){return queries.map(function(q){return CN_MAP[q]||q})}

async function doSearch(){
var raw=$attrKeys.value.trim();if(!raw||!currentLibUuid)return;
var queries=raw.split(",").map(function(s){return s.trim()}).filter(Boolean);
if(queries.length===0)return;
var engQueries=resolveKeys(queries);
stopSearch=false;allMatches=[];
$btnSearch.style.display="none";$btnStop.style.display="";$selectAll.checked=false;$btbody.innerHTML="";$btable.style.display="none";$placeholder.style.display="none";$tableStatus.style.display="block";$tableStatus.textContent="搜索中...";$resultInfo.textContent="";$selectedInfo.textContent="";
try{
var page=1,pageSize=100,maxPages=1000,checkedTotal=0;
while(page<=maxPages&&!stopSearch){
var results=await eda.lib_Device.search("",currentLibUuid,undefined,undefined,pageSize,page);
if(!results||results.length===0)break;
for(var i=0;i<results.length&&!stopSearch;i++){var item=results[i];checkedTotal++;
try{var dev=await eda.lib_Device.get(item.uuid,currentLibUuid);if(!dev||!dev.property)continue;
for(var q=0;q<engQueries.length;q++){var qk=engQueries[q];
for(var s=0;s<STD_KEYS.length;s++){if(STD_KEYS[s]==="name")continue;if(STD_KEYS[s]===qk){var sv=dev.property[STD_KEYS[s]];appendMatch(item.uuid,item.name,currentLibUuid,qk,qk,sv!=null?String(sv):"")}}
var op=dev.property.otherProperty||{};if(op.hasOwnProperty(qk)&&op[qk]!=null)appendMatch(item.uuid,item.name,currentLibUuid,qk,qk,String(op[qk]));
}}catch(e){}
$tableStatus.textContent="搜索中... 已查 "+checkedTotal+" 个器件, 找到 "+allMatches.length+" 条"}
page++}
if(stopSearch)$tableStatus.textContent="已停止 (找到 "+allMatches.length+" 条)";
else if(page>maxPages)$tableStatus.textContent="已搜索 "+checkedTotal+" 个器件(达上限), 找到 "+allMatches.length+" 条，建议缩小搜索范围";
else $tableStatus.style.display="none";
$resultInfo.textContent=allMatches.length+" 条属性, "+new Set(allMatches.map(function(m){return m.deviceUuid})).size+" 个器件";
if(allMatches.length===0){$placeholder.style.display="";$placeholder.textContent="无匹配属性";$btable.style.display="none";$tableStatus.style.display="none"}
}catch(e){$placeholder.style.display="";$placeholder.textContent="搜索失败: "+(e.message||"");$tableStatus.style.display="none"}
finally{$btnSearch.style.display="";$btnStop.style.display="none";stopSearch=false}
}
$btnSearch.addEventListener("click",doSearch);$btnStop.addEventListener("click",function(){stopSearch=true});$attrKeys.addEventListener("keydown",function(e){if(e.key==="Enter")doSearch()});

function appendMatch(duid,dname,luid,key,label,val){
var id=duid+"|"+key;
for(var i=0;i<allMatches.length;i++){if(allMatches[i]._id===id)return}
allMatches.push({deviceUuid:duid,deviceName:dname,libUuid:luid,key:key,label:label,value:val,_id:id});
if(allMatches.length===1){$btable.style.display="";$placeholder.style.display="none"}
var m=allMatches[allMatches.length-1],tr=document.createElement("tr");tr.dataset.id=m._id;
var ts=document.createElement("td");ts.className="b-sel";var cb=document.createElement("input");cb.type="checkbox";cb.dataset.id=m._id;cb.addEventListener("change",updateSelected);ts.appendChild(cb);tr.appendChild(ts);
var td=document.createElement("td");td.className="b-dev";td.textContent=m.deviceName;tr.appendChild(td);
var tk=document.createElement("td");tk.className="b-key";tk.textContent=m.label;tr.appendChild(tk);
var tv=document.createElement("td");tv.textContent=m.value;tr.appendChild(tv);
$btbody.appendChild(tr);$tableWrap.scrollTop=$tableWrap.scrollHeight;
}
$selectAll.addEventListener("change",function(){var cbs=$btbody.querySelectorAll('input[type="checkbox"]');for(var i=0;i<cbs.length;i++)cbs[i].checked=this.checked;updateSelected()});
function updateSelected(){var cbs=$btbody.querySelectorAll('input[type="checkbox"]:checked');$selectedInfo.textContent="已选 "+cbs.length+" 条"}

function showProgress(text){$tableStatus.style.display="block";$tableStatus.textContent=text}

$btnModify.addEventListener("click",function(){
var v=$newVal.value.trim();if(v===""){toast("请输入目标值","warn");return}
var cbs=$btbody.querySelectorAll('input[type="checkbox"]:checked');if(cbs.length===0){toast("请勾选属性","warn");return}
var items=[];var attrLabels={};for(var i=0;i<cbs.length;i++){var cid=cbs[i].dataset.id;items.push(cid);for(var j=0;j<allMatches.length;j++){if(allMatches[j]._id===cid){attrLabels[allMatches[j].label]=true;break}}}
var attrNames=Object.keys(attrLabels).join(", ");
eda.sys_Dialog.showConfirmationMessage("批量修改 "+items.length+" 条 "+attrNames+" 属性的值 为 \""+v+"\"？","批量修改","修改","取消",async function(ok){if(!ok)return;
$btnModify.disabled=true;$btnDelete.disabled=true;
var byDevice={};for(var i=0;i<items.length;i++){var id=items[i],m=null;for(var j=0;j<allMatches.length;j++){if(allMatches[j]._id===id){m=allMatches[j];break}}if(!m)continue;if(!byDevice[m.deviceUuid])byDevice[m.deviceUuid]={libUuid:m.libUuid,keys:{}};byDevice[m.deviceUuid].keys[m.key]={newVal:v}}
var devUids=Object.keys(byDevice),total=devUids.length,ok2=0,fail=0;
showProgress("修改中 0/"+total+" ...");
for(var di=0;di<total;di++){var duid=devUids[di],d=byDevice[duid],p={},op2={};for(var k in d.keys){op2[k]=d.keys[k].newVal}p.otherProperty=op2;try{var r=await eda.lib_Device.modify(duid,d.libUuid,undefined,undefined,undefined,undefined,p);if(r)ok2++;else fail++}catch(e){fail++}showProgress("修改中 "+(di+1)+"/"+total+" ...")}
showProgress("修改完成: "+ok2+" 成功, "+fail+" 失败");setTimeout(function(){$tableStatus.style.display="none"},3000);
toast("修改完成: "+ok2+" 成功, "+fail+" 失败",fail>0?"warn":"info",4);
$btnModify.disabled=false;$btnDelete.disabled=false;
if(ok2>0){allMatches=[];$selectAll.checked=false;$btbody.innerHTML="";$btable.style.display="none";$placeholder.style.display="";$placeholder.textContent="修改完成，请重新搜索";$resultInfo.textContent="";$selectedInfo.textContent="";$newVal.value=""}
})});

$btnDelete.addEventListener("click",function(){
var cbs=$btbody.querySelectorAll('input[type="checkbox"]:checked');if(cbs.length===0){toast("请勾选属性","warn");return}
var items=[];var attrLabels={};for(var i=0;i<cbs.length;i++){var cid=cbs[i].dataset.id;items.push(cid);for(var j=0;j<allMatches.length;j++){if(allMatches[j]._id===cid){attrLabels[allMatches[j].label]=true;break}}}
var attrNames=Object.keys(attrLabels).join(", ");
eda.sys_Dialog.showConfirmationMessage("批量删除 "+items.length+" 条 \""+attrNames+"\" 属性？","批量删除","删除","取消",async function(ok){if(!ok)return;
$btnModify.disabled=true;$btnDelete.disabled=true;
var byDevice={};for(var i=0;i<items.length;i++){var id=items[i],m=null;for(var j=0;j<allMatches.length;j++){if(allMatches[j]._id===id){m=allMatches[j];break}}if(!m)continue;if(!byDevice[m.deviceUuid])byDevice[m.deviceUuid]={libUuid:m.libUuid,keys:{}};byDevice[m.deviceUuid].keys[m.key]={action:"delete"}}
var devUids=Object.keys(byDevice),total=devUids.length,ok2=0,fail=0;
showProgress("删除中 0/"+total+" ...");
for(var di=0;di<total;di++){var duid=devUids[di],d=byDevice[duid],p={},op2={};for(var k in d.keys){op2[k]=undefined}p.otherProperty=op2;try{var r=await eda.lib_Device.modify(duid,d.libUuid,undefined,undefined,undefined,undefined,p);if(r)ok2++;else fail++}catch(e){fail++}showProgress("删除中 "+(di+1)+"/"+total+" ...")}
showProgress("删除完成: "+ok2+" 成功, "+fail+" 失败");setTimeout(function(){$tableStatus.style.display="none"},3000);
toast("删除完成: "+ok2+" 成功, "+fail+" 失败",fail>0?"warn":"info",4);
$btnModify.disabled=false;$btnDelete.disabled=false;
if(ok2>0){allMatches=[];$selectAll.checked=false;$btbody.innerHTML="";$btable.style.display="none";$placeholder.style.display="";$placeholder.textContent="删除完成，请重新搜索";$resultInfo.textContent="";$selectedInfo.textContent=""}
})});
})();
