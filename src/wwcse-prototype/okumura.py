import sys; sys.path.insert(0,sys.argv[1]); from res import *
N=1024; F=66; TH=2; NIL=N

def encode(src):
    tb=bytearray(N+F-1); lson=[NIL]*(N+1); rson=[NIL]*(N+257); dad=[NIL]*(N+1)
    st={'mp':0,'ml':0}
    def insert(r):
        cmp=1; p=N+1+tb[r]; rson[r]=lson[r]=NIL; st['ml']=0
        while True:
            if cmp>=0:
                if rson[p]!=NIL: p=rson[p]
                else: rson[p]=r; dad[r]=p; return
            else:
                if lson[p]!=NIL: p=lson[p]
                else: lson[p]=r; dad[r]=p; return
            i=1
            while i<F:
                cmp=tb[r+i]-tb[p+i]
                if cmp!=0: break
                i+=1
            if i>st['ml']:
                st['mp']=p; st['ml']=i
                if i>=F: break
        dad[r]=dad[p]; lson[r]=lson[p]; rson[r]=rson[p]
        dad[lson[p]]=r; dad[rson[p]]=r
        if rson[dad[p]]==p: rson[dad[p]]=r
        else: lson[dad[p]]=r
        dad[p]=NIL
    def delete(p):
        if dad[p]==NIL: return
        if rson[p]==NIL: q=lson[p]
        elif lson[p]==NIL: q=rson[p]
        else:
            q=lson[p]
            if rson[q]!=NIL:
                while rson[q]!=NIL: q=rson[q]
                rson[dad[q]]=lson[q]; dad[lson[q]]=dad[q]
                lson[q]=lson[p]; dad[lson[p]]=q
            rson[q]=rson[p]; dad[rson[p]]=q
        dad[q]=dad[p]
        if rson[dad[p]]==p: rson[dad[p]]=q
        else: lson[dad[p]]=q
        dad[p]=NIL
    out=bytearray(); code=bytearray([0]); mask=1
    s=0; r=N-F; pos=0
    ln=0
    while ln<F and pos<len(src): tb[r+ln]=src[pos]; pos+=1; ln+=1
    if ln==0: return b''
    for i in range(1,F+1): insert(r-i)
    insert(r)
    while ln>0:
        if st['ml']>ln: st['ml']=ln
        if st['ml']<=TH:
            st['ml']=1; code[0]|=mask; code.append(tb[r])
        else:
            v=((st['ml']-3)<<10)|st['mp']; code+=bytes([v>>8,v&0xff])
        mask<<=1
        if mask==256: out+=code; code=bytearray([0]); mask=1
        last=st['ml']; i=0
        while i<last and pos<len(src):
            c=src[pos]; pos+=1
            delete(s); tb[s]=c
            if s<F-1: tb[s+N]=c
            s=(s+1)&(N-1); r=(r+1)&(N-1); insert(r); i+=1
        while i<last:
            i+=1; delete(s); s=(s+1)&(N-1); r=(r+1)&(N-1); ln-=1
            if ln: insert(r)
    if len(code)>1: out+=code
    return bytes(out)

tot=ok=0; fails=[]
for f in ['CITIES.DAT','CARMEN.DAT']:
    r=load(f)
    for rid,b in sorted(r.items()):
        if len(b)>6 and b[4]==0 and b[5] in (0xb3,0xb4):
            h=b[0]|b[1]<<8; w=b[2]|b[3]<<8; orig=b[6:]
            data,_=lzss(orig,h*w//2)
            # column-major images: encoder input is the stream order, which lzss() returns as-is
            tot+=1
            e=encode(data)
            if e==orig: ok+=1
            else: fails.append((f,rid,len(e),len(orig)))
print(f'{ok}/{tot} images byte-identical'); print(fails[:10])
