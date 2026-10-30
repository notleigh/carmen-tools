import sys,struct
d=open(sys.argv[1],'rb').read()
hdr=struct.unpack('<14H',d[:28])
hp=hdr[4]*16
cs,ip=hdr[11],hdr[10]
img=d[hp:]
eh=cs*16
rip,rcs,ms,esz,rsp,rss,dlen,skip=struct.unpack('<8H',img[eh:eh+16])
assert img[eh+16:eh+18]==b'RB'
print(hex(rip),hex(rcs),hex(esz),hex(rsp),hex(rss),hex(dlen),skip)
src=bytearray(img[:eh-(skip-1)*16])
dst=bytearray(dlen*16)
dst[:len(src)]=src
s=len(src)-1
while src[s]==0xff: s-=1
dp=len(dst)
while True:
    cmd=src[s]; s-=1
    ln=src[s]*256+src[s-1]; s-=2
    if cmd&0xfe==0xb0:
        b=src[s]; s-=1
        dst[dp-ln:dp]=bytes([b])*ln; dp-=ln
    elif cmd&0xfe==0xb2:
        dst[dp-ln:dp]=src[s-ln+1:s+1]; s-=ln; dp-=ln
    else: raise Exception('bad cmd %x at %x'%(cmd,s))
    if cmd&1: break
print('remaining src',s+1,'dst',dp)
open(sys.argv[2],'wb').write(dst)
