import sys,collections; sys.path.insert(0,sys.argv[1]); from res import *
INDEX={c:i for i,c in reversed(list(enumerate(TABLE)))}
def enc(data, w):
    bits=[(w-5)>>1&1,(w-5)&1]
    def put(v,k): bits.extend((v>>(k-1-j))&1 for j in range(k))
    for c in data:
        i=INDEX[c] if c in INDEX else None
        if w==8 and (i is None or i>=16):
            put(0,4); put(c,8)
        elif i is not None and 1<=i<16: put(i,4)
        else: put(0,4); put(i,w)
    while len(bits)%8: bits.append(0)
    return bytes([len(data)&255,len(data)>>8])+bytes(int(''.join(map(str,bits[k:k+8])),2) for k in range(0,len(bits),8))
stats=collections.Counter(); bad=[]
for f in ['CITIES.DAT','CARMEN.DAT']:
    r=load(f)
    for rid,b in sorted(r.items()):
        if len(b)<3: continue
        try: t=text(b)
        except Exception: continue
        if len(t)!=(b[0]|b[1]<<8) or not t.endswith(b'\0'): continue
        if not all(32<=c<127 or c in (0,0x81,0x82,10,13,9) or c<16 for c in t): continue
        w=(b[2]>>6)+5
        maxidx=max((INDEX.get(c,999) for c in t), default=0)
        minw=max(5,(maxidx).bit_length()) if maxidx<256 else 8
        e=enc(t,w)
        stats[(f, e==b, w==minw)]+=1
        if e!=b: bad.append((f,rid))
print(stats); print(bad[:10])
