import sys,runpy
sys.argv=[sys.argv[0],sys.argv[1]]
src=open(sys.argv[1]+'/okumura.py').read().split('tot=ok=0')[0]
exec(src)
res={}
for f in ['CITIES.DAT','CARMEN.DAT']:
    r=load(f)
    for rid,b in sorted(r.items()):
        if len(b)>6 and b[4]==0 and b[5] in (0xb3,0xb4):
            h=b[0]|b[1]<<8; w=b[2]|b[3]<<8; orig=b[6:]
            n=h*((w+1)//2)
            data,used=lzss(orig,n)
            res[(f,rid)]=(encode(data)==orig, w%2, used==len(orig), len(data)==n)
import collections
print(collections.Counter((f,)+v for (f,_),v in res.items()))
print([k for k,v in res.items() if not v[0]])
