import sys,zlib,struct; sys.path.insert(0,sys.argv[1]); from res import *
r=load(sys.argv[2]); img=int(sys.argv[3]); pal=int(sys.argv[4]); outp=sys.argv[5]
p=r[pal]; print('pal',p.hex(' '))
cols=[tuple(min(255,c*255//63) for c in p[3+3*i:6+3*i]) for i in range(16)]
b=r[img]; h=b[0]|b[1]<<8; w=b[2]|b[3]<<8; m=b[5]
data,_=lzss(b[6:],h*w//2)
px=[]
for byte in data: px+= [byte>>4, byte&15]
if m&0xf==4:  # column-major bytes: each column of h bytes = 2 pixels wide
    grid=[[0]*w for _ in range(h)]
    for i,byte in enumerate(data):
        x=(i//h)*2; y=i%h
        grid[y][x]=byte>>4; grid[y][x+1]=byte&15
else:
    grid=[px[y*w:(y+1)*w] for y in range(h)]
raw=b''.join(b'\0'+bytes(c for v in row for c in cols[v]) for row in grid)
def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
open(outp,'wb').write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))
print(w,h,hex(m))
