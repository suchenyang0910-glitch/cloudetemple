# 图片以 base64 文本保存（buddha.b64.txt、bdepth.b64.txt），目录里的 buddha.jpg、bdepth.png 传输时被重新编码过，不要用。
# 读写都固定用 LF 换行，这样在 Windows 和 Linux 上构建结果逐字节相同。
s=open("template.html",encoding="utf-8",newline="").read()
t=s.replace("__BUDDHA__","data:image/jpeg;base64,"+open("buddha.b64.txt").read().strip()).replace("__BDEPTH__","data:image/png;base64,"+open("bdepth.b64.txt").read().strip())
imp="window.__threeReady=import('__THREE_URL__');\ntry{THREE=await window.__threeReady;}catch(e){"; assert t.count(imp)==1
def loader(urls): return "window.__threeReady=(async()=>{for(const u of %s){try{return await import(u)}catch(e){}}throw new Error('three not loaded')})();\ntry{THREE=await window.__threeReady;}catch(e){"%urls
open("test.html","w",encoding="utf-8",newline="\n").write("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"+t.replace(imp,loader("['./three.bundle.min.js']")))
open("index.html","w",encoding="utf-8",newline="\n").write(t.replace(imp,loader("['https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.min.js','https://unpkg.com/three@0.187.0/build/three.module.min.js','https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js']")))
print("built",len(t))
open("standalone.html","w",encoding="utf-8",newline="\n").write("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1,viewport-fit=cover'><body style='margin:0'>"+t.replace(imp,loader("['./three.bundle.min.js','https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.min.js']")))
