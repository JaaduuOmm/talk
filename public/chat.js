<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cloudflare AI — Markdown Editor</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css" rel="stylesheet" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <style>
    body {
      background: #e0e0e0;
      font-family: Inter, sans-serif;
      color: #222;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px;
      margin: 0;
    }
    .app {
      width: 1000px;
      max-width: 95%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 24px;
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.18));
      box-shadow: 18px 18px 34px rgba(0,0,0,0.14), -12px -12px 34px rgba(255,255,255,0.9);
      backdrop-filter: blur(6px) saturate(120%);
    }
    .panel {
      padding: 16px;
      border-radius: 16px;
      background: linear-gradient(180deg, #e6e6e6, rgba(255,255,255,0.6));
      box-shadow: 8px 8px 18px rgba(0,0,0,0.06), -6px -6px 12px rgba(255,255,255,0.8);
      overflow: auto;
    }
    .editor-area {
      background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(250,250,250,0.6));
      border-radius: 12px;
      padding: 12px;
      min-height: 400px;
      box-shadow: inset 6px 6px 16px rgba(0,0,0,0.03), inset -6px -6px 16px rgba(255,255,255,0.7);
    }
    .doc {
      outline: none;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, monospace;
      min-height: 380px;
      color: #222;
    }
    .floating-action {
      position: absolute;
      display: none;
      z-index: 40;
      transform: translate(-50%, -120%);
      background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(250,250,250,0.8));
      padding: 8px 10px;
      border-radius: 12px;
      box-shadow: 6px 6px 16px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.9);
    }
    .btn {
      background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(245,245,245,0.6));
      border: none;
      padding: 8px 12px;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 4px 4px 10px rgba(0,0,0,0.06), -3px -3px 8px rgba(255,255,255,0.8);
    }
    .btn:active {
      transform: translateY(2px);
      box-shadow: inset 4px 4px 10px rgba(0,0,0,0.06), inset -3px -3px 8px rgba(255,255,255,0.8);
    }
  </style>
</head>
<body>
  <div class="app">
    <section class="panel editor">
      <div class="editor-area">
        <div id="doc" class="doc" contenteditable="true"># Start writing here...</div>
      </div>
    </section>
    <section class="panel preview">
      <div id="preview"></div>
    </section>
    <div id="floatingAction" class="floating-action">
      <span>AI write</span>
      <button class="btn" id="aiWriteBtn">✦</button>
    </div>
  </div>

  <div id="modalBackdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);align-items:center;justify-content:center;">
    <div style="background:white;padding:16px;border-radius:10px;width:400px;">
      <h3>AI — Edit Selected Text</h3>
      <textarea id="aiPrompt" style="width:100%;height:120px;"></textarea>
      <div style="text-align:right;margin-top:10px;">
        <button class="btn" id="modalCancel">Cancel</button>
        <button class="btn" id="modalGenerate">Generate</button>
      </div>
    </div>
  </div>

  <script>
    const doc=document.getElementById('doc'),preview=document.getElementById('preview'),floatingAction=document.getElementById('floatingAction'),aiWriteBtn=document.getElementById('aiWriteBtn'),modal=document.getElementById('modalBackdrop'),aiPrompt=document.getElementById('aiPrompt'),modalGenerate=document.getElementById('modalGenerate'),modalCancel=document.getElementById('modalCancel');
    let currentSelectionRange=null;
    function renderPreview(){preview.innerHTML=marked.parse(doc.innerText);Prism.highlightAllUnder(preview);}
    renderPreview();
    doc.addEventListener('input',renderPreview);
    function showFloatingAtRange(r){const b=r.getBoundingClientRect();floatingAction.style.left=(b.left+b.width/2)+'px';floatingAction.style.top=b.top+'px';floatingAction.style.display='flex';}
    function clearFloating(){floatingAction.style.display='none';currentSelectionRange=null;}
    function selectionHandler(){setTimeout(()=>{const s=window.getSelection();if(!s||!s.rangeCount){clearFloating();return;}const r=s.getRangeAt(0);if(s.toString().trim()&&doc.contains(r.commonAncestorContainer)){currentSelectionRange=r.cloneRange();showFloatingAtRange(r);}else{clearFloating();}},10);}
    doc.addEventListener('mouseup',selectionHandler);
    doc.addEventListener('keyup',selectionHandler);
    aiWriteBtn.addEventListener('click',()=>{modal.style.display='flex';aiPrompt.focus();});
    modalCancel.addEventListener('click',()=>{modal.style.display='none';});
    modalGenerate.addEventListener('click',async()=>{
      const instruction=aiPrompt.value.trim();
      if(!currentSelectionRange){alert('No text selected');return;}
      const selectedText=currentSelectionRange.toString();
      modalGenerate.textContent='Generating…';
      try{
        const resp=await fetch('/api/chat',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            messages:[
              {role:'system',content:'You are a markdown writing assistant.'},
              {role:'user',content:`Instruction: ${instruction}\nSelected text: ${selectedText}`}
            ]
          })
        });
        const data=await resp.json();
        const aiOutput=data.response||data.output||data.choices?.[0]?.message?.content||'';
        if(!aiOutput){alert('AI returned empty output.');}
        else{
          currentSelectionRange.deleteContents();
          currentSelectionRange.insertNode(document.createTextNode(aiOutput));
          renderPreview();
        }
      }catch(e){alert('Error contacting AI: '+e.message);}
      finally{modalGenerate.textContent='Generate';modal.style.display='none';}
    });
  </script>

  <!-- Load chat.js at the very end -->
  <script src="chat.js"></script>
</body>
</html>
