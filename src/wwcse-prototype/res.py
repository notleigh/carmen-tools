import struct
def load(f):
    d=open(f,'rb').read()
    off,size=struct.unpack_from('<IH',d,0)
    n,=struct.unpack_from('<H',d,off)
    r={}
    for i in range(n):
        id_,o,s=struct.unpack_from('<HIH',d,off+2+8*i)
        r[id_]=d[o+1:o+1+s]
    return r
def codes(data,width=9,lsb=True):
    out=[];acc=0;nb=0
    for b in data:
        if lsb: acc|=b<<nb
        else: acc=(acc<<8)|b
        nb+=8
        while nb>=width:
            if lsb: out.append(acc&((1<<width)-1)); acc>>=width
            else: out.append((acc>>(nb-width))&((1<<width)-1))
            nb-=width
    return out
def lzss(src, outlen):
    ring=bytearray(1024); w=1024-0x42; out=bytearray(); i=0; flags=0
    while len(out)<outlen and i<len(src):
        flags>>=1
        if flags & 0xff00 == 0:
            flags = src[i] | 0xff00; i+=1
        if flags & 1:
            c=src[i]; i+=1; out.append(c); ring[w]=c; w=(w+1)%1024
        else:
            b1,b2=src[i],src[i+1]; i+=2
            pos=((b1<<8)|b2)&0x3ff; n=(b1>>2)+3
            for _ in range(n):
                c=ring[pos]; pos=(pos+1)%1024
                out.append(c); ring[w]=c; w=(w+1)%1024
                if len(out)>=outlen: break
    return bytes(out), i
TABLE=open(__import__('os').path.join(__import__('os').path.dirname(__file__),'table.bin'),'rb').read() if __import__('os').path.exists(__import__('os').path.join(__import__('os').path.dirname(__file__),'table.bin')) else b''
def text(b):
    n=b[0]|b[1]<<8; s=b[2:]; longbits=(s[0]>>6)+5; pos=2; out=bytearray()
    def rd(k):
        nonlocal pos; v=0
        for _ in range(k):
            v=(v<<1)|((s[pos>>3]>>(7-(pos&7)))&1); pos+=1
        return v
    while len(out)<n:
        v=rd(4)
        if v==0:
            v=rd(longbits)
            out.append(v if longbits==8 else TABLE[v])
        else: out.append(TABLE[v])
    return bytes(out)
