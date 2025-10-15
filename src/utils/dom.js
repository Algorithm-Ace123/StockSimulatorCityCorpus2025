export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function mountView(View) {
  const shell = document.querySelector('app-shell');
  if (!shell) return;
  shell.mount(View); // defers to app-shell's mount
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of (Array.isArray(children) ? children : [children])) {
    node.append(c?.nodeType ? c : document.createTextNode(String(c ?? '')));
  }
  return node;
}
