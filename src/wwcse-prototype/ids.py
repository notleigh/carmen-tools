import sys,struct
for f in sys.argv[1:]:
    d=open(f,'rb').read(); off,sz=struct.unpack('<IH',d[:6]); n=struct.unpack('<H',d[off:off+2])[0]
    ents=[struct.unpack('<HIH',d[off+2+8*i:off+10+8*i]) for i in range(n)]
    ids=[e[0] for e in ents]
    print(f.split('/')[-1], n, 'min',min(ids),'max',max(ids),'sorted',ids==sorted(ids))
    if 'CITIES' in f:
        hs=[e[2] for e in ents if e[0]>=10000 and e[0]%100==0]
        print(' header sizes max',max(hs))
