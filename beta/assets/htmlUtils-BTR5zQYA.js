function h(o){const t=new DOMParser().parseFromString(o,"text/html");["script","style","noscript","iframe","object","embed","head"].forEach(r=>{t.querySelectorAll(r).forEach(n=>n.remove())}),["p","div","br","h1","h2","h3","h4","h5","h6","li","tr","blockquote"].forEach(r=>{t.querySelectorAll(r).forEach(n=>{n.insertAdjacentText("afterend",`
`)})});let e=t.body.textContent||"";return e=e.replace(/\n{3,}/g,`

`),e=e.replace(/[ \t]+/g," "),e.trim()}export{h as extractTextFromHtml};
