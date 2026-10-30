import sys,collections
src=open(sys.argv[1]+'/okumura.py').read().split('tot=ok=0')[0]
exec(src)
res=collections.Counter(); rows=[]
for f in ['CITIES.DAT','CARMEN.DAT']:
    r=load(f)
    for rid,b in sorted(r.items()):
        if len(b)>6 and b[4]==0 and b[5] in (0xb3,0xb4):
            h=b[0]|b[1]<<8; w=b[2]|b[3]<<8; wb=(w+1)//2; orig=b[6:]
            data,_=lzss(orig,h*wb)
            if b[5]==0xb4:
                cols=data; rowd=bytes(cols[x*h+y] for y in range(h) for x in range(wb))
            else:
                rowd=data; cols=bytes(rowd[y*wb+x] for x in range(wb) for y in range(h))
            lr=len(encode(rowd)); lc=len(encode(cols))
            chosen='cols' if b[5]==0xb4 else 'rows'
            smaller='rows' if lr<lc else 'cols' if lc<lr else 'tie'
            res[(f,chosen,smaller)]+=1
            if smaller!=chosen: rows.append((f,rid,chosen,lr,lc,w,h))
for k,v in sorted(res.items()): print(k,v)
for x in rows: print(x)
