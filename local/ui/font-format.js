import {validFont,fontStack,applyRunFont,uniformFont} from '/editor-fonts.js';
export function applySelectedFont(edit,range,id){
 if(!validFont(id)||!range||range.collapsed||!edit?.contains(range.commonAncestorContainer))return false;
 const span=document.createElement('span'),fragment=range.extractContents();
 fragment.querySelectorAll('[style],[data-font]').forEach(n=>{n.style.fontFamily='';delete n.dataset.font});applyRunFont(span,id);span.append(fragment);range.insertNode(span);
 range.selectNodeContents(span);const s=getSelection();s.removeAllRanges();s.addRange(range);return true;
}
export function syncFontSelect(select,runs,fallback='default'){const id=uniformFont(runs,fallback);select.value=id;select.style.fontFamily=id==='mixed'?'':fontStack(id)}
export function prepareFontSelect(select,onRemember){select.classList.add('editor-font-select');const mixed=document.createElement('option');mixed.value='mixed';mixed.textContent='混合字体';mixed.disabled=true;select.append(mixed);select.addEventListener('pointerdown',onRemember);select.addEventListener('keydown',onRemember);select.title='选中文字时修改选区，否则修改当前文本框或组件文字。'}
