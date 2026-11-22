const unitPrice=n=>Math.ceil(Number(n)),unitCash=n=>'HK$ '+unitPrice(n).toLocaleString('en-HK',{maximumFractionDigits:0});
import {quoteSnapshot} from './app.js';
import {packageSnapshot} from './package-app.js';
const root=document.getElementById('company-view');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=n=>'HK$ '+(n/100).toLocaleString('en-HK',{minimumFractionDigits:2,maximumFractionDigits:2});
const cents=n=>Math.round((n+Number.EPSILON)*100);
let rows=[];
const field=(id,label,value='',type='text')=>`<label>${label}<input id="cq-${id}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''}></label>`;
const select=(id,label,options)=>`<label>${label}<select id="cq-${id}">${options.map(o=>`<option>${o}</option>`).join('')}</select></label>`;
root.innerHTML=`<div class="cq-controls"><h1>公司報價單</h1><p>匯入現有工程／套餐，或新增供料。匯入為當刻價格副本，之後不會跟隨計價頁變動。重新整理會清除本頁資料，離開前請列印保存。</p><div class="cq-grid">${field('company','公司名稱','新榮耀工程有限公司')}${field('contact','公司電話／電郵')}${field('address','公司地址')}${field('number','報價單編號')}${field('date','報價日期',new Date().toLocaleDateString('en-CA'),'date')}${field('valid','有效期至','','date')}${field('client','客戶名稱')}${field('phone','客戶電話')}${field('site','工程地址')}</div><div class="cq-actions"><button type="button" id="cq-import">加入工程報價明細</button><button type="button" id="cq-package">加入套餐明細</button><button type="button" id="cq-add">新增工程／供料</button></div><p>供料方式只作明細標示，不會自動改價；材料價請自行輸入。原有「連工包料」已含嘅材料請勿重複收費。</p><div class="cq-scroll"><table><thead><tr><th>項目／材料規格</th><th>供料方式</th><th>單位</th><th>數量</th><th>單價 HK$</th><th>小計</th><th>操作</th></tr></thead><tbody id="cq-rows"></tbody></table></div><div class="cq-grid">${select('discountType','優惠方式',['無優惠','折扣百分比（輸入10即減10%）','扣減固定金額'])}${field('discount','優惠數值','0','number')}${field('offer','優惠名稱／備註')}${select('depositType','首訂方式',['固定金額','百分比（按優惠後總額）'])}${field('deposit','首訂數值','0','number')}</div><label>付款安排／工程條款<textarea id="cq-terms" rows="4" placeholder="自行輸入首訂、進度款、尾款及其他條款"></textarea></label><p id="cq-error" role="alert"></p><div id="cq-summary" aria-live="polite"></div><div class="cq-actions"><button type="button" id="cq-preview">更新報價單預覽</button><button type="button" id="cq-print">列印／另存 PDF</button></div><p>PDF 透過瀏覽器列印視窗另存；報價單不顯示內部風險、利潤等設定。套餐匯入的15%加價會獨立列出，可自行修改名稱。</p></div><article id="cq-paper"></article>`;
const $=id=>document.getElementById('cq-'+id);
function render(){
 $('rows').innerHTML=rows.map((r,i)=>`<tr data-i="${i}"><td><input aria-label="項目名稱" data-k="name" value="${esc(r.name)}"><input aria-label="規格備註" data-k="note" value="${esc(r.note)}" placeholder="材料品牌／規格／備註"></td><td><select aria-label="供料方式" data-k="supply">${[...new Set([r.supply,'連工包料','淨安裝／客戶供料','只供料','另計材料費','按套餐範圍','不適用'])].map(s=>`<option ${s===r.supply?'selected':''}>${esc(s)}</option>`).join('')}</select></td><td><input aria-label="單位" data-k="unit" value="${esc(r.unit)}"></td><td><input aria-label="數量" type="number" min="0" step="any" data-k="qty" value="${esc(r.qty)}"></td><td><input aria-label="單價" type="number" min="0" step="1" data-k="price" value="${esc(r.price)}"></td><td data-sub></td><td><button type="button" data-del="${i}">移除</button></td></tr>`).join(''); update();
}
function totals(){
 if(rows.some(r=>!r.name.trim()||r.qty===''||r.price===''||!Number.isFinite(+r.qty)||!Number.isFinite(+r.price)||+r.qty<0||+r.price<0))throw Error('請填寫項目名稱及有效的非負數量、單價。');
 const base=rows.reduce((s,r)=>s+cents(+r.qty*unitPrice(r.price)),0);
 const d=$('discount').valueAsNumber,p=$('deposit').valueAsNumber;
 if(!Number.isFinite(d)||!Number.isFinite(p)||d<0||p<0)throw Error('優惠及首訂必須為有效非負數。');
 const kind=$('discountType').selectedIndex,pk=$('depositType').selectedIndex;
 if(kind===1&&d>100||pk===1&&p>100)throw Error('百分比不可超過100%。');
 const discount=kind===0?0:kind===1?Math.round(base*d/100):cents(d);
 if(discount>base)throw Error('優惠不可超過項目小計。');
 const net=base-discount,deposit=pk===1?Math.round(net*p/100):cents(p);
 if(deposit>net)throw Error('首訂不可超過優惠後總額。');
 if(!Number.isSafeInteger(base)||!Number.isSafeInteger(net)||!Number.isSafeInteger(deposit))throw Error('金額過大，請核對。');
 return {base,discount,net,deposit,balance:net-deposit};
}
function update(){
 try{
 const t=totals();$('error').textContent='';
 rows.forEach((r,i)=>$('rows').children[i].querySelector('[data-sub]').textContent=cash(cents(+r.qty*unitPrice(r.price))));
 const summary=`<dl><dt>項目小計</dt><dd>${cash(t.base)}</dd><dt>優惠扣減</dt><dd>− ${cash(t.discount)}</dd><dt>報價總額</dt><dd>${cash(t.net)}</dd><dt>首訂</dt><dd>${cash(t.deposit)}</dd><dt>餘款</dt><dd>${cash(t.balance)}</dd></dl>`;
 $('summary').innerHTML=summary;
 const val=id=>esc($(id).value);
 $('paper').innerHTML=`<header class="cq-letterhead"><img src="company-logo.jpeg" alt="公司Logo"><div><h2>${val('company')}</h2><p>${val('contact')}<br>${val('address')}</p></div><h2>報價單</h2></header><div class="cq-meta"><p>編號：${val('number')}<br>日期：${val('date')}<br>有效期至：${val('valid')}</p><p>客戶：${val('client')}<br>電話：${val('phone')}<br>工程地址：${val('site')}</p></div><table><thead><tr><th>項目／規格</th><th>供料方式</th><th>數量</th><th>單價</th><th>金額</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}<small>${esc(r.note)}</small></td><td>${esc(r.supply)}</td><td>${esc(r.qty)} ${esc(r.unit)}</td><td>${unitCash(r.price)}</td><td>${cash(cents(+r.qty*unitPrice(r.price)))}</td></tr>`).join('')}</tbody></table><p>${val('offer')}</p>${summary}<h3>付款安排／條款</h3><p class="cq-pre">${val('terms')}</p><div class="cq-sign"><p>公司簽署：________________</p><p>客戶確認：________________<br><br>日期：________________</p></div>`;
 $('print').disabled=!rows.length;$('paper').hidden=!rows.length;
 }catch(e){$('error').textContent=e.message;$('summary').textContent='請核對資料';$('print').disabled=true;$('paper').hidden=true;}
}
$('rows').addEventListener('input',e=>{const k=e.target.dataset.k;if(k){rows[+e.target.closest('tr').dataset.i][k]=e.target.value;update();}});
$('rows').addEventListener('change',e=>{if(e.target.dataset.k==='price'&&e.target.value!==''&&Number.isFinite(e.target.valueAsNumber)&&e.target.valueAsNumber>=0){const r=rows[+e.target.closest('tr').dataset.i];r.price=unitPrice(e.target.value);e.target.value=r.price;update();}});
$('rows').addEventListener('click',e=>{const b=e.target.closest('[data-del]');if(b){rows.splice(+b.dataset.del,1);render();}});
root.querySelector('.cq-controls').addEventListener('input',e=>{if(!e.target.closest('#cq-rows'))update();});
function load(fn){try{const incoming=fn();if(!incoming.length)throw Error('未有可匯入項目。');rows.push(...incoming.map(r=>({...r,price:unitPrice(r.price)})));render();}catch(e){$('error').textContent=e.message;}}
$('import').onclick=()=>load(quoteSnapshot);$('package').onclick=()=>load(packageSnapshot);
$('add').onclick=()=>{rows.push({name:'',unit:'項',qty:1,price:0,supply:'只供料',note:''});render();};
$('preview').onclick=()=>{update();if(!$('paper').hidden)$('paper').scrollIntoView({behavior:'smooth'});};
$('print').onclick=()=>{update();if(!$('print').disabled){document.body.classList.add('cq-printing');window.print();}};
window.addEventListener('afterprint',()=>document.body.classList.remove('cq-printing'));
render();
